import { PriorityBadge } from "@/components/season/priority-badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeadline, CardLabel } from "@/components/ui/card";
import {
  countdownText,
  daysBetween,
  longDate,
  mainRace,
} from "@/lib/season/season";
import type { AdeptRaceRow } from "@/lib/types/database";

const capital = (text: string) => text.replace(/^./, (c) => c.toUpperCase());

/**
 * Nästa tävling: A-loppet om det finns ett, annars den närmaste. Utan lopp
 * säger kortet varför ett mål behövs.
 */
export function NextRaceCard({
  races,
  today,
  href,
}: {
  races: AdeptRaceRow[];
  today: string;
  /** Säsongsplanen, där loppen läggs in. */
  href: string;
}) {
  const race = mainRace(races, today);
  return (
    <Card className="flex min-w-0 flex-col">
      <CardLabel
        aside={
          race ? (
            <PriorityBadge
              priority={race.priority}
              className="size-5 text-[0.6875rem]"
            />
          ) : undefined
        }
      >
        {race?.priority === "A" ? "Säsongens mål" : "Nästa tävling"}
      </CardLabel>
      {race ? (
        <>
          <CardHeadline>{race.name}</CardHeadline>
          <p className="mt-3 text-[0.9375rem] text-text-muted">
            {capital(countdownText(daysBetween(today, race.race_date)))} ·{" "}
            {longDate(race.race_date, today)}
          </p>
          {race.target && (
            <p className="mt-1 text-[0.8125rem] text-text-subtle">
              Mål: {race.target}
            </p>
          )}
        </>
      ) : (
        <>
          <CardHeadline>Inget mål inlagt än.</CardHeadline>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-text-muted">
            Med ett A-lopp räknar planen ned mot dagen och visar om toppningen
            hamnar rätt.
          </p>
        </>
      )}
      <div className="mt-auto pt-6">
        <ButtonLink href={href} variant="secondary">
          {race ? "Säsongsplanen" : "Till säsongsplanen"}
        </ButtonLink>
      </div>
    </Card>
  );
}
