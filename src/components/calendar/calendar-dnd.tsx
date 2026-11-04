"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { DRAG_TYPE, parseDrag, type DragPass } from "@/lib/calendar/drag";
import { movePass } from "@/lib/calendar/move-actions";
import { longDate, weekdayName } from "@/lib/season/season";

/** Kopiera i stället för att flytta: Ctrl på Windows, Alt (Option) på Mac. */
const wantsCopy = (e: React.DragEvent) => e.ctrlKey || e.altKey || e.metaKey;

/**
 * Dra och släpp i kalendern. Rutnätet ritas på servern; det här lagret tar
 * emot händelserna: ett pass med `data-drag` dras, en dag med
 * `data-drop-date` tar emot det. Ett eget pass får nytt datum, ett planpass
 * flyttas i planen, ett planerat styrkepass får ny dag, och ett pass ur en
 * plan i biblioteket kopieras till adepten. Med Ctrl eller Alt nedtryckt när
 * passet släpps kopieras det i stället. Samma flytt och kopia går att göra
 * utan att dra, från dagspanelen.
 */
export function CalendarDnd({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const over = useRef<HTMLElement | null>(null);
  // Passet som dras; datan går inte att läsa förrän det släpps.
  const dragging = useRef<DragPass | null>(null);

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
        dragging.current = pass;
        e.dataTransfer.setData(DRAG_TYPE, item.dataset.drag);
        e.dataTransfer.setData("text/plain", pass.title);
        e.dataTransfer.effectAllowed =
          pass.kind === "mall" ? "copy" : "copyMove";
        // Själva dagen är en länk; den ska inte dras med.
        e.stopPropagation();
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        const cell = cellOf(e.target);
        if (!cell) return;
        e.preventDefault();
        // Markören visar ett plus när passet kopieras.
        e.dataTransfer.dropEffect =
          dragging.current?.kind === "mall" || wantsCopy(e) ? "copy" : "move";
        mark(cell);
      }}
      onDragLeave={(e) => {
        const cell = cellOf(e.target);
        if (cell && !cell.contains(e.relatedTarget as Node | null)) mark(null);
      }}
      onDragEnd={() => {
        mark(null);
        dragging.current = null;
      }}
      onDrop={(e) => {
        const cell = cellOf(e.target);
        mark(null);
        const pass = parseDrag(e.dataTransfer.getData(DRAG_TYPE));
        const date = cell?.dataset.dropDate;
        if (!pass || !date) return;
        e.preventDefault();
        dragging.current = null;
        const copy = pass.kind === "mall" || wantsCopy(e);
        setMessage(null);
        startTransition(async () => {
          const result = await movePass(pass, date, copy);
          if (!result.ok) {
            setMessage({ text: result.error, error: true });
            return;
          }
          const verb =
            pass.kind === "mall"
              ? "lades in på"
              : copy
                ? "kopierades till"
                : "flyttades till";
          setMessage({
            text: `${pass.title} ${verb} ${weekdayName(date)} ${longDate(date)}.`,
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
