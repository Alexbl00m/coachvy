/**
 * Inspelningen i en mening, innan analysen körs: längd, bildfrekvens och
 * upplösning, och om det räcker. Ren modul.
 */

import { MIN_DURATION_S } from "./chain";

export type RecordingFacts = {
  durationS: number;
  fps: number;
  width: number;
  height: number;
};

export type RecordingCheck = { ok: boolean; sentence: string };

const sv = (v: number, d = 0) => v.toFixed(d).replace(".", ",");

export function recordingCheck(r: RecordingFacts): RecordingCheck {
  const facts = `${sv(r.durationS, 1)} s, ${sv(r.fps)} bilder/s, ${r.width}×${r.height}`;
  const problems: string[] = [];
  if (r.durationS < MIN_DURATION_S)
    problems.push(
      `för kort – minst ${MIN_DURATION_S} s jämnt trampande behövs`,
    );
  if (r.fps < 24)
    problems.push("för låg bildfrekvens för att hitta nedre dödläget");
  if (Math.min(r.width, r.height) < 480)
    problems.push("för låg upplösning för att hitta lederna säkert");
  if (problems.length > 0)
    return { ok: false, sentence: `${facts}: ${problems.join(", ")}.` };
  const hints: string[] = [];
  if (r.fps < 50) hints.push("60 bilder/s ger ett säkrare nedre dödläge");
  if (r.durationS > 90)
    hints.push("ett långt klipp tar en stund att analysera");
  return {
    ok: true,
    sentence: `${facts} – går att analysera${hints.length ? `; ${hints.join(", ")}` : ""}.`,
  };
}
