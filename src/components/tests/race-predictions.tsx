import { DataTable } from "@/components/calculators/result-grid";
import { Card, CardTitle } from "@/components/ui/card";
import { formatDuration, formatPacePerKm } from "@/lib/calculators/time";

export type PredictionRow = {
  label: string;
  metres: number;
  seconds: number;
  /** Utanför modellens giltiga spann – visas, men markerat. */
  uncertain?: boolean;
};

/**
 * Loppprognoser som tabell: distans, tid, tempo.
 *
 * En prognos är modellens svar på "om allt går som testet" – inte ett mål
 * att träna mot. Rader utanför modellens spann står kvar men markeras, så
 * att coachen ser var den tar slut i stället för att den tyst fortsätter.
 */
export function RacePredictionsCard({
  title,
  source,
  rows,
  note,
}: {
  title: string;
  /** Vad prognosen bygger på, t.ex. "VDOT 51,3 (Daniels)". */
  source: string;
  rows: PredictionRow[];
  note?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <Card className="min-w-0">
      <CardTitle>{title}</CardTitle>
      <p className="mb-3 text-[13px] text-text-muted">{source}</p>
      <DataTable
        headers={["Distans", "Tid", "Tempo"]}
        minWidth={360}
        rows={rows.map((r) => [
          r.uncertain ? `${r.label} *` : r.label,
          formatDuration(r.seconds),
          `${formatPacePerKm(r.metres / r.seconds)}/km`,
        ])}
      />
      {(note || rows.some((r) => r.uncertain)) && (
        <p className="mt-3 text-[12px] leading-relaxed text-text-subtle">
          {rows.some((r) => r.uncertain) && "* Utanför modellens säkra spann. "}
          {note}
        </p>
      )}
    </Card>
  );
}
