import { PHASE_SHORT, phaseFill } from "@/components/season/phase-style";
import { PriorityBadge } from "@/components/season/priority-badge";
import {
  blockOn,
  countdownText,
  daysBetween,
  longDate,
  mainRace,
  nextBlock,
  upcomingRaces,
} from "@/lib/season/season";
import type { AdeptRaceRow, TrainingBlockRow } from "@/lib/types/database";

function Tile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface p-4 sm:p-5">
      <p className="text-[12px] font-medium text-text-muted">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/** Nedräkningen som tal och enhet: dagar nära, veckor längre fram. */
export function Countdown({ days }: { days: number }) {
  const weeks = days >= 21;
  const value = weeks ? Math.floor(days / 7) : days;
  const unit = weeks
    ? value === 1
      ? "vecka"
      : "veckor"
    : value === 1
      ? "dag"
      : "dagar";
  return (
    <p className="text-3xl font-semibold tracking-tight text-text">
      {days === 0 ? "I dag" : value}
      {days !== 0 && (
        <span className="ml-1.5 text-base font-normal text-text-muted">
          {unit}
        </span>
      )}
    </p>
  );
}

/**
 * Läget i säsongen i tre rutor: fasen som pågår, nedräkningen till loppet
 * planen byggs mot, och nästa start när den kommer före.
 */
export function SeasonSummary({
  blocks,
  races,
  today,
}: {
  blocks: TrainingBlockRow[];
  races: AdeptRaceRow[];
  today: string;
}) {
  const current = blockOn(blocks, today);
  const next = nextBlock(blocks, today);
  const main = mainRace(races, today);
  const first = upcomingRaces(races, today)[0] ?? null;
  const sooner = first && main && first.id !== main.id ? first : null;

  return (
    <section
      aria-label="Läget i säsongen"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Tile label="Fasen nu">
        {current ? (
          <>
            <p className="flex items-center gap-2 text-xl font-semibold text-text">
              <span
                aria-hidden
                className="h-3 w-5 rounded-[3px]"
                style={{ background: phaseFill(current.phase) }}
              />
              {PHASE_SHORT[current.phase]}
            </p>
            <p className="mt-1 text-[13px] text-text-muted tabular-nums">
              Till {longDate(current.ends_on, today)} ·{" "}
              {daysBetween(today, current.ends_on) === 0
                ? "sista dagen"
                : `${daysBetween(today, current.ends_on)} dagar kvar`}
            </p>
            {current.focus && (
              <p className="mt-1 text-[13px] text-text-subtle">
                {current.focus}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-xl font-semibold text-text-muted">
              Ingen period
            </p>
            <p className="mt-1 text-[13px] text-text-subtle">
              {next
                ? `${PHASE_SHORT[next.phase]} börjar ${longDate(next.starts_on, today)}.`
                : "Lägg upp säsongens perioder nedan."}
            </p>
          </>
        )}
      </Tile>

      <Tile label={main?.priority === "A" ? "Säsongens mål" : "Nästa tävling"}>
        {main ? (
          <>
            <Countdown days={daysBetween(today, main.race_date)} />
            <p className="mt-1 flex items-center gap-2 text-[13px] text-text">
              <PriorityBadge
                priority={main.priority}
                className="size-5 text-[11px]"
              />
              <span className="truncate font-medium">{main.name}</span>
            </p>
            <p className="mt-0.5 text-[12px] text-text-subtle">
              {longDate(main.race_date, today)}
              {main.target ? ` · mål: ${main.target}` : ""}
            </p>
          </>
        ) : (
          <>
            <p className="text-xl font-semibold text-text-muted">
              Inget inlagt
            </p>
            <p className="mt-1 text-[13px] text-text-subtle">
              Lägg in säsongens mål som A-lopp.
            </p>
          </>
        )}
      </Tile>

      <Tile label="Före det">
        {sooner ? (
          <>
            <p className="flex items-center gap-2 text-[15px] font-semibold text-text">
              <PriorityBadge
                priority={sooner.priority}
                className="size-5 text-[11px]"
              />
              <span className="truncate">{sooner.name}</span>
            </p>
            <p className="mt-1 text-[13px] text-text-muted">
              {longDate(sooner.race_date, today)} ·{" "}
              {countdownText(daysBetween(today, sooner.race_date))}
            </p>
          </>
        ) : (
          <p className="text-[13px] text-text-subtle">
            {main ? "Inga starter före det." : "–"}
          </p>
        )}
      </Tile>
    </section>
  );
}
