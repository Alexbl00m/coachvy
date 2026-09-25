import type { VlamaxSample } from "@/lib/types/database";

/**
 * Den inbyggda referensdatan: atleter där VLamax bestämts i en extern metabol
 * profilering.
 *
 * Den ligger i koden och inte i databasen av två skäl. Testprotokollen räknar
 * i webbläsaren – också på den publika sidan, där en anonym besökare inte får
 * läsa tabellen – och då måste datan finnas där modellen körs. Och den hör
 * ihop med modellens form: när formen byttes från fem variabler till sprint
 * per kilo fettfri massa var det den här datan valet prövades mot. Ligger de
 * i samma commit går det att se vad som validerades mot vad.
 *
 * Coachens egna mätningar ligger kvar i `vlamax_samples` och läggs till ovanpå.
 *
 * Toppeffekt finns för de första tretton men används inte längre av modellen.
 * Den sparas för att ett senare modellval ska kunna prövas mot den.
 */

type Row = [
  label: string,
  sex: "man" | "kvinna",
  weightKg: number,
  bodyFatPct: number,
  heightCm: number | null,
  age: number | null,
  sprintSeconds: number,
  wattAvg: number,
  wattPeak: number | null,
  vlamax: number,
];

const ROWS: Row[] = [
  // Ursprungliga tretton, ur vlamax_calc_app.
  ["Athlet 1", "man", 77.4, 14, 186.5, 18, 19, 649, 810, 0.42],
  ["Athlet 2", "man", 78.5, 13, 186.5, 17, 19, 649, 763, 0.43],
  ["Athlet 3", "man", 57.8, 14, 170, 18, 20, 664, 973, 0.61],
  ["Athlet 4", "man", 68, 10, 172, 36, 21, 700, 821, 0.51],
  ["Athlet 5", "man", 68, 11, 172, 37, 20, 719, 945, 0.56],
  ["Athlet 6", "man", 56.3, 13.5, 165, 18, 20, 532, 666, 0.45],
  ["Athlet 7", "man", 104.2, 30, 181, 30, 20, 642, 1002, 0.38],
  ["Athlet 8", "man", 67.5, 13, 185, 18, 20, 864, 993, 0.73],
  ["Athlet 9", "man", 71, 10, 165, 35, 21, 601, 872, 0.44],
  ["Athlet 10", "man", 67.4, 12, 172, 37, 19, 670, 931, 0.5],
  ["Athlet 11", "man", 69.5, 13, 172, 38, 22, 691, 1013, 0.57],
  ["Athletin 1", "kvinna", 56, 14, 164, 42, 23, 405, 616, 0.39],
  ["Athletin 2", "kvinna", 59, 14, 165, 42, 21, 416, 579, 0.41],

  // Tre profileringsrapporter från 2020–2021, anonymiserade som de ovan.
  // Sprintlängden är den exakta ur rapportens testdata, inte den nominella:
  // 17 s för Athlet 14, inte 20. Athlet 14 är också den som vidgade spannet –
  // tyngst och starkast i sprinten av alla, och den som fick modellen bytt.
  ["Athlet 12", "man", 77, 12, 181, null, 20, 776, null, 0.55],
  ["Athlet 13", "man", 78, 14, 179, null, 19, 638, null, 0.37],
  ["Athlet 14", "man", 85, 12, 192, null, 17, 1047, null, 0.6],
];

export const BUILT_IN_SAMPLES: VlamaxSample[] = ROWS.map(
  ([label, sex, weight, fat, height, age, seconds, avg, peak, vlamax], i) => ({
    id: `inbyggd-${i + 1}`,
    coach_id: null,
    label,
    sex,
    weight_kg: weight,
    body_fat_pct: fat,
    height_cm: height,
    age,
    sprint_seconds: seconds,
    watt_avg: avg,
    watt_peak: peak,
    vlamax,
    created_at: "2026-09-25T00:00:00Z",
    updated_at: "2026-09-25T00:00:00Z",
  }),
);

/** Inbyggda rader plus coachens egna. Egna rader med null-coach ignoreras. */
export function withBuiltIn(own: VlamaxSample[]): VlamaxSample[] {
  return [...BUILT_IN_SAMPLES, ...own.filter((s) => s.coach_id !== null)];
}
