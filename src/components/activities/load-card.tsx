import { Card, CardTitle } from "@/components/ui/card";
import { SERIES } from "@/lib/calculators/chart-colors";
import {
  loadReading,
  loadTrend,
  weeklyLoad,
  type LoadActivity,
  type LoadWeek,
} from "@/lib/activities/load";
import { isoWeek } from "@/lib/season/season";

const sv = (v: number, digits = 1) =>
  v.toFixed(digits).replace(".", ",").replace(/,0$/, "");

/**
 * En stapel per vecka, med veckans värde i hovringen och i en dold tabell.
 * Två egna diagram i stället för ett med två axlar – volym och strain har
 * olika enheter, och en dubbel y-axel är den mest vilseledande diagramformen.
 */
function WeekBars({
  weeks,
  value,
  format,
  color,
  label,
}: {
  weeks: LoadWeek[];
  value: (w: LoadWeek) => number;
  format: (v: number) => string;
  color: string;
  label: string;
}) {
  const top = Math.max(...weeks.map(value), 0);
  const last = weeks[weeks.length - 1];
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-text">{label}</p>
        <p className="text-[0.8125rem] text-text-muted tabular-nums">
          Den här veckan:{" "}
          <span className="text-text">{format(value(last))}</span>
        </p>
      </div>
      <div className="mt-2 flex h-20 items-end gap-1" aria-hidden>
        {weeks.map((w) => {
          const v = value(w);
          return (
            <span
              key={w.monday}
              title={`Vecka ${isoWeek(w.monday)}: ${format(v)}`}
              className="flex-1 rounded-t-[3px]"
              style={{
                height: `${top > 0 && v > 0 ? Math.max((v / top) * 100, 4) : 2}%`,
                background: v > 0 ? color : "var(--surface-3)",
                opacity: w === last ? 1 : 0.7,
              }}
            />
          );
        })}
      </div>
      <div
        className="mt-1 flex justify-between text-[0.75rem] text-text-subtle tabular-nums"
        aria-hidden
      >
        <span>v {isoWeek(weeks[0].monday)}</span>
        <span>v {isoWeek(last.monday)}</span>
      </div>
      <table className="sr-only">
        <caption>{label} per vecka</caption>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.monday}>
              <th scope="row">Vecka {isoWeek(w.monday)}</th>
              <td>{format(value(w))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Belastningen i två delar, de senaste tolv veckorna: volym (tid) och strain
 * (arbete över CP i W′), och vad senaste veckan säger om vad som driver den.
 */
export function LoadCard({
  activities,
  today,
}: {
  activities: LoadActivity[];
  today: string;
}) {
  if (activities.length === 0) return null;
  const weeks = weeklyLoad(activities, today, 12);
  const trend = loadTrend(activities, today);
  const reading = loadReading(trend);
  const estimated = activities.filter((a) => a.estimated).length;
  const withoutStrain = weeks.reduce((s, w) => s + w.withoutStrain, 0);

  return (
    <Card className="min-w-0">
      <CardTitle>Belastning: volym och strain</CardTitle>
      <div className="grid gap-6 md:grid-cols-2">
        <WeekBars
          weeks={weeks}
          value={(w) => w.seconds / 3600}
          format={(v) => `${sv(v)} h`}
          color={SERIES.secondary}
          label="Volym"
        />
        <WeekBars
          weeks={weeks}
          value={(w) => w.strain}
          format={(v) => `${sv(v)} W′`}
          color={SERIES.primary}
          label="Strain"
        />
      </div>

      {reading.length > 0 && (
        <div className="mt-5 space-y-1 border-t border-line pt-4 text-sm text-text">
          {reading.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}

      <p className="mt-4 text-[0.8125rem] leading-relaxed text-text-muted">
        Volym är tiden i träning. Strain är arbetet över CP (CS), räknat i W′
        (D′): 1 W′ är arbete ovanför tröskeln som motsvarar en full anaerob
        reserv. De hålls isär eftersom tre lugna timmar och en timme hårda
        intervaller kan ge samma TSS men kostar helt skilda saker.
        {estimated > 0 &&
          ` ${estimated} äldre pass har strain uppskattad ur den sparade serien, som jämnar ut korta toppar – värdet blir där något lågt.`}
        {withoutStrain > 0 &&
          ` ${withoutStrain} pass saknar CP/W′ eller CS/D′ från ett test före passet och räknas utan strain.`}
      </p>
    </Card>
  );
}
