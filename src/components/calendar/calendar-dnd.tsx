"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import { DRAG_TYPE, parseDrag, type DragItem } from "@/lib/calendar/drag";
import { movePass } from "@/lib/calendar/move-actions";
import {
  moveWeek as moveWeekAction,
  undoWeekMove,
} from "@/lib/calendar/week-actions";
import { isoWeek, longDate, weekdayName } from "@/lib/season/season";

/** Kopiera i stället för att flytta: Ctrl på Windows, Alt (Option) på Mac. */
const wantsCopy = (e: React.DragEvent) => e.ctrlKey || e.altKey || e.metaKey;

type WeekMove = { adeptId: string; from: string; to: string; copy: boolean };

type Notice = {
  text: string;
  error: boolean;
  /** Ångrar det som just gjordes. */
  undo?: () => void;
  /** Visar veckan passen hamnade i. */
  show?: { label: string; monday: string };
};

const WeekContext = createContext<{
  moveWeek: (input: WeekMove) => Promise<boolean>;
  pending: boolean;
}>({ moveWeek: async () => false, pending: false });

/** Flyttar eller kopierar en vecka och visar utfallet i kalenderns notis. */
export const useWeekMove = () => useContext(WeekContext);

/**
 * Dra och släpp i kalendern. Rutnätet ritas på servern; det här lagret tar
 * emot händelserna: ett pass med `data-drag` dras, en dag med
 * `data-drop-date` tar emot det. Ett eget pass får nytt datum, ett planpass
 * flyttas i planen, ett planerat styrkepass får ny dag, och ett pass ur en
 * plan i biblioteket kopieras till adepten. Med Ctrl eller Alt nedtryckt när
 * passet släpps kopieras det i stället. Samma flytt och kopia går att göra
 * utan att dra, från dagspanelen.
 *
 * Veckonumret drar hela veckan: den släpps på en rad med `data-drop-week`,
 * och passen hamnar på samma veckodag där (`moveWeek`). En flyttad vecka
 * går att ångra från notisen.
 */
export function CalendarDnd({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Notice | null>(null);
  const over = useRef<HTMLElement | null>(null);
  // Det som dras; datan går inte att läsa förrän det släpps.
  const dragging = useRef<DragItem | null>(null);

  // Notisen försvinner av sig själv; ett fel och en notis med ett val står
  // kvar längre.
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(
      () => setMessage(null),
      message.undo || message.show ? 12000 : message.error ? 8000 : 4000,
    );
    return () => clearTimeout(timer);
  }, [message]);

  const mark = (cell: HTMLElement | null) => {
    if (over.current === cell) return;
    if (over.current) delete over.current.dataset.dropOver;
    if (cell) cell.dataset.dropOver = "true";
    over.current = cell;
  };

  // En vecka släpps på en rad, ett pass på en dag.
  const targetOf = (target: EventTarget | null, week: boolean) =>
    target instanceof Element
      ? target.closest<HTMLElement>(
          week ? "[data-drop-week]" : "[data-drop-date]",
        )
      : null;

  const showWeek = (monday: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("manad", monday.slice(0, 7));
    url.searchParams.set("dag", monday);
    setMessage(null);
    router.push(`${url.pathname}?${url.searchParams.toString()}`);
  };

  const moveWeek = useCallback(
    (input: WeekMove) =>
      new Promise<boolean>((resolve) => {
        setMessage(null);
        startTransition(async () => {
          const result = await moveWeekAction(input);
          if (!result.ok) {
            setMessage({ text: result.error, error: true });
            resolve(false);
            return;
          }
          const from = isoWeek(input.from);
          const to = isoWeek(input.to);
          const skipped =
            result.failed.length > 0
              ? ` ${result.failed.length} gick inte: ${result.failed.join("; ")}`
              : "";
          const moved = result.moved;
          setMessage({
            text: `${result.count} pass ${input.copy ? "kopierades" : "flyttades"} från vecka ${from} till vecka ${to}.${skipped}`,
            error: result.failed.length > 0,
            show: { label: `Visa vecka ${to}`, monday: input.to },
            undo:
              moved.length > 0
                ? () => {
                    setMessage(null);
                    startTransition(async () => {
                      const back = await undoWeekMove(moved);
                      setMessage(
                        back.ok
                          ? {
                              text: `Flytten är ångrad: passen ligger i vecka ${from} igen.`,
                              error: back.failed.length > 0,
                            }
                          : { text: back.error, error: true },
                      );
                      router.refresh();
                    });
                  }
                : undefined,
          });
          router.refresh();
          resolve(true);
        });
      }),
    [router],
  );

  // Valen i notisen: visa veckan och ångra, inte medan den sparar.
  const show = pending ? null : (message?.show ?? null);
  const undo = pending ? null : (message?.undo ?? null);

  return (
    <WeekContext.Provider value={{ moveWeek, pending }}>
      <div
        onDragStart={(e) => {
          const item =
            e.target instanceof Element
              ? e.target.closest<HTMLElement>("[data-drag]")
              : null;
          if (!item?.dataset.drag) return;
          const drag = parseDrag(item.dataset.drag);
          if (!drag) return;
          dragging.current = drag;
          e.dataTransfer.setData(DRAG_TYPE, item.dataset.drag);
          e.dataTransfer.setData("text/plain", drag.title);
          e.dataTransfer.effectAllowed =
            drag.kind === "mall" ? "copy" : "copyMove";
          // Själva dagen är en länk; den ska inte dras med.
          e.stopPropagation();
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
          const target = targetOf(e.target, dragging.current?.kind === "vecka");
          if (!target) return;
          e.preventDefault();
          // Markören visar ett plus när passet kopieras.
          e.dataTransfer.dropEffect =
            dragging.current?.kind === "mall" || wantsCopy(e) ? "copy" : "move";
          mark(target);
        }}
        onDragLeave={(e) => {
          const target = targetOf(e.target, dragging.current?.kind === "vecka");
          if (target && !target.contains(e.relatedTarget as Node | null))
            mark(null);
        }}
        onDragEnd={() => {
          mark(null);
          dragging.current = null;
        }}
        onDrop={(e) => {
          mark(null);
          const drag = parseDrag(e.dataTransfer.getData(DRAG_TYPE));
          if (!drag) return;
          const copy = drag.kind === "mall" || wantsCopy(e);

          if (drag.kind === "vecka") {
            const to = targetOf(e.target, true)?.dataset.dropWeek;
            if (!to) return;
            e.preventDefault();
            dragging.current = null;
            if (to === drag.monday) return;
            void moveWeek({
              adeptId: drag.adeptId,
              from: drag.monday,
              to,
              copy,
            });
            return;
          }

          const date = targetOf(e.target, false)?.dataset.dropDate;
          if (!date) return;
          e.preventDefault();
          dragging.current = null;
          setMessage(null);
          startTransition(async () => {
            const result = await movePass(drag, date, copy);
            if (!result.ok) {
              setMessage({ text: result.error, error: true });
              return;
            }
            const verb =
              drag.kind === "mall"
                ? "lades in på"
                : copy
                  ? "kopierades till"
                  : "flyttades till";
            setMessage({
              text: `${drag.title} ${verb} ${weekdayName(date)} ${longDate(date)}.`,
              error: false,
            });
            router.refresh();
          });
        }}
      >
        {children}
        {/* Notisen syns där passet släpptes, vart man än tittar på sidan. */}
        <div
          role="status"
          aria-live="polite"
          className={
            pending || message
              ? "fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-line-strong bg-surface px-4 py-2.5 text-sm shadow-xl"
              : "sr-only"
          }
        >
          <p className={message?.error ? "text-warn" : "text-text"}>
            {pending ? "Sparar …" : (message?.text ?? "")}
          </p>
          {(show || undo) && (
            <span className="flex items-center gap-3">
              {show && (
                <button
                  type="button"
                  onClick={() => showWeek(show.monday)}
                  className="font-medium text-accent-text hover:underline"
                >
                  {show.label}
                </button>
              )}
              {undo && (
                <button
                  type="button"
                  onClick={undo}
                  className="font-medium text-accent-text hover:underline"
                >
                  Ångra
                </button>
              )}
            </span>
          )}
        </div>
      </div>
    </WeekContext.Provider>
  );
}
