import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { displayValue } from "@/lib/tests/pace";
import { daysBetween, type UtilisationSummary } from "@/lib/tests/progression";
import { UTILISATION_RANGES } from "@/lib/tests/vo2max";

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

/** Skalan raderna ritas på: 40–100 %. Under 40 är ingen tröskel. */
const SCALE = { from: 40, to: 100 };
const at = (pct: number) =>
  `${Math.min(Math.max(((pct - SCALE.from) / (SCALE.to - SCALE.from)) * 100, 0), 100)}%`;

function Row({
  label,
  detail,
  pct,
  range,
  note,
}: {
  label: string;
  detail: string;
  pct: number;
  range: { from: number; to: number } | null;
  note?: string;
}) {
  const state = !range
    ? null
    : pct < range.from
      ? "under"
      : pct > range.to
        ? "över"
        : "inom";

  return (
    <li className="grid gap-2 py-3 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:items-center sm:gap-5">
      <div>
        <p className="text-sm font-medium text-text">{label}</p>
        <p className="text-[12px] text-text-subtle tabular-nums">{detail}</p>
      </div>

      {/* Spåret: referensspannet som band, adepten som punkt. */}
      <div className="relative h-5" aria-hidden>
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-strong" />
        {range && (
          <span
            className="absolute inset-y-1 rounded-[3px] bg-accent-soft"
            style={{
              left: at(range.from),
              width: `calc(${at(range.to)} - ${at(range.from)})`,
            }}
          />
        )}
        <span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-surface"
          style={{ left: at(pct) }}
        />
      </div>

      <div className="flex items-center gap-2 sm:justify-end">
        <span className="text-lg font-semibold text-text tabular-nums">
          {sv(pct, 0)} %
        </span>
        {state && (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[11px] font-medium",
              state === "inom"
                ? "bg-surface-2 text-good"
                : "bg-surface-2 text-text-muted",
            )}
            title={
              range
                ? `Referens ${range.from}–${range.to} %${note ? ` (${note})` : ""}`
                : undefined
            }
          >
            {state === "inom"
              ? "inom spannet"
              : state === "under"
                ? "under spannet"
                : "över spannet"}
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * Hur stor del av VO2max trösklarna utnyttjar.
 *
 * Två atleter med samma VO2max kan ha trösklar på 65 och 85 % av det – och
 * det är den skillnaden, inte VO2max, som oftast avgör ett lopp. Ett högt
 * VO2max med låg utnyttjandegrad säger: träna tröskeln. En hög utnyttjandegrad
 * nära taket säger: höj VO2max.
 */
export function UtilisationCard({ summary }: { summary: UtilisationSummary }) {
  const { vo2max } = summary;
  const newest = summary.rows.reduce((a, b) =>
    a.performedOn > b.performedOn ? a : b,
  );
  const borrowed = daysBetween(vo2max.performedOn, newest.performedOn);
  const unitDigits = (unit: string) => (unit === "W" ? 0 : 1);

  return (
    <Card className="min-w-0">
      <CardTitle>Utnyttjandegrad av VO2max</CardTitle>

      <p className="mb-2 text-sm text-text-muted">
        Räknat mot VO2max{" "}
        <span className="font-medium text-text tabular-nums">
          {sv(vo2max.value, 1)} ml/kg/min
        </span>
        {" – "}
        {vo2max.measured ? "uppmätt" : `skattat, ${vo2max.method}`},{" "}
        {formatDate(vo2max.performedOn)}
        {borrowed > 0 && ` (${borrowed} dagar från tröskeltestet)`}.
      </p>

      <ul className="divide-y divide-line">
        {summary.rows.map((row) => (
          <Row
            key={row.key}
            label={
              row.key === "CP"
                ? "Critical power"
                : row.key === "LT1"
                  ? "LT1 – aerob tröskel"
                  : "LT2 – anaerob tröskel"
            }
            detail={`${(() => {
              const d = displayValue(
                row.intensity,
                row.unit,
                summary.sport,
                unitDigits(row.unit),
              );
              return `${d.value} ${d.unit}`;
            })()} · ${formatDate(row.performedOn)}`}
            pct={row.pct}
            range={
              row.key === "CP"
                ? UTILISATION_RANGES.LT2
                : UTILISATION_RANGES[row.key]
            }
            note={
              row.key === "CP"
                ? UTILISATION_RANGES.LT2.note
                : UTILISATION_RANGES[row.key].note
            }
          />
        ))}
        {summary.lt1OfLt2 !== null && (
          <Row
            label="LT1 i % av LT2"
            detail="samma test"
            pct={summary.lt1OfLt2}
            range={UTILISATION_RANGES.LT1_of_LT2[summary.sport]}
          />
        )}
      </ul>

      <p className="mt-3 text-[12px] leading-relaxed text-text-subtle">
        Syreupptaget vid tröskeln räknas med ACSM:s ekvation och delas med
        VO2max. Bandet är referensspannet: LT1 65–75 % (tävlande motionär 65–70,
        proffs runt 75), LT2 75–90 % (motionär 75–85, proffs 80–90). Ett skattat
        VO2max har ett fel på runt ±5 %, och det slår igenom på procenten.
      </p>
    </Card>
  );
}
