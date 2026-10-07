/**
 * Adeptens senaste värden för den metabola jämförelsen, ur testtillfällena.
 *
 * Varje mått tas ur det senaste testet som har det. Watt räknas om till W/kg
 * med vikten *från samma test*, inte dagens: en tröskel från i våras ska
 * delas med vårens vikt. Saknar testet vikt används den senaste kända.
 *
 * Bara cykeltester: referensgrupperna är satta i watt per kilo.
 */

import type { SessionWithMetrics } from "@/lib/tests/session-queries";
import type { Sex } from "./coggan";
import type { MetricKey } from "./reference-levels";

export type FoundValue = {
  value: number;
  /** Testdagen, eller passet för sprinten ur träningen. */
  date: string;
  source: string;
};

export type AdeptValues = {
  values: Partial<Record<MetricKey, FoundValue>>;
  weightKg: number | null;
  weightDate: string | null;
  /** Kön ur profilen eller testerna. null när det inte är känt. */
  sex: Sex | null;
  /** FTP ur det senaste cykeltestet som har ett. */
  ftp: { watts: number; date: string } | null;
};

type Metric = SessionWithMetrics["test_metrics"][number];

/** Det primära värdet med nyckeln, annars det första, i rätt enhet. */
function metricIn(
  session: SessionWithMetrics,
  key: string,
  unit?: string,
): Metric | null {
  const matches = session.test_metrics.filter(
    (m) => m.key === key && (unit === undefined || m.unit === unit),
  );
  return matches.find((m) => m.is_primary) ?? matches[0] ?? null;
}

export function adeptValues(
  sessions: SessionWithMetrics[],
  options: {
    /** Kön ur adeptprofilen; "annat" och tomt räknas som okänt. */
    profileSex: string | null;
    /** Bästa 20 s ur träningen, när inget sprinttest finns. */
    trainingSprint?: { watts: number; date: string } | null;
    protocolLabel: (key: string) => string;
  },
): AdeptValues {
  const cycling = [...sessions]
    .filter((s) => s.sport === "cykling")
    .sort((a, b) => b.performed_on.localeCompare(a.performed_on));

  const weighed = cycling.find((s) => s.weight_kg !== null && s.weight_kg > 0);
  const latestWeight = weighed ? Number(weighed.weight_kg) : null;

  const values: AdeptValues["values"] = {};
  const take = (
    key: MetricKey,
    metricKey: string,
    unit: string,
    perKg: boolean,
  ) => {
    for (const s of cycling) {
      const m = metricIn(s, metricKey, unit);
      if (!m || !(Number(m.value) > 0)) continue;
      const weight =
        s.weight_kg !== null && s.weight_kg > 0
          ? Number(s.weight_kg)
          : latestWeight;
      if (perKg && !weight) return;
      values[key] = {
        value: perKg ? Number(m.value) / (weight as number) : Number(m.value),
        date: s.performed_on,
        source: options.protocolLabel(s.protocol),
      };
      return;
    }
  };

  take("vo2max", "VO2max", "ml/kg/min", false);
  take("mapPerKg", "Pmax", "W", true);
  take("vlamax", "VLamax", "mmol/l/s", false);
  take("sprintPerKg", "P_sprint", "W", true);
  take("cpPerKg", "CP", "W", true);
  take("lt2PerKg", "LT2", "W", true);
  take("fatmaxPerKg", "FatMax", "W", true);
  take("lt2Utilisation", "LT2_pct_VO2max", "%", false);

  // Utan sprinttest: det bästa på 20 s ur träningen, om det finns.
  if (!values.sprintPerKg && options.trainingSprint && latestWeight) {
    values.sprintPerKg = {
      value: options.trainingSprint.watts / latestWeight,
      date: options.trainingSprint.date,
      source: "träningen",
    };
  }

  let ftp: AdeptValues["ftp"] = null;
  for (const s of cycling) {
    const m = metricIn(s, "FTP", "W");
    if (m && Number(m.value) > 0) {
      ftp = { watts: Number(m.value), date: s.performed_on };
      break;
    }
  }

  const fromProfile =
    options.profileSex === "man" || options.profileSex === "kvinna"
      ? options.profileSex
      : null;
  const fromTests = cycling.find((s) => s.sex !== null)?.sex ?? null;

  return {
    values,
    weightKg: latestWeight,
    weightDate: weighed?.performed_on ?? null,
    sex: fromProfile ?? fromTests,
    ftp,
  };
}
