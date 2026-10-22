import Link from "next/link";
import { Fragment } from "react";

import { cn } from "@/lib/cn";

export type WeekBarRow = {
  key: string | number;
  /** "V1". */
  label: string;
  /** Under etiketten: datum eller nivå. */
  meta?: string | null;
  /** Längden på stapeln, i veckans enhet. */
  value: number;
  /** Talet till höger: "82 km". */
  valueText: string;
  /** Långpasset, som den ljusare början av stapeln. */
  inner?: number | null;
  /** Fetstil först i raden: "Avlastning". */
  emphasis?: string | null;
  /** Veckans nyckelpass. */
  items: string[];
  /** En avlastnings- eller taperveckas stapel är dovare. */
  quiet?: boolean;
  current?: boolean;
  href?: string;
  /** Rubrik för en ny fas, ovanför raden. */
  group?: string | null;
  note?: { tone: "varning" | "info"; text: string } | null;
  /** Längst ut på andra raden: "3/5 pass". */
  aside?: string | null;
  asideTone?: "varning" | "notis" | null;
};

/**
 * Veckorna som en lista med staplar: volymen syns som längd, långpasset som
 * stapelns ljusa början, och raden under säger vad veckan bygger på.
 * Stapeln är relativ planens största vecka.
 */
export function WeekBars({
  rows,
  legend,
}: {
  rows: WeekBarRow[];
  /** Förklaringen under listan. */
  legend?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div>
      <ol className="divide-y divide-line">
        {rows.map((r) => {
          const width = (r.value / max) * 100;
          const inner = r.inner ? Math.min(100, (r.inner / r.value) * 100) : 0;
          const label = r.href ? (
            <Link href={r.href} className="hover:underline">
              {r.label}
            </Link>
          ) : (
            r.label
          );
          return (
            <Fragment key={r.key}>
              {r.group && (
                <li className="list-none pt-5 pb-1 text-[0.6875rem] font-semibold tracking-[0.12em] text-text-subtle uppercase first:pt-1">
                  {r.group}
                </li>
              )}
              <li
                aria-current={r.current ? "true" : undefined}
                className={cn(
                  "grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2.5",
                  r.current && "-mx-2 rounded-md bg-surface-2 px-2",
                )}
              >
                <span className="font-mono text-[0.8125rem] font-semibold text-text">
                  {label}
                </span>
                <span
                  aria-hidden
                  className="block h-2.5 overflow-hidden rounded-[3px] bg-surface-3"
                >
                  <span
                    className={cn(
                      "flex h-full overflow-hidden rounded-[3px]",
                      r.current
                        ? "bg-accent/70"
                        : r.quiet
                          ? "bg-text-subtle/60"
                          : "bg-text-muted/70",
                    )}
                    style={{ width: `${width}%` }}
                  >
                    {inner > 0 && (
                      <span
                        className={cn(
                          "h-full",
                          r.current ? "bg-accent" : "bg-text",
                        )}
                        style={{ width: `${inner}%` }}
                      />
                    )}
                  </span>
                </span>
                <span className="text-right font-mono text-[0.8125rem] whitespace-nowrap tabular-nums text-text">
                  {r.valueText}
                </span>
                <span aria-hidden />
                <p className="text-[0.8125rem] leading-snug text-text-muted">
                  {r.meta && (
                    <span className="mr-2 font-mono text-[0.6875rem] whitespace-nowrap text-text-subtle">
                      {r.meta}
                    </span>
                  )}
                  {r.emphasis && (
                    <strong className="font-semibold text-text">
                      {r.emphasis}
                    </strong>
                  )}
                  {r.emphasis && r.items.length > 0 && " · "}
                  {r.items.join(" · ")}
                  {r.note && (
                    <span
                      className={cn(
                        "mt-0.5 block text-[0.75rem]",
                        r.note.tone === "varning"
                          ? "text-warn"
                          : "text-text-subtle",
                      )}
                    >
                      {r.note.text}
                    </span>
                  )}
                </p>
                <span
                  className={cn(
                    "text-right text-[0.75rem] whitespace-nowrap tabular-nums",
                    r.asideTone === "varning"
                      ? "text-warn"
                      : r.asideTone === "notis"
                        ? "text-text-muted"
                        : "text-text-subtle",
                  )}
                >
                  {r.aside}
                </span>
              </li>
            </Fragment>
          );
        })}
      </ol>
      {legend && (
        <p className="mt-3 text-[0.6875rem] leading-snug text-text-subtle">
          {legend}
        </p>
      )}
    </div>
  );
}
