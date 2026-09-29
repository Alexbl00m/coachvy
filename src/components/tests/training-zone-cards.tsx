import { DataTable } from "@/components/calculators/result-grid";
import { Card, CardTitle } from "@/components/ui/card";
import type { Sport } from "@/lib/calculators/lactate";
import { thresholdHeartRateZones } from "@/lib/tests/heart-rate-zones";
import { intervalZones } from "@/lib/tests/intervals";
import { formatPace, paceUnit } from "@/lib/tests/pace";

const length = (seconds: number) =>
  seconds < 60 ? `${seconds} s` : `${seconds / 60} min`;

/**
 * Intervallzonerna: mål för vanliga serier, räknade med W′bal så att hela
 * serien går att genomföra.
 */
export function IntervalZonesCard({
  sport,
  critical,
  reserve,
}: {
  sport: Sport;
  /** CP i watt, eller CS i m/s. */
  critical: number;
  /** W′ i joule, eller D′ i meter. */
  reserve: number;
}) {
  const watts = sport === "cykling";
  // Simmare vilar på kanten; cyklister och löpare rullar eller joggar.
  const rows = intervalZones(critical, reserve, {
    watts,
    restFraction: sport === "simning" ? 0 : 0.5,
  });
  if (rows.length === 0) return null;
  const level = (v: number) =>
    watts ? `${Math.round(v)} W` : `${formatPace(v, sport)}${paceUnit(sport)}`;
  const name = watts ? "CP" : sport === "simning" ? "CSS" : "CS";

  return (
    <Card className="min-w-0">
      <CardTitle>Intervallzoner</CardTitle>
      <p className="mb-3 max-w-3xl text-sm text-text-muted">
        Målet är den högsta nivå där hela serien håller: reserven över {name}{" "}
        följs genom varje repetition och vila, och får aldrig gå under 10 %.
        Taket är vad en enda repetition klarar med hela reserven.
      </p>
      <DataTable
        headers={["Serie", "Mål", `% av ${name}`, "Tak, en rep.", "Tränar"]}
        minWidth={620}
        rows={rows.map((r) => [
          `${r.reps} × ${length(r.seconds)}, vila ${length(r.rest)}`,
          <span key="t" className="font-medium text-text">
            {level(r.target)}
          </span>,
          `${Math.round(r.pctOfCritical)} %`,
          level(r.single),
          r.purpose,
        ])}
      />
      <p className="mt-3 text-[12px] leading-relaxed text-text-subtle">
        Vilan är{" "}
        {sport === "simning"
          ? "stillastående på kanten"
          : `lätt ${watts ? "trampande" : "jogg"} på halva ${name}`}
        . Modellen förutsätter utvilad start och jämn fart i varje repetition –
        se målen som ett tak för serien, inte som ett krav.
      </p>
    </Card>
  );
}

/** Pulszoner ur tröskelpulsen, när testet saknar puls på varje steg. */
export function HeartRateZonesCard({
  lthr,
  sport,
  source,
}: {
  lthr: number;
  sport: Sport;
  source: string;
}) {
  const zones = thresholdHeartRateZones(lthr, sport);
  if (zones.length === 0) return null;
  return (
    <Card className="min-w-0">
      <CardTitle>Pulszoner</CardTitle>
      <p className="mb-3 text-sm text-text-muted">
        Ur tröskelpulsen {Math.round(lthr)} slag/min ({source}), med Friels
        gränser för {sport === "cykling" ? "cykel" : "löpning"}. Ett stegtest
        med puls på varje steg ger zoner ur atletens egen pulskurva i stället.
      </p>
      <DataTable
        headers={["Zon", "Puls (slag/min)", "Vad den gör"]}
        minWidth={420}
        rows={zones.map((z) => [
          z.zone,
          z.min === null
            ? `< ${z.max}`
            : z.max === null
              ? `> ${z.min}`
              : `${z.min}–${z.max}`,
          z.description,
        ])}
      />
    </Card>
  );
}
