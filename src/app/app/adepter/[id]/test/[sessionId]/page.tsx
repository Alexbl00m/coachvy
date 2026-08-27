import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { DataTable, ResultGrid } from "@/components/calculators/result-grid";
import { PageHeader } from "@/components/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { getAdept } from "@/lib/adepts/queries";
import { requireSessionUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { analyseSession } from "@/lib/tests/analysis";
import { protocolByKey } from "@/lib/tests/protocols";
import { getSession, toEfforts } from "@/lib/tests/session-queries";

export const metadata = { title: "Testtillfälle" };

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

const digitsFor = (unit: string) =>
  unit === "W" || unit === "m" || unit === "%" || unit === "ml/kg/min" ? 0 : unit === "kJ" ? 1 : 2;

export default async function SessionPage({
  params,
}: PageProps<"/app/adepter/[id]/test/[sessionId]">) {
  await requireSessionUser();
  const { id, sessionId } = await params;

  const [adept, session] = await Promise.all([getAdept(id), getSession(sessionId)]);
  if (!adept || !session || session.adept_id !== adept.id) notFound();

  const spec = protocolByKey(session.protocol);
  const shape = spec?.shape;

  // Zonerna räknas om ur rådatan i stället för att lagras: förbättras modellen
  // får ett gammalt test bättre zoner utan att någon rör databasen.
  const recomputed = analyseSession({
    protocol: session.protocol,
    sport: session.sport,
    unit: session.intensity_unit,
    efforts: toEfforts(session.test_efforts),
    weightKg: session.weight_kg,
  });

  const primary = session.test_metrics.filter((m) => m.is_primary);
  const secondary = session.test_metrics.filter((m) => !m.is_primary);

  return (
    <>
      <Link
        href={`${routes.adepts}/${adept.id}?vy=testtillfallen`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-subtle hover:text-text"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {adept.full_name}
      </Link>

      <PageHeader
        title={spec?.label ?? session.protocol}
        description={`${formatDate(session.performed_on)} · ${session.sport}${
          session.weight_kg ? ` · ${sv(Number(session.weight_kg), 1)} kg` : ""
        }`}
      />

      {primary.length > 0 && (
        <div className="mb-6">
          <ResultGrid
            items={primary.slice(0, 4).map((m) => ({
              label: m.key.replace("_prime", "′"),
              value: sv(Number(m.value), digitsFor(m.unit)),
              unit: m.unit,
              hint: m.method ?? undefined,
            }))}
          />
        </div>
      )}

      <div className="space-y-6">
        {session.notes && (
          <Card>
            <CardTitle>Anteckning</CardTitle>
            <p className="text-sm leading-relaxed text-text-muted">{session.notes}</p>
          </Card>
        )}

        <Card className="min-w-0">
          <CardTitle>Rådata</CardTitle>
          <DataTable
            headers={[
              "#",
              ...(shape?.intensity ? [`Belastning (${session.intensity_unit})`] : []),
              ...(shape?.duration ? ["Längd"] : []),
              ...(shape?.distance ? ["Sträcka (m)"] : []),
              ...(shape?.lactate ? ["Laktat"] : []),
              ...(shape?.heartRate ? ["Puls"] : []),
            ]}
            minWidth={480}
            rows={session.test_efforts.map((e) => [
              String(e.ordinal),
              ...(shape?.intensity
                ? [e.intensity === null ? "–" : sv(Number(e.intensity), 1)]
                : []),
              ...(shape?.duration
                ? [
                    e.duration_seconds === null
                      ? "–"
                      : `${Math.floor(Number(e.duration_seconds) / 60)}:${String(
                          Math.round(Number(e.duration_seconds) % 60),
                        ).padStart(2, "0")}`,
                  ]
                : []),
              ...(shape?.distance
                ? [e.distance_m === null ? "–" : sv(Number(e.distance_m), 0)]
                : []),
              ...(shape?.lactate
                ? [e.lactate === null ? "–" : sv(Number(e.lactate), 2)]
                : []),
              ...(shape?.heartRate ? [e.heart_rate === null ? "–" : String(e.heart_rate)] : []),
            ])}
          />
        </Card>

        {recomputed.zones.length > 0 && (
          <Card className="min-w-0">
            <CardTitle>Zoner</CardTitle>
            <DataTable
              headers={["Zon", `Spann (${recomputed.zoneUnit})`, "Vad den gör"]}
              minWidth={520}
              rows={recomputed.zones.map((z) => [
                z.zone,
                z.min === null
                  ? `< ${sv(z.max as number, 1)}`
                  : z.max === null
                    ? `> ${sv(z.min, 1)}`
                    : `${sv(z.min, 1)}–${sv(z.max, 1)}`,
                z.description,
              ])}
            />
            <p className="mt-3 text-[12px] text-text-subtle">
              Zonerna räknas om ur rådatan varje gång sidan visas. Förbättras
              modellen får det här testet bättre zoner utan att någon rör
              databasen.
            </p>
          </Card>
        )}

        {secondary.length > 0 && (
          <Card className="min-w-0">
            <CardTitle>Alla värden</CardTitle>
            <DataTable
              headers={["Storhet", "Metod", "Värde"]}
              minWidth={480}
              rows={secondary.map((m) => [
                m.key.split(":")[0].replace("_prime", "′"),
                m.method ?? "–",
                `${sv(Number(m.value), digitsFor(m.unit))} ${m.unit}`,
              ])}
            />
          </Card>
        )}
      </div>
    </>
  );
}
