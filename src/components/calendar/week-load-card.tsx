import { DistributionBar } from "@/components/season/distribution-card";
import { Card } from "@/components/ui/card";
import type { WeekLoad } from "@/lib/calendar/week-load";
import { weekLabel } from "@/lib/calendar/week";
import { SESSION_GOALS } from "@/lib/season/distribution";
import type { WeekForm } from "@/lib/training/pmc";
import {
  distanceText,
  hoursText,
  signedText,
  tssText,
  wholeNumber,
  type LoadTotals,
} from "@/lib/workouts/load";

const GOAL_TEXT = { lugn: "lugnt", medel: "medel", hög: "högt" } as const;

/**
 * Veckans belastning bredvid kalendern: planen och det genomförda med de
 * vedertagna måtten – pass, tid, TSS, arbete och sträcka per gren – och
 * planens pass efter huvudsyfte, som filosofins avsnitt 19 räknar
 * intensitetsfördelningen. `action` är det som går att göra med veckan.
 */
export function WeekLoadCard({
  week,
  form = null,
  today,
  action = null,
}: {
  week: WeekLoad;
  /** Fitness, trötthet och form efter veckan. */
  form?: WeekForm | null;
  today: string;
  action?: React.ReactNode;
}) {
  const { planned, done, goals } = week;
  const rows: {
    label: string;
    value: (t: LoadTotals) => string | null;
  }[] = [
    {
      label: "Pass",
      value: (t) => (t.sessions > 0 ? String(t.sessions) : null),
    },
    {
      label: "Tid",
      value: (t) => (t.seconds > 0 ? hoursText(t.seconds) : null),
    },
    { label: "TSS", value: (t) => (t.tss > 0 ? tssText(t.tss) : null) },
    {
      label: "Arbete, cykel",
      value: (t) => (t.kj > 0 ? `${wholeNumber(t.kj)} kJ` : null),
    },
    {
      label: "Löpning",
      value: (t) =>
        t.metres.löpning ? distanceText(t.metres.löpning, "löpning") : null,
    },
    {
      label: "Simning",
      value: (t) =>
        t.metres.simning ? distanceText(t.metres.simning, "simning") : null,
    },
  ];
  const shown = rows.filter(
    (r) => r.value(planned) !== null || r.value(done) !== null,
  );
  const share =
    done.tss > 0 && planned.tss > 0
      ? Math.round((done.tss / planned.tss) * 100)
      : null;
  const missing = [
    planned.withoutTss > 0 && `${planned.withoutTss} planerade`,
    done.withoutTss > 0 && `${done.withoutTss} genomförda`,
  ].filter(Boolean);

  return (
    <Card className="min-w-0">
      <div className="mb-3">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.1em] text-text-muted">
          Veckan
        </p>
        <p className="mt-0.5 text-lg font-semibold text-text">
          {weekLabel(week.monday, today.slice(0, 4)).replace("v.", "Vecka")}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-text-subtle">Inget planerat eller gjort.</p>
      ) : (
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-[0.75rem] text-text-subtle">
              <th scope="col" className="pb-1 text-left font-medium">
                <span className="sr-only">Mått</span>
              </th>
              <th scope="col" className="pb-1 text-right font-medium">
                Plan
              </th>
              <th scope="col" className="pb-1 text-right font-medium">
                Gjort
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r) => (
              <tr key={r.label}>
                <th
                  scope="row"
                  className="py-1.5 text-left font-normal text-text-muted"
                >
                  {r.label}
                </th>
                <td className="py-1.5 text-right font-medium text-text">
                  {r.value(planned) ?? "–"}
                </td>
                <td className="py-1.5 text-right font-medium text-text">
                  {r.value(done) ?? "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(share !== null || missing.length > 0) && (
        <p className="mt-2 text-[0.75rem] text-text-muted">
          {share !== null && `Gjort ${share} % av planens TSS. `}
          {missing.length > 0 &&
            `Utan TSS: ${missing.join(", ")} (styrka, eller pass utan effekt, fart, puls eller steg att räkna på).`}
        </p>
      )}

      {goals.total > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="text-[0.75rem] font-medium text-text-subtle">
            Planens pass efter huvudsyfte
          </p>
          <DistributionBar counts={goals} />
          <p className="text-[0.75rem] text-text-muted">
            {SESSION_GOALS.map(
              ({ key }) => `${goals[key]} ${GOAL_TEXT[key]}`,
            ).join(" · ")}
          </p>
        </div>
      )}

      {form && (
        <div className="mt-4">
          <p className="text-[0.75rem] font-medium text-text-subtle">
            Efter veckan{form.projected ? ", med planen" : ""}
          </p>
          <dl className="mt-1.5 grid grid-cols-3 gap-2">
            {[
              { label: "Fitness", sub: "CTL", value: Math.round(form.ctl) },
              { label: "Trötthet", sub: "ATL", value: Math.round(form.atl) },
              { label: "Form", sub: "TSB", value: signedText(form.tsb) },
            ].map((x) => (
              <div key={x.sub} className="rounded-md bg-surface-2 px-2 py-1.5">
                <dt className="text-[0.6875rem] text-text-subtle">
                  {x.label} <span className="sr-only">(</span>
                  {x.sub}
                  <span className="sr-only">)</span>
                </dt>
                <dd className="text-base font-semibold text-text tabular-nums">
                  {x.value}
                </dd>
              </div>
            ))}
          </dl>
          {form.ramp !== null && (
            <p className="mt-1.5 text-[0.75rem] text-text-muted">
              Fitness {signedText(form.ramp, 1)} mot veckan före.
            </p>
          )}
        </div>
      )}

      <p className="mt-4 text-[0.6875rem] text-text-subtle">
        TSS: en timme på tröskeln är 100. Löpning räknas som rTSS, simning som
        sTSS och pass med bara puls som hrTSS. Fitness och trötthet är TSS per
        dag i snitt över 42 och 7 dagar, och formen är skillnaden mellan dem.
      </p>

      {action && <div className="mt-4 border-t border-line pt-4">{action}</div>}
    </Card>
  );
}
