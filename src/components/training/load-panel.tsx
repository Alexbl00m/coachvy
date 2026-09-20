import { DataTable, ResultGrid } from "@/components/calculators/result-grid";
import { CheckinForm } from "@/components/training/checkin-form";
import { LoadChart } from "@/components/training/load-chart";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import {
  buildLoadSeries,
  READINESS_MAX,
  readRatio,
  readReadiness,
  readinessScore,
  sessionLoad,
} from "@/lib/training/load";
import { toCheckin } from "@/lib/training/queries";
import type { AdeptCheckinRow } from "@/lib/types/database";

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

/**
 * Belastning och mående för en adept.
 *
 * Serien räknas här på servern och skickas färdig till grafen. Fönstren är
 * kalenderdagar, inte "senaste sju incheckningar", så de måste räknas mot ett
 * datum – och räknades det i webbläsaren skulle serverns och klientens
 * uppfattning om vilken dag det är kunna gå isär.
 */
export function LoadPanel({
  adeptId,
  checkins,
  today,
}: {
  adeptId: string;
  /** Nyast först, som frågan returnerar dem. */
  checkins: AdeptCheckinRow[];
  /** Injicerat så att vyn går att rendera mot ett bestämt datum. */
  today?: Date;
}) {
  const series = buildLoadSeries(checkins.map(toCheckin), { days: 56, today });
  const latest = series.latest;
  const todayIso = (today ?? new Date()).toISOString().slice(0, 10);
  const todaysCheckin = checkins.find((c) => c.performed_on === todayIso) ?? null;

  const lastReadiness = series.points
    .slice()
    .reverse()
    .find((p) => p.readiness !== null);

  if (checkins.length === 0) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="Inga incheckningar ännu"
          description="Passbyggaren förutsäger vad ett pass ska kosta. Incheckningen är andra halvan: vad det faktiskt kostade, och hur adepten mår av summan."
        />
        <CheckinForm adeptId={adeptId} existing={null} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ResultGrid
        items={[
          {
            label: "Senaste 7 dagarna",
            value: latest ? Math.round(latest.acute) : "–",
            unit: "enheter",
            hint: latest ? `${Math.round(latest.acute / 7)} per dag i snitt` : undefined,
          },
          {
            label: "Mot månaden före",
            value: latest?.ratio ? sv(latest.ratio, 2) : "–",
            hint: latest?.ratio ? "kvot, inga gränsvärden" : "kräver 28 dagar bakåt",
          },
          {
            label: "Återhämtning",
            value: lastReadiness?.readiness ?? "–",
            unit: lastReadiness ? `av ${READINESS_MAX}` : undefined,
            hint: lastReadiness
              ? `${readReadiness(lastReadiness.readiness as number)} · ${formatDate(lastReadiness.date)}`
              : "ingen ifylld ännu",
          },
          {
            label: "Täckning",
            value: series.coverage,
            unit: "av 28 dagar",
            hint: "incheckningar senaste fyra veckorna",
          },
        ]}
      />

      <Card className="min-w-0">
        <CardTitle>Belastning och mående</CardTitle>
        <LoadChart points={series.points} />

        <div className="mt-4 space-y-2 border-t border-line pt-3 text-[13px] leading-relaxed text-text-muted">
          {latest?.ratio && <p>{readRatio(latest.ratio)}</p>}
          {series.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          <p className="text-text-subtle">
            Kvoten jämför de sju senaste dagarna med de 21 dessförinnan, inte med
            ett fönster som innehåller dem själva – annars dras den mot 1 av ren
            konstruktion. Här dras inga gränser i den: tröskelvärdena som brukar
            ritas ut vilar på svagare underlag än de framställs som, och en stor
            del av sambandet visade sig vara en artefakt av måttet (Impellizzeri
            m.fl. 2020). Kvoten säger om veckan avviker från månaden före,
            ingenting mer.
          </p>
        </div>
      </Card>

      <Card className="min-w-0">
        <CardTitle>Incheckningarna</CardTitle>
        <DataTable
          headers={["Datum", "Pass", "Belastning", "Återhämtning", "Anteckning"]}
          minWidth={620}
          rows={checkins.slice(0, 28).map((row) => {
            const checkin = toCheckin(row);
            const load = sessionLoad(checkin.sessionRpe, checkin.durationMinutes);
            const readiness = readinessScore(checkin);
            return [
              formatDate(row.performed_on),
              checkin.sessionRpe === null
                ? "Vila"
                : `RPE ${sv(checkin.sessionRpe, 1)} · ${Math.round(checkin.durationMinutes ?? 0)} min`,
              load > 0 ? Math.round(load) : "–",
              readiness === null
                ? "–"
                : `${readiness} · ${readReadiness(readiness)}`,
              row.note ?? "–",
            ];
          })}
        />
      </Card>

      <CheckinForm adeptId={adeptId} existing={todaysCheckin} />
    </div>
  );
}
