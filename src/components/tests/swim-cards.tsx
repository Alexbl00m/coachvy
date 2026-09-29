import { DataTable } from "@/components/calculators/result-grid";
import { Card, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/calculators/time";
import {
  redMistCycles,
  SWIM_REFERENCES,
  swimPredictions,
  swimProfile,
  SWIM_TYPICAL_EXPONENT,
  type SwimPoint,
} from "@/lib/tests/swim";

const per100 = (metres: number, seconds: number) =>
  `${formatDuration((seconds / metres) * 100)}/100 m`;

/**
 * Tider på triathlon- och öppetvattendistanserna ur CSS-testet: simmarens
 * egen kurva, tre referensprofiler och CSS-modellen där den gäller.
 */
export function SwimPredictionsCard({
  points,
  cs,
  dPrime,
}: {
  points: SwimPoint[];
  /** CSS i m/s. */
  cs: number | null;
  dPrime: number | null;
}) {
  const rows = swimPredictions(points, cs, dPrime);
  if (rows.length === 0) return null;
  const profile = swimProfile(points);
  const longest = points.reduce((a, b) => (b.metres > a.metres ? b : a));

  return (
    <Card className="min-w-0">
      <CardTitle>Loppprognos</CardTitle>
      <p className="mb-3 text-[13px] text-text-muted">
        Från {Math.round(longest.metres)} m-testet med{" "}
        {profile
          ? `simmarens egen exponent ${profile.exponent.toFixed(3).replace(".", ",")}`
          : `exponenten ${SWIM_TYPICAL_EXPONENT.toFixed(2).replace(".", ",")} (två distanser krävs för en egen)`}
        . Referenserna visar samma test med en annan uthållighet – skillnaden är
        vad uthålligheten är värd på distansen.
      </p>
      <DataTable
        headers={[
          "Distans",
          "Egen kurva",
          ...SWIM_REFERENCES.map((r) => r.label),
          "CSS och D′",
        ]}
        minWidth={760}
        rows={rows.map((r) => [
          `${r.label} (${r.metres.toLocaleString("sv-SE")} m)`,
          <span key="own" className="whitespace-nowrap">
            <span className="font-medium text-text">
              {formatDuration(r.own)}
            </span>
            <span className="text-text-subtle">
              {" "}
              · {per100(r.metres, r.own)}
            </span>
          </span>,
          ...r.references.map((t) => formatDuration(t)),
          r.css === null
            ? "–"
            : `${formatDuration(r.css)}${r.cssBeyondModel ? " *" : ""}`,
        ])}
      />
      <p className="mt-3 text-[12px] leading-relaxed text-text-subtle">
        Bassängtider: i öppet vatten tillkommer navigering, vågor och start –
        och våtdräkt åt andra hållet. * CSS-modellen gäller ungefär 2–20
        minuter.
      </p>
    </Card>
  );
}

/** Red Mist-cyklerna: tid per 50 m från CSS och uppåt, en sekund i taget. */
export function RedMistCard({ cs }: { cs: number }) {
  const cycles = redMistCycles(cs);
  if (cycles.length === 0) return null;
  return (
    <Card className="min-w-0">
      <CardTitle>Red Mist-cykler</CardTitle>
      <p className="mb-3 text-[13px] text-text-muted">
        Tiden per 50 m för tempotränaren: cykel 0 är CSS, varje cykel en sekund
        långsammare.
      </p>
      <DataTable
        headers={["Cykel", "Per 50 m", "Per 100 m"]}
        minWidth={320}
        rows={cycles.map((c) => [
          `Cykel ${c.cycle}`,
          formatDuration(c.per50),
          formatDuration(c.per50 * 2),
        ])}
      />
    </Card>
  );
}
