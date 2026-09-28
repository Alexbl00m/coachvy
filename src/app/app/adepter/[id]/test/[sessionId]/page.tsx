import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { DataTable, ResultGrid } from "@/components/calculators/result-grid";
import { PageHeader } from "@/components/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { getAdept } from "@/lib/adepts/queries";
import { requireSessionUser } from "@/lib/auth/session";
import { formatDate, digitsForMetric } from "@/lib/format";
import { routes } from "@/lib/routes";
import { analyseSessionOnServer } from "@/lib/tests/metabolic-profile";
import { racePredictions, toMetresPerSecond } from "@/lib/tests/analysis";
import { timeFromVdot } from "@/lib/calculators/daniels";
import { STANDARD_DISTANCES } from "@/lib/calculators/race-prediction";
import { RacePredictionsCard } from "@/components/tests/race-predictions";
import { ZonesCard } from "@/components/tests/zones-card";
import { bikeThresholds } from "@/lib/calculators/bike-speed";
import { displayValue } from "@/lib/tests/pace";
import { formatDuration } from "@/lib/calculators/time";
import { protocolByKey } from "@/lib/tests/protocols";
import { getSession, toEfforts } from "@/lib/tests/session-queries";

export const metadata = { title: "Testtillfälle" };

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

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
  const recomputed = analyseSessionOnServer({
    protocol: session.protocol,
    sport: session.sport,
    unit: session.intensity_unit,
    efforts: toEfforts(session.test_efforts),
    weightKg: session.weight_kg,
    bodyFatPct: session.body_fat_pct != null ? Number(session.body_fat_pct) : null,
    sex: session.sex ?? null,
    finish: {
      peakIntensity: session.peak_intensity != null ? Number(session.peak_intensity) : null,
      vo2max: session.vo2max != null ? Number(session.vo2max) : null,
      peakLactate: session.peak_lactate != null ? Number(session.peak_lactate) : null,
      peakHeartRate: session.peak_heart_rate != null ? Number(session.peak_heart_rate) : null,
    },
  }, {
    // Medlemsdelarna räknas om när testet sparades med dem – det är vad som
    // betalades för då, oavsett vem som tittar nu.
    members: session.test_metrics.some((m) => m.key === "VLamax"),
  });

  /**
   * Storheten med ord i stället för sin databasnyckel.
   *
   * `test_metrics` sparar bara nyckeln – etiketten hör till beräkningen och
   * skulle bli inaktuell i databasen så fort en formulering ändrades. Den
   * hämtas därför ur omräkningen, som ändå görs för zonerna. Nyckeln står
   * kvar som nödfallsutväg för värden en nyare modell inte längre räknar ut.
   */
  const labels = new Map(recomputed.metrics.map((m) => [m.key, m.label]));
  const labelFor = (key: string) =>
    labels.get(key) ?? key.split(":")[0].replace("_prime", "′");


  // Insatser från flera dagar, och maxpuls ur cykeldatorns fil, visas bara
  // när testet har dem.
  const hasDates = session.test_efforts.some((e) => e.performed_on !== null);
  const hasMaxHr = session.test_efforts.some((e) => e.heart_rate_max !== null);
  const hasComments = session.test_efforts.some((e) => e.comment);
  // Tempo per rad för tester med tid och sträcka – löpning och simning.
  const showPace = Boolean(shape?.duration && shape?.distance);

  // Loppprognoser: ur VDOT för löptesterna, ur CS och D′ för CS-testerna.
  const valueOf = (key: string) => {
    const found = session.test_metrics.find((m) => m.key === key);
    return found ? Number(found.value) : null;
  };
  const vdot = valueOf("VDOT");
  const cs = valueOf("CS");
  const dPrime = valueOf("D_prime");
  const vdotRows =
    session.sport === "löpning" && vdot
      ? STANDARD_DISTANCES.flatMap((d) => {
          const seconds = timeFromVdot(vdot, d.metres);
          // Daniels ekvationer gäller från ungefär 3,5 minuter.
          return seconds
            ? [
                {
                  label: d.label,
                  metres: d.metres,
                  seconds,
                  uncertain: seconds < 210,
                },
              ]
            : [];
        })
      : [];
  const csRows =
    session.sport === "löpning" && cs && dPrime !== null
      ? racePredictions(
          toMetresPerSecond(cs, session.intensity_unit),
          dPrime,
          STANDARD_DISTANCES.filter((d) => d.metres <= 10000),
        ).map((r) => ({ ...r, uncertain: r.beyondModel }))
      : [];

  const shown = (m: { key: string; value: number | string; unit: string }) =>
    displayValue(
      Number(m.value),
      m.unit,
      session.sport,
      digitsForMetric(m.key, m.unit),
    );
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
        }${
          session.body_fat_pct != null
            ? ` · ${sv(Number(session.body_fat_pct), 1)} % kroppsfett`
            : ""
        }`}
      />

      {primary.length > 0 && (
        <div className="mb-6">
          <ResultGrid
            items={primary.slice(0, 4).map((m) => {
              const d = shown(m);
              return {
                label: labelFor(m.key),
                value: d.value,
                unit: d.unit,
                hint:
                  [d.speed, m.method].filter(Boolean).join(" · ") || undefined,
              };
            })}
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
              ...(shape?.intensity
                ? [`Belastning (${session.intensity_unit})`]
                : []),
              ...(shape?.duration
                ? [
                    // Formatet i parentes hör till inmatningen, inte visningen.
                    spec?.columnLabels?.duration?.replace(/\s*\(.*\)$/, "") ??
                      "Längd",
                  ]
                : []),
              ...(shape?.distance
                ? [spec?.columnLabels?.distance ?? "Sträcka (m)"]
                : []),
              ...(showPace
                ? [session.sport === "simning" ? "Tempo /100 m" : "Tempo /km"]
                : []),
              ...(shape?.lactate ? ["Laktat"] : []),
              ...(shape?.heartRate ? ["Puls"] : []),
              ...(hasMaxHr ? ["Maxpuls"] : []),
              ...(hasDates ? ["Datum"] : []),
              ...(hasComments ? ["Kommentar"] : []),
            ]}
            minWidth={480}
            rows={session.test_efforts.map((e, index) => [
              // Raderna räknas från 1; i ett stegtest är steg 0 vilovärdet.
              shape?.lactate ? String(e.ordinal) : String(index + 1),
              ...(shape?.intensity
                ? [e.intensity === null ? "–" : sv(Number(e.intensity), 1)]
                : []),
              ...(shape?.duration
                ? [
                    e.duration_seconds === null
                      ? "–"
                      : formatDuration(Number(e.duration_seconds)),
                  ]
                : []),
              ...(shape?.distance
                ? [e.distance_m === null ? "–" : sv(Number(e.distance_m), 0)]
                : []),
              ...(showPace
                ? [
                    e.duration_seconds && e.distance_m
                      ? formatDuration(
                          (Number(e.duration_seconds) / Number(e.distance_m)) *
                            (session.sport === "simning" ? 100 : 1000),
                        )
                      : "–",
                  ]
                : []),
              ...(shape?.lactate
                ? [e.lactate === null ? "–" : sv(Number(e.lactate), 2)]
                : []),
              ...(shape?.heartRate
                ? [e.heart_rate === null ? "–" : String(e.heart_rate)]
                : []),
              ...(hasMaxHr
                ? [e.heart_rate_max === null ? "–" : String(e.heart_rate_max)]
                : []),
              ...(hasDates
                ? [formatDate(e.performed_on ?? session.performed_on)]
                : []),
              ...(hasComments ? [e.comment ?? ""] : []),
            ])}
          />
        </Card>

        <ZonesCard
          zones={recomputed.zones}
          zoneUnit={recomputed.zoneUnit}
          sport={session.sport}
          weightKg={session.weight_kg === null ? null : Number(session.weight_kg)}
          thresholds={bikeThresholds(session.test_metrics)}
          note="Zonerna räknas om ur rådatan varje gång sidan visas. Förbättras modellen får det här testet bättre zoner utan att någon rör databasen."
        />

        {vdotRows.length > 0 && (
          <RacePredictionsCard
            title="Loppprognos"
            source={`Ur VDOT ${sv(vdot as number, 1)} med Daniels ekvationer – vad testet motsvarar på andra distanser, med samma träningsstatus och jämn fart.`}
            rows={vdotRows}
            note="Längre lopp förutsätter att distansen är tränad. Den egna fartprofilen i Progression tar hänsyn till hur atleten faktiskt tappar fart."
          />
        )}
        {csRows.length > 0 && (
          <RacePredictionsCard
            title="Loppprognos ur CS och D′"
            source="t = (d − D′) / CS. Modellen gäller ungefär 2–20 minuter."
            rows={csRows}
          />
        )}

        {/* Varningarna räknas om som zonerna. Ett test med en för lugn
            6-minut eller en VLamax utanför referensdatan ska säga det också
            när det öppnas om en månad, inte bara medan det skrevs in. */}
        {recomputed.warnings.length > 0 && (
          <Card>
            <CardTitle>Att veta om resultatet</CardTitle>
            <ul className="space-y-2 text-sm leading-relaxed text-text-muted">
              {recomputed.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Card>
        )}

        {secondary.length > 0 && (
          <Card className="min-w-0">
            <CardTitle>Alla värden</CardTitle>
            <DataTable
              headers={["Storhet", "Metod", "Värde"]}
              minWidth={480}
              rows={secondary.map((m) => [
                labelFor(m.key),
                m.method ?? "–",
                (() => {
                  const d = shown(m);
                  return d.speed
                    ? `${d.value} ${d.unit} (${d.speed})`
                    : `${d.value} ${d.unit}`;
                })(),
              ])}
            />
          </Card>
        )}
      </div>
    </>
  );
}
