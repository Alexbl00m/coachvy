import Link from "next/link";
import { FlaskConical, Plus, TrendingUp } from "lucide-react";

import { ResultGrid } from "@/components/calculators/result-grid";
import { buttonClass } from "@/components/ui/button";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { formatDate, digitsForMetric, digitsForUnit } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { Sport } from "@/lib/calculators/lactate";
import { displayValue } from "@/lib/tests/pace";
import { phaseLabel } from "@/lib/tests/phases";
import { protocolByKey } from "@/lib/tests/protocols";
import type { RollingResult } from "@/lib/tests/rolling";
import type { SessionWithMetrics } from "@/lib/tests/session-queries";

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

/** Kort namn för listan. Nycklarna är databasens, inte coachens. */
const SHORT_LABELS: Record<string, string> = {
  T_speed: "Tröskel",
  LTHR: "Tröskelpuls",
  W_prime: "W′",
  D_prime: "D′",
};
const shortLabel = (key: string) =>
  SHORT_LABELS[key] ?? key.replace("_prime", "′");

export function SessionPanel({
  adeptId,
  sessions,
  rolling,
  rollingLabel,
  rollingUnit,
  sport,
  reserveLabel,
  reserveUnit,
  canEdit,
}: {
  adeptId: string;
  sessions: SessionWithMetrics[];
  rolling: RollingResult | null;
  rollingLabel: string;
  rollingUnit: string;
  /** Grenen, så att CS kan visas som tempo i löpning och simning. */
  sport: Sport;
  reserveLabel: string;
  reserveUnit: string;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-6">
      {rolling && (
        <>
          <ResultGrid
            items={[
              (() => {
                const d = displayValue(
                  rolling.primary,
                  rollingUnit,
                  sport,
                  digitsForUnit(rollingUnit),
                );
                return {
                  label: `${rollingLabel} · rullande`,
                  value: d.value,
                  unit: d.unit,
                  hint: [
                    d.speed,
                    `senaste insats ${formatDate(rolling.latestEffort)}`,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                };
              })(),
              {
                label: reserveLabel,
                value:
                  reserveUnit === "kJ"
                    ? sv(rolling.reserve / 1000, 1)
                    : sv(rolling.reserve, 0),
                unit: reserveUnit,
                hint: `${rolling.usedEfforts.length} durationsband`,
              },
              {
                label: "Bygger på",
                value: rolling.usedEfforts.length,
                hint: rolling.usedEfforts.map((e) => e.band).join(", "),
              },
              {
                label: "Testtillfällen",
                value: sessions.length,
                hint: sessions.length > 0 ? formatDate(sessions[0].performed_on) : undefined,
              },
            ]}
          />

          {rolling.updatedByNewBest && (
            <Card>
              <div className="flex items-start gap-3">
                <TrendingUp aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
                <div>
                  <p className="text-sm font-medium text-text">
                    Nytt bästavärde sedan senaste hela testet
                  </p>
                  <p className="mt-1 text-sm text-text-muted">
                    {rollingLabel} är omräknat med en insats från{" "}
                    {formatDate(rolling.latestEffort)}. Adepten behöver inte
                    göra om testet för att siffran ska stämma.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {rolling.warnings.length > 0 && (
            <Card>
              <ul className="space-y-1.5 text-[13px] text-text-muted">
                {rolling.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardTitle
          action={
            canEdit ? (
              <Link
                href={`${routes.adepts}/${adeptId}/test/nytt`}
                className={buttonClass({ variant: "ghost", size: "sm" })}
              >
                <Plus aria-hidden className="size-4" />
                Nytt testtillfälle
              </Link>
            ) : undefined
          }
        >
          Testtillfällen
        </CardTitle>

        {sessions.length === 0 ? (
          <EmptyState
            title="Inga testtillfällen ännu"
            description="Ett testtillfälle sparar hela testet – protokollet, varje steg och alla värden det gav. Då går det att räkna om senare och följa utvecklingen."
            action={
              canEdit ? (
                <Link
                  href={`${routes.adepts}/${adeptId}/test/nytt`}
                  className={buttonClass({ size: "sm" })}
                >
                  Registrera det första
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {sessions.map((session) => {
              const spec = protocolByKey(session.protocol);
              const primary = session.test_metrics.filter((m) => m.is_primary);

              return (
                <li key={session.id}>
                  <Link
                    href={`${routes.adepts}/${adeptId}/test/${session.id}`}
                    className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5 transition-colors hover:bg-surface-2/60"
                  >
                    <FlaskConical
                      aria-hidden
                      className="size-4 shrink-0 self-center text-text-subtle group-hover:text-accent"
                    />
                    <span className="text-sm font-medium text-text">
                      {spec?.label ?? session.protocol}
                    </span>
                    <span className="text-[13px] text-text-subtle">
                      {formatDate(session.performed_on)} · {session.sport}
                    </span>
                    {phaseLabel(session.training_phase) && (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-text-muted">
                        {phaseLabel(session.training_phase)}
                      </span>
                    )}

                    <span className="ml-auto flex flex-wrap items-baseline gap-x-4 tabular-nums">
                      {primary.length === 0 ? (
                        <span className="text-[13px] text-text-subtle">
                          inga värden
                        </span>
                      ) : (
                        primary.map((m) => {
                          const d = displayValue(
                            Number(m.value),
                            m.unit,
                            session.sport,
                            digitsForMetric(m.key, m.unit),
                          );
                          return (
                            <span
                              key={m.id}
                              className="text-[13px] text-text-muted"
                            >
                              {shortLabel(m.key)}{" "}
                              <span className="font-medium text-text">
                                {d.value}
                              </span>{" "}
                              {d.unit}
                            </span>
                          );
                        })
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
