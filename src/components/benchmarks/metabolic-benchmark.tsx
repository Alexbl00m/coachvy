import Link from "next/link";

import {
  LevelChart,
  type LevelColumn,
} from "@/components/benchmarks/level-chart";
import { Card, CardTitle } from "@/components/ui/card";
import type { Sex } from "@/lib/benchmarks/coggan";
import {
  levelPosition,
  METRICS,
  type ReferenceLevels,
} from "@/lib/benchmarks/reference-levels";
import type { AdeptValues } from "@/lib/benchmarks/values";
import { routes } from "@/lib/routes";

const sv = (v: number, digits: number) => v.toFixed(digits).replace(".", ",");

/** Var mellan grupperna ett värde ligger, i ord. */
function between(position: number, names: string[]): string {
  const i = Math.floor(position + 1e-9);
  if (position < 0) return `under ${names[0]}`;
  if (position >= names.length - 1) {
    return position > names.length - 1 + 0.05
      ? `över ${names[names.length - 1]}`
      : `på ${names[names.length - 1]}`;
  }
  const frac = position - i;
  if (frac < 0.1) return `på ${names[i]}`;
  if (frac > 0.9) return `nära ${names[i + 1]}`;
  return `mellan ${names[i]} och ${names[i + 1]}`;
}

/**
 * Den metabola profilen mot referensgrupperna: adeptens senaste testvärden,
 * mått för mått, på samma höjd som grupperna.
 */
export function MetabolicBenchmark({
  adept,
  levels,
  sex,
  targetId,
  isCoach,
}: {
  adept: AdeptValues;
  levels: ReferenceLevels;
  sex: Sex;
  targetId: string | null;
  isCoach: boolean;
}) {
  const names = levels.groups.map((g) => g.name);
  const columns: LevelColumn[] = METRICS.map((metric) => {
    const found = adept.values[metric.key];
    const position = found
      ? levelPosition(found.value, levels.groups, sex, metric.key)
      : null;
    return {
      key: metric.key,
      label: metric.short,
      sublabel: metric.unit === "% av VO2max" ? "%" : metric.unit,
      position,
      value: found ? sv(found.value, metric.digits) : "",
      unit: metric.unit,
      detail:
        found && position !== null
          ? `${metric.label}: ${sv(found.value, metric.digits)} ${metric.unit} – ${between(position, names)}. ${found.source}, ${found.date}.`
          : undefined,
    };
  });
  const measured = columns.filter((c) => c.position !== null).length;
  const targetIndex = levels.groups.findIndex((g) => g.id === targetId);

  return (
    <Card className="min-w-0">
      <CardTitle>Metabol profil mot referensnivåer</CardTitle>
      {measured === 0 ? (
        <p className="text-sm text-text-muted">
          Inga cykeltester med de här måtten ännu. Ett metabolt profiltest eller
          ett stegtest med vikt ger VO2max, VLamax, tröskeln och FatMax.
        </p>
      ) : (
        <>
          <p className="max-w-3xl text-[13px] leading-relaxed text-text-subtle">
            Senaste värdet för varje mått ur cykeltesterna, mot{" "}
            {levels.isDefault
              ? "Coachvys utgångsnivåer"
              : "coachens egna nivåer"}{" "}
            för {sex === "man" ? "män" : "kvinnor"}. Watt räknas per kilo med
            vikten från samma test. Uppåt är alltid mot högre nivå – för VLamax,
            som är lägre hos uthålliga elitatleter, betyder uppåt lägre.
          </p>
          <div className="mt-4">
            <LevelChart
              levels={names}
              kind="lines"
              columns={columns}
              target={targetIndex >= 0 ? targetIndex : null}
              targetLabel={
                targetIndex >= 0 ? `Mål: ${names[targetIndex]}` : undefined
              }
              height={300}
              ariaLabel={`Metabol profil mot ${names.join(", ")}: ${columns
                .filter((c) => c.position !== null)
                .map((c) => `${c.label} ${c.value}`)
                .join("; ")}.`}
            />
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-sm whitespace-nowrap tabular-nums">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-text-muted">
                  <th className="py-2 pr-3 font-medium">Mått</th>
                  <th className="py-2 pr-3 text-right font-medium">Adepten</th>
                  {levels.groups.map((g) => (
                    <th key={g.id} className="py-2 pr-3 text-right font-medium">
                      {g.name}
                    </th>
                  ))}
                  <th className="py-2 font-medium">Ur</th>
                </tr>
              </thead>
              <tbody>
                {METRICS.map((metric) => {
                  const found = adept.values[metric.key];
                  return (
                    <tr
                      key={metric.key}
                      className="border-b border-line last:border-0"
                    >
                      <td className="py-2 pr-3 text-text-muted">
                        {metric.label}{" "}
                        <span className="text-text-subtle">{metric.unit}</span>
                      </td>
                      <td className="py-2 pr-3 text-right font-medium text-text">
                        {found ? sv(found.value, metric.digits) : "–"}
                      </td>
                      {levels.groups.map((g) => {
                        const v = g.values[sex][metric.key];
                        return (
                          <td
                            key={g.id}
                            className={
                              g.id === targetId
                                ? "py-2 pr-3 text-right text-text"
                                : "py-2 pr-3 text-right text-text-subtle"
                            }
                          >
                            {v !== undefined ? sv(v, metric.digits) : "–"}
                          </td>
                        );
                      })}
                      <td className="max-w-[14rem] truncate py-2 text-text-subtle">
                        {found ? `${found.source}, ${found.date}` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[12px] leading-relaxed text-text-subtle">
            {levels.isDefault
              ? "Utgångsnivåerna är Coachvys egna, satta ur de spann som brukar anges för uthållighetsinriktade cyklister – det finns ingen publicerad standardtabell för de här måtten. "
              : "Nivåerna är satta av coachen. "}
            {isCoach && (
              <>
                Ändra grupperna och värdena, eller lägg till en egen som svensk
                elit, under{" "}
                <Link
                  href={`${routes.settings}#referensnivaer`}
                  className="underline decoration-line-strong underline-offset-2 hover:decoration-text-subtle"
                >
                  Inställningar
                </Link>
                .
              </>
            )}
          </p>
        </>
      )}
    </Card>
  );
}
