/**
 * Pacing: hur jämnt ett test eller lopp sprangs.
 *
 * Samma slutfart kan komma ur ett jämnt lopp och ur ett som gick för hårt ut
 * och föll ihop, och de säger olika saker. Det jämna loppet visar vad atleten
 * klarar. Det ojämna underskattar det – och visar att farten i början är värd
 * att träna på.
 *
 * Underlaget är varven: tid och sträcka per varv (en kilometer, ett
 * banvarv, fem minuter – vad som helst som delar upp loppet).
 *
 *   Split          Andra halvans tid mot första, halvorna delade på sträcka.
 *                  Positivt = långsammare andra halva.
 *   Variation      Variationskoefficienten för varvens fart, viktad med
 *                  varvens längd. Ett sista kortare varv räknas med sin längd.
 *   Start / slut   Första och sista varvets fart mot snittet.
 */

export type Lap = {
  seconds: number;
  metres: number;
  heartRate?: number | null;
};

export type PacingLabel =
  | "Jämn"
  | "Negativ split"
  | "Positiv split"
  | "För hård start"
  | "Ojämn";

export type Pacing = {
  totalSeconds: number;
  totalMetres: number;
  /** Snittfart, m/s. */
  speed: number;
  /** Andra halvans tid mot första, %. Positivt = långsammare andra halva. */
  splitPct: number;
  /** Variationskoefficient för varvens fart, %. */
  cvPct: number;
  /** Första varvets fart mot snittet, %. Positivt = snabbare. */
  firstLapPct: number;
  /** Sista varvets fart mot snittet, %. Positivt = snabbare. */
  lastLapPct: number;
  label: PacingLabel;
  /** En mening för coachen, med siffrorna i. */
  text: string;
};

const sv = (value: number, digits = 1) =>
  Math.abs(value).toFixed(digits).replace(".", ",");

/** Tiden då sträckan `at` passerades, linjärt inom varvet. */
function timeAtDistance(laps: Lap[], at: number): number {
  let metres = 0;
  let seconds = 0;
  for (const lap of laps) {
    if (metres + lap.metres >= at) {
      return seconds + ((at - metres) / lap.metres) * lap.seconds;
    }
    metres += lap.metres;
    seconds += lap.seconds;
  }
  return seconds;
}

export function analysePacing(input: Lap[]): Pacing | null {
  const laps = input.filter((l) => l.seconds > 0 && l.metres > 0);
  if (laps.length < 2) return null;

  const totalSeconds = laps.reduce((s, l) => s + l.seconds, 0);
  const totalMetres = laps.reduce((s, l) => s + l.metres, 0);
  const speed = totalMetres / totalSeconds;

  const firstHalf = timeAtDistance(laps, totalMetres / 2);
  const secondHalf = totalSeconds - firstHalf;
  const splitPct = ((secondHalf - firstHalf) / firstHalf) * 100;

  // Viktad variationskoefficient: ett 200-metersvarv sist ska inte väga lika
  // tungt som en hel kilometer.
  const speeds = laps.map((l) => l.metres / l.seconds);
  const variance =
    laps.reduce((s, l, i) => s + l.metres * (speeds[i] - speed) ** 2, 0) /
    totalMetres;
  const cvPct = (Math.sqrt(variance) / speed) * 100;

  const firstLapPct = (speeds[0] / speed - 1) * 100;
  const lastLapPct = (speeds[speeds.length - 1] / speed - 1) * 100;

  let label: PacingLabel;
  if (splitPct < -1.5) label = "Negativ split";
  else if (splitPct > 1.5)
    label = firstLapPct > 3 ? "För hård start" : "Positiv split";
  else label = cvPct <= 3 ? "Jämn" : "Ojämn";

  const parts: string[] = [];
  if (label === "Jämn") {
    parts.push(
      `Jämnt sprunget: halvorna skiljer ${sv(splitPct)} % och farten varierar ${sv(cvPct)} % mellan varven.`,
    );
  } else if (label === "Negativ split") {
    parts.push(
      `Negativ split: andra halvan ${sv(splitPct)} % snabbare än första.`,
    );
  } else if (label === "För hård start") {
    parts.push(
      `För hård start: första varvet ${sv(firstLapPct)} % snabbare än snittet, och andra halvan ${sv(splitPct)} % långsammare än första. Farten i början betalades på slutet – med jämnare fördelning hade tiden troligen blivit bättre.`,
    );
  } else if (label === "Positiv split") {
    parts.push(
      `Positiv split: andra halvan ${sv(splitPct)} % långsammare än första.`,
    );
  } else {
    parts.push(
      `Ojämnt: halvorna lika snabba, men farten varierar ${sv(cvPct)} % mellan varven.`,
    );
  }
  if (lastLapPct > 3) {
    parts.push(
      `Spurt på slutet: sista varvet ${sv(lastLapPct)} % snabbare än snittet – det fanns mer att ge tidigare.`,
    );
  }

  return {
    totalSeconds,
    totalMetres,
    speed,
    splitPct,
    cvPct,
    firstLapPct,
    lastLapPct,
    label,
    text: parts.join(" "),
  };
}
