import { blockLabel, phaseFill } from "@/components/season/phase-style";
import { CardHeadline, CardLabel } from "@/components/ui/card";
import {
  blockOn,
  countdownText,
  daysBetween,
  isoWeek,
  nextBlock,
} from "@/lib/season/season";
import type { TrainingBlockRow } from "@/lib/types/database";

/**
 * Fasen nu: periodens namn, vad som kommer härnäst och en stapel över de
 * närmaste perioderna med en markering för i dag. Mellan två perioder är det
 * övergång.
 */
export function PhaseNow({
  blocks,
  today,
}: {
  blocks: TrainingBlockRow[];
  today: string;
}) {
  const current = blockOn(blocks, today);
  const next = nextBlock(blocks, today);
  const sorted = [...blocks].sort((a, b) =>
    a.starts_on.localeCompare(b.starts_on),
  );
  // Stapeln: från i dag (eller periodens start) och tre perioder framåt.
  const start = current?.starts_on ?? today;
  const shown = sorted.filter((b) => b.ends_on >= start).slice(0, 3);
  const end = shown.length ? shown[shown.length - 1].ends_on : null;

  const aside = current
    ? next
      ? `${blockLabel(next)} ${countdownText(daysBetween(today, next.starts_on))}`
      : `${daysBetween(today, current.ends_on)} dagar kvar`
    : next
      ? `${blockLabel(next)} ${countdownText(daysBetween(today, next.starts_on))}`
      : null;

  return (
    <>
      <CardLabel aside={aside}>Fasen nu</CardLabel>
      <CardHeadline>
        {current ? blockLabel(current) : next ? "Övergång" : "Ingen period"}
      </CardHeadline>
      {end && end > start ? (
        <Bar start={start} end={end} blocks={shown} today={today} />
      ) : (
        <p className="mt-3 text-sm text-text-muted">
          Säsongens perioder läggs upp i säsongsplanen.
        </p>
      )}
    </>
  );
}

function Bar({
  start,
  end,
  blocks,
  today,
}: {
  start: string;
  end: string;
  blocks: TrainingBlockRow[];
  today: string;
}) {
  const span = Math.max(1, daysBetween(start, end) + 1);
  const at = (iso: string) =>
    Math.min(100, Math.max(0, (daysBetween(start, iso) / span) * 100));
  // Luckor mellan perioderna ritas som egna, grå segment.
  const segments: {
    from: string;
    to: string;
    block: TrainingBlockRow | null;
  }[] = [];
  let cursor = start;
  for (const block of blocks) {
    const from = block.starts_on > cursor ? block.starts_on : cursor;
    if (from > cursor) segments.push({ from: cursor, to: from, block: null });
    segments.push({ from, to: block.ends_on, block });
    cursor = block.ends_on;
  }
  const marker = at(today);

  return (
    <div className="mt-5" aria-hidden>
      <div className="relative">
        <div className="flex h-2 gap-1">
          {segments.map((s, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{
                flex: `${Math.max(1, daysBetween(s.from, s.to))} 1 0`,
                background: s.block
                  ? phaseFill(s.block.phase)
                  : "var(--surface-3)",
              }}
            />
          ))}
        </div>
        <span
          className="absolute -top-1.5 h-5 w-0.5 rounded-full bg-text"
          style={{ left: `${marker}%` }}
        />
      </div>
      <div className="mt-3 flex gap-1 font-mono text-[0.6875rem] leading-4 text-text-subtle">
        {segments.map((s, i) => (
          <span
            key={i}
            className="min-w-0"
            style={{ flex: `${Math.max(1, daysBetween(s.from, s.to))} 1 0` }}
          >
            <span className="block truncate text-text-muted">
              {s.block ? blockLabel(s.block) : ""}
            </span>
            <span className="block truncate">
              {s.block
                ? `v${isoWeek(s.block.starts_on)}–${isoWeek(s.block.ends_on)}`
                : today >= s.from && today < s.to
                  ? `v${isoWeek(today)}`
                  : ""}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
