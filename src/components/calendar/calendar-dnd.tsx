"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { DRAG_TYPE, parseDrag } from "@/lib/calendar/drag";
import { movePass } from "@/lib/calendar/move-actions";
import { longDate, weekdayName } from "@/lib/season/season";

/**
 * Dra och släpp i kalendern. Rutnätet ritas på servern; det här lagret tar
 * emot händelserna: ett pass med `data-drag` dras, en dag med
 * `data-drop-date` tar emot det. Ett eget pass får nytt datum, ett planpass
 * flyttas i planen och ett pass ur en plan i biblioteket kopieras till
 * adepten. Samma flytt går att göra utan att dra, från dagspanelen.
 */
export function CalendarDnd({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const over = useRef<HTMLElement | null>(null);

  // Notisen försvinner av sig själv; ett fel står kvar lite längre.
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(
      () => setMessage(null),
      message.error ? 8000 : 4000,
    );
    return () => clearTimeout(timer);
  }, [message]);

  const mark = (cell: HTMLElement | null) => {
    if (over.current === cell) return;
    if (over.current) delete over.current.dataset.dropOver;
    if (cell) cell.dataset.dropOver = "true";
    over.current = cell;
  };

  const cellOf = (target: EventTarget | null) =>
    target instanceof Element
      ? target.closest<HTMLElement>("[data-drop-date]")
      : null;

  return (
    <div
      onDragStart={(e) => {
        const item =
          e.target instanceof Element
            ? e.target.closest<HTMLElement>("[data-drag]")
            : null;
        if (!item?.dataset.drag) return;
        const pass = parseDrag(item.dataset.drag);
        if (!pass) return;
        e.dataTransfer.setData(DRAG_TYPE, item.dataset.drag);
        e.dataTransfer.setData("text/plain", pass.title);
        e.dataTransfer.effectAllowed = pass.kind === "mall" ? "copy" : "move";
        // Själva dagen är en länk; den ska inte dras med.
        e.stopPropagation();
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        const cell = cellOf(e.target);
        if (!cell) return;
        e.preventDefault();
        e.dataTransfer.dropEffect =
          e.dataTransfer.effectAllowed === "copy" ? "copy" : "move";
        mark(cell);
      }}
      onDragLeave={(e) => {
        const cell = cellOf(e.target);
        if (cell && !cell.contains(e.relatedTarget as Node | null)) mark(null);
      }}
      onDragEnd={() => mark(null)}
      onDrop={(e) => {
        const cell = cellOf(e.target);
        mark(null);
        const pass = parseDrag(e.dataTransfer.getData(DRAG_TYPE));
        const date = cell?.dataset.dropDate;
        if (!pass || !date) return;
        e.preventDefault();
        setMessage(null);
        startTransition(async () => {
          const result = await movePass(pass, date);
          if (!result.ok) {
            setMessage({ text: result.error, error: true });
            return;
          }
          setMessage({
            text: `${pass.title} ${pass.kind === "mall" ? "lades in" : "flyttades till"} ${weekdayName(date)} ${longDate(date)}.`,
            error: false,
          });
          router.refresh();
        });
      }}
    >
      {children}
      {/* Notisen syns där passet släpptes, vart man än tittar på sidan. */}
      <p
        role="status"
        aria-live="polite"
        className={
          pending || message
            ? `fixed bottom-6 left-1/2 z-40 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md border border-line-strong bg-surface px-4 py-2.5 text-sm shadow-xl ${message?.error ? "text-warn" : "text-text"}`
            : "sr-only"
        }
      >
        {pending ? "Sparar …" : (message?.text ?? "")}
      </p>
    </div>
  );
}
