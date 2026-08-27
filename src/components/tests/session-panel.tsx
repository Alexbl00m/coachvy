import Link from "next/link";
import { FlaskConical, Plus, TrendingUp } from "lucide-react";

import { ResultGrid } from "@/components/calculators/result-grid";
import { buttonClass } from "@/components/ui/button";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { protocolByKey } from "@/lib/tests/protocols";
import type { RollingResult } from "@/lib/tests/rolling";
import type { SessionWithMetrics } from "@/lib/tests/session-queries";

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

/** Hur många decimaler ett värde tål, efter enhet. */
function digitsFor(unit: string): number {
  if (unit === "W" || unit === "m" || unit === "%" || unit === "ml/kg/min") return 0;
  if (unit === "kJ" || unit === "km/h" || unit === "W/kg") return 1;
  return 2;
}

export function SessionPanel({
  adeptId,
  sessions,
  rolling,
  rollingLabel,
  rollingUnit,
  reserveLabel,
  reserveUnit,
  canEdit,
}: {
  adeptId: string;
  sessions: SessionWithMetrics[];
  rolling: RollingResult | null;
  rollingLabel: string;
  rollingUnit: string;
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
              {
                label: `${rollingLabel} · rullande`,
                value: sv(rolling.primary, digitsFor(rollingUnit)),
                unit: rollingUnit,
                hint: `senaste insats ${formatDate(rolling.latestEffort)}`,
              },
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

                    <span className="ml-auto flex flex-wrap items-baseline gap-x-4 tabular-nums">
                      {primary.length === 0 ? (
                        <span className="text-[13px] text-text-subtle">
                          inga värden
                        </span>
                      ) : (
                        primary.map((m) => (
                          <span key={m.id} className="text-[13px] text-text-muted">
                            {m.key.replace("_prime", "′")}{" "}
                            <span className="font-medium text-text">
                              {sv(Number(m.value), digitsFor(m.unit))}
                            </span>{" "}
                            {m.unit}
                          </span>
                        ))
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
