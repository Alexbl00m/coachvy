import { blockLabel, PHASE_SHORT } from "@/components/season/phase-style";
import { Card, CardTitle } from "@/components/ui/card";
import {
  blockDistribution,
  distributionNotes,
  doneDistribution,
  MIN_SESSIONS,
  phaseTarget,
  raceDemand,
  SESSION_GOALS,
  type Band,
  type Distribution,
  type DoneGoalLike,
  type PhaseTarget,
  type PlannedGoal,
  type SessionGoal,
} from "@/lib/season/distribution";
import { blockOn, dateRange, mainRace } from "@/lib/season/season";
import type { AdeptRaceRow, TrainingBlockRow } from "@/lib/types/database";

/** Lugnt, medel och högt ur passprofilens blå stege, med avstånd emellan. */
export const GOAL_FILL: Record<SessionGoal, string> = {
  lugn: "var(--zone-1)",
  medel: "var(--zone-3)",
  hög: "var(--zone-5)",
};

const pct = (n: number) => `${Math.round(n * 100)} %`;
const bandText = ({ min, max }: Band) =>
  min <= 0
    ? `≤ ${pct(max)}`
    : max >= 1
      ? `≥ ${pct(min)}`
      : `${Math.round(min * 100)}–${pct(max)}`;

/** Fördelningen som en stapel, med siffrorna bredvid – aldrig färgen ensam. */
export function DistributionBar({ counts }: { counts: Distribution }) {
  return (
    <div
      className="flex h-2.5 overflow-hidden rounded-full bg-surface-2"
      aria-hidden
    >
      {SESSION_GOALS.map(({ key }) =>
        counts[key] > 0 ? (
          <span
            key={key}
            style={{
              width: `${(counts[key] / counts.total) * 100}%`,
              background: GOAL_FILL[key],
            }}
          />
        ) : null,
      )}
    </div>
  );
}

/** Loppet en period bygger mot: närmaste A-lopp efter starten, annars nästa. */
function raceFor(
  block: TrainingBlockRow,
  races: AdeptRaceRow[],
): AdeptRaceRow | null {
  return mainRace(races, block.starts_on);
}

/** En rad i perioden: stapeln, andelarna med riktmärket och avvikelserna. */
export function GoalBreakdown({
  label,
  counts,
  target,
  empty,
}: {
  label: string;
  counts: Distribution;
  target: PhaseTarget;
  empty: string;
}) {
  const notes = distributionNotes(counts, target);
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-[12px] font-medium text-text-muted">
        {label}
        {counts.total > 0 && (
          <span className="font-normal text-text-subtle">
            {" "}
            · {counts.total} pass
          </span>
        )}
      </p>
      {counts.total > 0 ? (
        <>
          <DistributionBar counts={counts} />
          <dl className="grid grid-cols-3 gap-2 text-[12px]">
            {SESSION_GOALS.map(({ key, label }) => (
              <div key={key} className="min-w-0">
                <dt className="flex items-center gap-1.5 text-text-muted">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: GOAL_FILL[key] }}
                  />
                  {label}
                </dt>
                <dd className="tabular-nums text-text">
                  <span className="font-semibold">
                    {pct(counts[key] / counts.total)}
                  </span>{" "}
                  <span className="text-text-subtle">({counts[key]})</span>
                </dd>
                {target.bands && (
                  <dd className="text-text-subtle tabular-nums">
                    riktmärke {bandText(target.bands[key])}
                  </dd>
                )}
              </div>
            ))}
          </dl>
          {notes.length > 0 ? (
            <ul className="space-y-1 text-[13px] text-text">
              {notes.map((note) => (
                <li key={note} className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warn"
                  />
                  {note}
                </li>
              ))}
            </ul>
          ) : counts.total < MIN_SESSIONS && target.bands ? (
            <p className="text-[12px] text-text-subtle">
              För få pass för att jämföra andelarna.
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-[13px] text-text-subtle">{empty}</p>
      )}
    </div>
  );
}

/**
 * Intensitetsfördelningen per period: de planerade och de genomförda passen
 * räknade efter sitt huvudsyfte och jämförda med fasens riktmärke ur
 * filosofin.
 *
 * Planerat är de inplanerade passen; genomfört är passen ur klockan, klassade
 * av coachen, ur AI-sammanfattningen eller automatiskt ur zonerna. Tävlingar
 * räknas inte – riktmärkena gäller träningen. Riktmärkena är till för att se
 * glidning – för mycket mellanintensitet i grunden, för lite tävlingsfart i
 * den specifika perioden – inte för att styra varje vecka.
 */
export function DistributionCard({
  blocks,
  races,
  planned,
  done = [],
  from,
  to,
  today,
}: {
  blocks: TrainingBlockRow[];
  races: AdeptRaceRow[];
  planned: PlannedGoal[];
  done?: DoneGoalLike[];
  from: string;
  to: string;
  today: string;
}) {
  const current = blockOn(blocks, today);
  const shown = [...blocks]
    .filter((b) => b.ends_on >= from && b.starts_on <= to)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on))
    .map((block) => ({
      block,
      counts: blockDistribution(block, planned),
      done: doneDistribution(block, done),
    }))
    .filter(
      ({ block, counts, done }) =>
        counts.total > 0 || done.counts.total > 0 || block.id === current?.id,
    );

  if (shown.length === 0) return null;

  return (
    <Card className="min-w-0">
      <CardTitle>Intensitetsfördelning</CardTitle>
      <p className="mb-4 max-w-prose text-sm text-text-muted">
        Periodens pass efter huvudsyfte – lugnt under LT1, medel mellan
        trösklarna, högt över LT2 – planerat och genomfört, mot fasens
        riktmärke.
      </p>

      <ul className="divide-y divide-line">
        {shown.map(({ block, counts, done }) => {
          const race =
            block.phase === "specifik" ? raceFor(block, races) : null;
          const target = phaseTarget(block, race ? raceDemand(race) : null);
          const started = block.starts_on <= today;
          const extra = [
            done.races > 0
              ? `${done.races} ${done.races === 1 ? "tävling" : "tävlingar"} räknas inte`
              : null,
            done.unclassified > 0
              ? `${done.unclassified} pass utan klassning (simning eller pass utan zoner)`
              : null,
          ].filter(Boolean);
          return (
            <li
              key={block.id}
              className="grid gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:gap-6"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-text">
                  {blockLabel(block)}
                  {block.id === current?.id && (
                    <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-text-muted">
                      nu
                    </span>
                  )}
                </p>
                <p className="text-[12px] text-text-subtle tabular-nums">
                  {block.name?.trim() ? `${PHASE_SHORT[block.phase]} · ` : ""}
                  {dateRange(block.starts_on, block.ends_on, today)}
                </p>
                <p className="mt-1 text-[12px] font-medium text-text-muted">
                  {target.model}
                  {race ? ` · ${race.name}` : ""}
                </p>
                <p className="mt-1 text-[12px] text-text-subtle">
                  {target.text}
                </p>
              </div>

              <div className="grid min-w-0 gap-5 md:grid-cols-2">
                <GoalBreakdown
                  label="Planerat"
                  counts={counts}
                  target={target}
                  empty="Inga pass inplanerade i perioden ännu."
                />
                <GoalBreakdown
                  label="Genomfört"
                  counts={done.counts}
                  target={target}
                  empty={
                    started
                      ? "Inga klassade pass ur klockan i perioden ännu."
                      : "Perioden har inte börjat."
                  }
                />
                {extra.length > 0 && (
                  <p className="text-[12px] text-text-subtle md:col-span-2">
                    {extra.join(" · ")}.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
