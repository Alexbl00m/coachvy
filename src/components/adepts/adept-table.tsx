"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, MessageSquare, Search } from "lucide-react";

import { PHASE_SHORT, phaseFill } from "@/components/season/phase-style";
import { PriorityBadge } from "@/components/season/priority-badge";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import type { TrainingPhase } from "@/lib/tests/phases";
import type { RacePriority } from "@/lib/types/database";

export type AdeptListRow = {
  id: string;
  name: string;
  email: string | null;
  sport: string | null;
  level: string | null;
  goal: string | null;
  lastActive: string;
  phase: TrainingPhase | null;
  /** Senaste återhämtningspoängen och adeptens snitt, när det finns. */
  readiness: { score: number; baseline: number | null; when: string } | null;
  nextRace: {
    name: string;
    priority: RacePriority;
    countdown: string;
  } | null;
  unread: number;
  /** Det som gör adepten värd en titt, viktigast först. Tom när inget sticker ut. */
  attention: { text: string; weight: 1 | 2 | 3 }[];
};

/** Värd en titt: något i listan över det som sticker ut, eller olästa. */
const worthALook = (r: AdeptListRow) => r.attention.length > 0 || r.unread > 0;

const sv = (v: number) => v.toFixed(1).replace(".", ",").replace(",0", "");

/**
 * Adeptlistan med sök och filter.
 *
 * Filtreringen sker i webbläsaren: en coach har tiotals adepter, inte
 * tusentals, och sökningen ska svara medan man skriver.
 */
export function AdeptTable({ rows }: { rows: AdeptListRow[] }) {
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState<string | null>(null);
  const [onlyAttention, setOnlyAttention] = useState(false);

  const sports = useMemo(
    () =>
      [
        ...new Set(
          rows.map((r) => r.sport?.trim()).filter(Boolean) as string[],
        ),
      ].sort((a, b) => a.localeCompare(b, "sv")),
    [rows],
  );

  const needle = query.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (!needle ||
        [r.name, r.email, r.goal, r.sport]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(needle))) &&
      (!sport || r.sport?.trim() === sport) &&
      (!onlyAttention || worthALook(r)),
  );
  const attentionCount = rows.filter(worthALook).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-64">
          <span className="sr-only">Sök adept</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-subtle"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök namn, e-post eller mål"
            className="h-9 w-full rounded-md border border-line-strong bg-surface pl-8 pr-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
          />
        </label>
        <div role="group" aria-label="Gren" className="flex flex-wrap gap-1.5">
          {[null, ...sports].map((s) => (
            <button
              key={s ?? "alla"}
              type="button"
              aria-pressed={sport === s}
              onClick={() => setSport(s)}
              className={cn(
                "rounded-full border px-3 py-1 text-[12px] transition-colors",
                sport === s
                  ? "border-accent bg-accent-soft text-text"
                  : "border-line text-text-muted hover:text-text",
              )}
            >
              {s ?? "Alla grenar"}
            </button>
          ))}
        </div>
        {attentionCount > 0 && (
          <button
            type="button"
            aria-pressed={onlyAttention}
            onClick={() => setOnlyAttention((v) => !v)}
            className={cn(
              "rounded-full border px-3 py-1 text-[12px] transition-colors sm:ml-auto",
              onlyAttention
                ? "border-accent bg-accent-soft text-text"
                : "border-line text-text-muted hover:text-text",
            )}
          >
            Värda en titt ({attentionCount})
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-line">
        {/* relative: skärmläsartexten i en rubrik är absolut positionerad och
            skulle annars räknas mot hela sidans bredd på en telefon. */}
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/60 text-left">
                <th className="px-4 py-3 font-medium text-text-muted">Namn</th>
                <th className="px-4 py-3 font-medium text-text-muted">Gren</th>
                <th className="px-4 py-3 font-medium text-text-muted">Fas</th>
                <th className="px-4 py-3 font-medium text-text-muted">
                  Återhämtning
                </th>
                <th className="px-4 py-3 font-medium text-text-muted">
                  Nästa tävling
                </th>
                <th className="px-4 py-3 font-medium text-text-muted">
                  Senast aktiv
                </th>
                <th className="w-10 px-4 py-3">
                  <span className="sr-only">Öppna</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-text-muted"
                  >
                    Ingen adept matchar.
                  </td>
                </tr>
              ) : (
                shown.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-line align-top last:border-b-0 hover:bg-surface-2/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`${routes.adepts}/${r.id}`}
                        className="font-medium text-text hover:text-accent"
                      >
                        {r.name}
                      </Link>
                      {r.unread > 0 && (
                        <Link
                          href={`${routes.adepts}/${r.id}?vy=meddelanden`}
                          className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-on tabular-nums"
                          title="Olästa meddelanden"
                        >
                          <MessageSquare aria-hidden className="size-3" />
                          {r.unread}
                        </Link>
                      )}
                      {r.email && (
                        <span className="block text-[12px] text-text-subtle">
                          {r.email}
                        </span>
                      )}
                      {r.attention.length > 0 && (
                        <span
                          className={cn(
                            "mt-1 block text-[12px]",
                            r.attention[0].weight === 3
                              ? "text-accent"
                              : "text-text-muted",
                          )}
                        >
                          {r.attention[0].text}
                          {r.attention.length > 1 &&
                            ` (+${r.attention.length - 1})`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {r.sport ?? "–"}
                      {r.level && (
                        <span className="block text-[12px] text-text-subtle">
                          {r.level}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {r.phase ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className="h-2.5 w-4 rounded-[2px]"
                            style={{ background: phaseFill(r.phase) }}
                          />
                          {PHASE_SHORT[r.phase]}
                        </span>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted tabular-nums">
                      {r.readiness ? (
                        <>
                          <span className="font-medium text-text">
                            {r.readiness.score}
                          </span>{" "}
                          av 20
                          <span className="block text-[12px] text-text-subtle">
                            {r.readiness.when}
                            {r.readiness.baseline !== null &&
                              ` · snitt ${sv(r.readiness.baseline)}`}
                          </span>
                        </>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.nextRace ? (
                        <span className="flex items-start gap-2">
                          <PriorityBadge
                            priority={r.nextRace.priority}
                            className="size-5 text-[11px]"
                          />
                          <span className="min-w-0">
                            <span className="block text-text">
                              {r.nextRace.name}
                            </span>
                            <span className="block text-[12px] text-text-subtle">
                              {r.nextRace.countdown}
                            </span>
                          </span>
                        </span>
                      ) : (
                        <span className="text-text-muted">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-subtle">
                      {r.lastActive}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`${routes.adepts}/${r.id}`}
                        aria-label={`Öppna ${r.name}`}
                        className="inline-flex text-text-subtle hover:text-accent"
                      >
                        <ChevronRight aria-hidden className="size-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[12px] text-text-subtle">
        {shown.length === rows.length
          ? `${rows.length} ${rows.length === 1 ? "adept" : "adepter"}`
          : `${shown.length} av ${rows.length} adepter`}
      </p>
    </div>
  );
}
