/**
 * VO2max ur effekt, och hur stor del av den en tröskel utnyttjar.
 *
 * Tre ekvationer, var och en för den effekt den är framtagen ur. Att använda
 * rätt ekvation till rätt insats betyder mer än vilken av dem som är "bäst":
 *
 *   5 minuter all-out   Sitko m.fl. (2022):  16,6 + 8,87 · W/kg
 *   6 minuter all-out   ACSM:                10,8 · W/kg + 7
 *   Rampens topp        Hawley & Noakes (1992): (0,01141 · W + 0,435) l/min
 *
 * Tidigare skattade Coachvy VO2max ur CP i stället för ur insatsen. CP ligger
 * långt under effekten vid VO2max, så värdet blev 10–15 ml/kg/min för lågt:
 * 5 minuter på 465 W vid 81 kg gav 57 i stället för 67.
 *
 * Prövat mot ett uppmätt VO2max på 77,0 ml/kg/min (6,08 l/min, 79 kg) med
 * rampens topp 470 W: Hawley & Noakes ger 73,4 och ACSM 71,3. Ekvationerna
 * är snitt över testgrupper, med ett fel på runt ±5 %. Ett uppmätt VO2max går
 * alltid före.
 */

import type { IntensityUnit } from "@/lib/calculators/lactate";

export type Vo2Method =
  | "Sitko 5 min"
  | "ACSM 6 min"
  | "Hawley–Noakes"
  | "ACSM löpning";

export type Vo2Estimate = { value: number; method: Vo2Method };

/** 5 minuters all-out-effekt. Sitko, Cirer-Sastre, Corbi & López-Laval, IJSPP 2022. */
export const vo2maxFromFiveMinutes = (watts: number, kg: number) =>
  16.6 + 8.87 * (watts / kg);

/** 6 minuters all-out-effekt i ACSM:s cykelekvation. */
export const vo2maxFromSixMinutes = (watts: number, kg: number) =>
  (10.8 * watts) / kg + 7;

/** Toppeffekten i ett ramptest. Hawley & Noakes, Eur J Appl Physiol 1992. */
export const vo2maxFromRampPeak = (watts: number, kg: number) =>
  ((0.01141 * watts + 0.435) * 1000) / kg;

/**
 * Syreupptaget vid en belastning under VO2max, ml/min (absolut).
 *
 * ACSM:s ekvationer: cykel 10,8 ml per watt plus 7 ml/kg i vila och tomgång,
 * löpning 0,2 ml/kg per m/min plus 3,5. Absolut i stället för per kilo, så
 * att en tröskel och ett VO2max från tester med olika vikt går att jämföra.
 */
export function vo2AtIntensity(
  intensity: number,
  unit: IntensityUnit,
  kg: number,
): number {
  if (unit === "W") return 10.8 * intensity + 7 * kg;
  const metresPerMinute =
    unit === "km/h" ? (intensity * 1000) / 60 : intensity * 60;
  return (0.2 * metresPerMinute + 3.5) * kg;
}

/**
 * VO2max ur de maximala insatserna i ett test, med ekvationen som hör till
 * längden. 5 minuter går före 6, som går före hyperbolens 6-minut.
 */
export function vo2maxFromEfforts(
  efforts: { seconds: number; watts: number }[],
  kg: number,
  model?: { cp: number; wPrimeJoules: number },
): (Vo2Estimate & { watts: number; seconds: number }) | null {
  const near = (target: number) =>
    efforts
      .filter((e) => Math.abs(e.seconds - target) <= 30 && e.watts > 0)
      .sort((a, b) => b.watts - a.watts)[0];

  const five = near(300);
  if (five) {
    return {
      value: vo2maxFromFiveMinutes(five.watts, kg),
      method: "Sitko 5 min",
      ...five,
    };
  }
  const six = near(360);
  if (six) {
    return {
      value: vo2maxFromSixMinutes(six.watts, kg),
      method: "ACSM 6 min",
      ...six,
    };
  }
  if (model && model.cp > 0 && model.wPrimeJoules > 0) {
    const watts = model.cp + model.wPrimeJoules / 360;
    return {
      value: vo2maxFromSixMinutes(watts, kg),
      method: "ACSM 6 min",
      watts,
      seconds: 360,
    };
  }
  return null;
}

/**
 * Referensspann för utnyttjandegraden, i procent av VO2max.
 *
 * Proffs ligger i övre delen, tävlande motionärer i den undre. LT1 i procent
 * av LT2 skiljer sig mellan grenarna: på cykeln ligger den aeroba tröskeln
 * lägre i förhållande till den anaeroba än i löpningen.
 */
export const UTILISATION_RANGES = {
  LT1: {
    from: 65,
    to: 75,
    note: "tävlande motionär 65–70 %, proffs runt 75 %",
  },
  LT2: { from: 75, to: 90, note: "tävlande motionär 75–85 %, proffs 80–90 %" },
  LT1_of_LT2: {
    cykling: { from: 55, to: 75 },
    löpning: { from: 75, to: 85 },
    simning: { from: 75, to: 85 },
  },
} as const;
