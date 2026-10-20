import { blockLabel, PHASE_SHORT } from "@/components/season/phase-style";
import { Card, CardTitle } from "@/components/ui/card";
import {
  blockDistribution,
  distributionNotes,
  MIN_SESSIONS,
  phaseTarget,
  raceDemand,
  SESSION_GOALS,
  type Band,
  type Distribution,
  type PlannedGoal,
  type SessionGoal,
} from "@/lib/season/distribution";
import { blockOn, dateRange, mainRace } from "@/lib/season/season";
import type { AdeptRaceRow, TrainingBlockRow } from "@/lib/types/database";

/** Lugnt, medel och högt ur passprofilens blå stege, med avstånd emellan. */
const GOAL_FILL: Record<SessionGoal, string> = {
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
function Bar({ counts }: { counts: Distribution }) {
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

/**
 * Intensitetsfördelningen per period: de planerade passen räknade efter sitt
 * huvudsyfte och jämförda med fasens riktmärke ur filosofin.
 *
 * Bara inplanerade pass räknas. Riktmärkena är till för att se glidning –
 * för mycket mellanintensitet i grunden, för lite tävlingsfart i den
 * specifika perioden – inte för att styra varje vecka.
 */
export function DistributionCard({
  blocks,
  races,
  planned,
  from,
  to,
  today,
}: {
  blocks: TrainingBlockRow[];
  races: AdeptRaceRow[];
  planned: PlannedGoal[];
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
    }))
    .filter(
      ({ block, counts }) => counts.total > 0 || block.id === current?.id,
    );

  if (shown.length === 0) return null;

  return (
    <Card className="min-w-0">
      <CardTitle>Intensitetsfördelning</CardTitle>
      <p className="mb-4 max-w-prose text-sm text-text-muted">
        Periodens inplanerade pass efter huvudsyfte – lugnt under LT1, medel
        mellan trösklarna, högt över LT2 – mot fasens riktmärke.
      </p>

      <ul className="divide-y divide-line">
        {shown.map(({ block, counts }) => {
          const race =
            block.phase === "specifik" ? raceFor(block, races) : null;
          const target = phaseTarget(block, race ? raceDemand(race) : null);
          const notes = distributionNotes(counts, target);
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
              </div>

              <div className="min-w-0 space-y-2">
                {counts.total > 0 ? (
                  <>
                    <Bar counts={counts} />
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
                            <span className="text-text-subtle">
                              ({counts[key]} pass)
                            </span>
                          </dd>
                          {target.bands && (
                            <dd className="text-text-subtle tabular-nums">
                              riktmärke {bandText(target.bands[key])}
                            </dd>
                          )}
                        </div>
                      ))}
                    </dl>
                  </>
                ) : (
                  <p className="text-[13px] text-text-subtle">
                    Inga pass inplanerade i perioden ännu.
                  </p>
                )}

                <p className="text-[12px] text-text-subtle">{target.text}</p>

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
                ) : counts.total > 0 &&
                  counts.total < MIN_SESSIONS &&
                  target.bands ? (
                  <p className="text-[12px] text-text-subtle">
                    {counts.total} pass – för få för att jämföra andelarna.
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
