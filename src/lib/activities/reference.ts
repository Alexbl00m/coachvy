/**
 * Tröskelvärdena ett pass eller lopp läses mot.
 *
 * Ett lopp i juli ska jämföras med vårens test, inte med ett test som togs
 * efteråt – och inte med dagens värden när det öppnas nästa år. Därför väljs
 * varje värde ur det senaste testet på eller före loppdagen, och bara om inget
 * sådant finns ur det närmaste efter. Värdena kan komma ur olika tester: FTP
 * ur ett 20-minuterstest, CP och W′ ur ett CP-test.
 *
 * Ren modul, så att uppladdningen i webbläsaren kan välja när filen lästs och
 * datumet är känt.
 */

import type { ActivitySport, Reference } from "./analysis";

/** Ett testtillfälles primärvärden, som sidan skickar med. */
export type ReferenceCandidate = {
  performedOn: string;
  sport: string;
  label: string;
  metrics: { key: string; value: number; unit: string }[];
};

type Found = { value: number; source: string; performedOn: string };

function pick(
  candidates: ReferenceCandidate[],
  date: string,
  key: string,
  convert: (value: number, unit: string) => number | null,
): Found | null {
  const hits = candidates
    .map((c) => {
      const m = c.metrics.find((x) => x.key === key);
      const value = m ? convert(Number(m.value), m.unit) : null;
      return value !== null && value > 0
        ? {
            value,
            source: `${c.label} ${c.performedOn}`,
            performedOn: c.performedOn,
          }
        : null;
    })
    .filter((x): x is Found => x !== null);
  const before = hits
    .filter((h) => h.performedOn <= date)
    .sort((a, b) => b.performedOn.localeCompare(a.performedOn));
  if (before[0]) return before[0];
  return (
    hits.sort((a, b) => a.performedOn.localeCompare(b.performedOn))[0] ?? null
  );
}

const watts = (v: number, unit: string) => (unit === "W" ? v : null);
const joules = (v: number, unit: string) =>
  unit === "kJ" ? v * 1000 : unit === "J" ? v : null;
const mps = (v: number, unit: string) =>
  unit === "m/s" ? v : unit === "km/h" ? v / 3.6 : null;
const metres = (v: number, unit: string) => (unit === "m" ? v : null);
const bpm = (v: number, unit: string) => (unit === "slag/min" ? v : null);

export function pickReference(
  all: ReferenceCandidate[],
  date: string,
  sport: ActivitySport,
): Reference {
  const candidates = all.filter((c) => c.sport === sport);
  const ftp =
    pick(candidates, date, "FTP", watts) ??
    pick(candidates, date, "CP", watts) ??
    pick(candidates, date, "LT2", watts);
  const cp = pick(candidates, date, "CP", watts);
  const wPrime = pick(candidates, date, "W_prime", joules);
  const cs = sport === "löpning" ? pick(candidates, date, "CS", mps) : null;
  const dPrime =
    sport === "löpning" ? pick(candidates, date, "D_prime", metres) : null;
  const lthr = pick(candidates, date, "LTHR", bpm);

  const dates = [ftp, cp, cs, lthr]
    .filter((x): x is Found => x !== null)
    .map((x) => x.performedOn)
    .sort();

  return {
    ftp: sport === "cykling" ? (ftp?.value ?? null) : null,
    ftpSource: sport === "cykling" && ftp ? ftp.source : null,
    cp: cp?.value ?? null,
    wPrime: cp && wPrime ? wPrime.value : null,
    cs: cs?.value ?? null,
    dPrime: cs && dPrime ? dPrime.value : null,
    lthr: lthr?.value ?? null,
    testedOn: dates[dates.length - 1] ?? null,
  };
}

/** Testtillfällenas primärvärden som kandidater, med protokollets namn. */
export function candidatesFrom(
  sessions: {
    performed_on: string;
    sport: string;
    protocol: string;
    test_metrics: {
      key: string;
      value: number;
      unit: string;
      is_primary: boolean;
    }[];
  }[],
  labelOf: (protocol: string) => string,
): ReferenceCandidate[] {
  return sessions
    .map((s) => ({
      performedOn: s.performed_on,
      sport: s.sport,
      label: labelOf(s.protocol),
      metrics: s.test_metrics
        .filter((m) => m.is_primary)
        .map((m) => ({ key: m.key, value: Number(m.value), unit: m.unit })),
    }))
    .filter((c) => c.metrics.length > 0);
}
