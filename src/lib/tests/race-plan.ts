/**
 * Tävlingsplan: måltid till splits, med D′ som budget.
 *
 * Ur runner-metrics-calculator: jämn eller negativ split, sträcka för
 * sträcka. Originalet lät tiden per delsträcka glida linjärt från x %
 * långsammare till y % snabbare än snittet, och med olika x och y hamnade
 * sluttiden fel – 10 % långsammare start och 5 % snabbare slut gav 2,5 %
 * över måltiden. Här skiljer halvornas tider x %, och sluttiden ligger fast:
 * T₁ = T / (2 + s), T₂ = T₁·(1 + s).
 *
 * Med CS och D′ läggs en budget ovanpå. Allt över CS kostar D′ – (v − CS)
 * meter per sekund – och när den är slut säger modellen att farten inte går
 * att hålla. Återhämtning under CS räknas inte: i ett lopp är den liten, och
 * en plan som bara håller tack vare den är för tunn.
 *
 * Utan återhämtning summerar kostnaden till D − CS·T så länge hela loppet
 * går över CS, hur farten än fördelas. Den snabbaste sluttid D′ räcker till
 * är alltså (D − D′) / CS, och jämn fart är den fördelning som når den. En
 * plan som tömmer D′ är därför antingen för snabb, eller ojämn så att en del
 * springs under CS utan att det ger något tillbaka – noten säger vilket.
 */

import { formatDuration } from "@/lib/calculators/time";

export type Strategy = "jämn" | "negativ" | "positiv";

export type PlanInput = {
  metres: number;
  targetSeconds: number;
  strategy: Strategy;
  /** Skillnaden mellan halvorna i %, för negativ och positiv split. */
  splitPct: number;
  /** Varvlängd: 1 000 m, eller 400 m för banlopp. */
  lapMetres: number;
  /** Critical speed i m/s och D′ i meter, när de finns. */
  cs?: number | null;
  dPrime?: number | null;
};

export type PlanLap = {
  /** Sträcka vid varvets slut, meter. */
  toMetres: number;
  lapMetres: number;
  seconds: number;
  cumulative: number;
  /** Snittfart i varvet, m/s. */
  speed: number;
  /** D′ kvar vid varvets slut, meter. null utan CS. */
  dPrimeLeft: number | null;
};

export type Plan = {
  laps: PlanLap[];
  halves: [number, number];
  /** Snittfarten i procent av CS. */
  percentOfCs: number | null;
  /** Sträckan där D′ tar slut, om den gör det. */
  depletedAt: number | null;
  /** Snabbaste hela sekund D′ räcker till, med jämn fart. null utan CS. */
  csLimit: number | null;
  dPrimeUsedPct: number | null;
  notes: string[];
};

export function racePlan(input: PlanInput): Plan | null {
  const { metres, targetSeconds, lapMetres } = input;
  if (!(metres > 0) || !(targetSeconds > 0) || !(lapMetres > 0)) return null;

  const s =
    input.strategy === "jämn"
      ? 0
      : ((input.strategy === "negativ" ? -1 : 1) * Math.abs(input.splitPct)) /
        100;
  const firstHalf = targetSeconds / (2 + s);
  const secondHalf = targetSeconds - firstHalf;
  const v1 = metres / 2 / firstHalf;
  const v2 = metres / 2 / secondHalf;

  const cs = input.cs && input.cs > 0 ? input.cs : null;
  const dPrime = cs && input.dPrime && input.dPrime > 0 ? input.dPrime : null;
  let left = dPrime;
  let depletedAt: number | null = null;

  const laps: PlanLap[] = [];
  let at = 0;
  let cumulative = 0;
  while (at < metres - 0.5) {
    const to = Math.min(metres, at + lapMetres);
    // Den del av varvet som ligger i första respektive andra halvan.
    const inFirst = Math.max(0, Math.min(to, metres / 2) - at);
    const inSecond = to - at - inFirst;
    const seconds = inFirst / v1 + inSecond / v2;

    if (left !== null && cs !== null) {
      const cost =
        (inFirst / v1) * Math.max(v1 - cs, 0) +
        (inSecond / v2) * Math.max(v2 - cs, 0);
      if (depletedAt === null && cost > left + 1e-6) {
        // Var i varvet tar den slut? Linjärt inom varvet räcker.
        depletedAt = Math.round(at + ((to - at) * left) / cost);
      }
      left -= cost;
    }

    cumulative += seconds;
    laps.push({
      toMetres: to,
      lapMetres: to - at,
      seconds,
      cumulative,
      speed: (to - at) / seconds,
      dPrimeLeft: left === null ? null : Math.max(left, 0),
    });
    at = to;
  }

  const notes: string[] = [];
  const average = metres / targetSeconds;
  const percentOfCs = cs ? (average / cs) * 100 : null;
  const dPrimeUsedPct =
    dPrime !== null && left !== null
      ? Math.min(((dPrime - left) / dPrime) * 100, 999)
      : null;

  // Uppåt till hel sekund, så att den tid noten visar också håller.
  const csLimit =
    cs !== null && dPrime !== null && metres > dPrime
      ? Math.ceil((metres - dPrime) / cs)
      : null;

  if (depletedAt !== null) {
    // På sista 100 metrarna blir "efter 5,0 km" i ett 5 km-lopp obegripligt.
    const where =
      Math.round(depletedAt / 100) >= Math.round(metres / 100)
        ? `D′ tar slut ${Math.round(metres - depletedAt)} m före mål.`
        : `D′ tar slut efter ${(depletedAt / 1000).toFixed(1).replace(".", ",")} km.`;
    notes.push(
      csLimit !== null && targetSeconds < csLimit
        ? `${where} Med den här CS och D′ räcker den hela vägen först på ${formatDuration(csLimit)} – snabbare än så håller ingen fördelning av farten, enligt modellen.`
        : `${where} Med jämn fart räcker den hela vägen på samma sluttid – det är fördelningen, inte måltiden, som inte håller.`,
    );
  } else if (dPrimeUsedPct !== null && dPrimeUsedPct > 0) {
    notes.push(
      `Planen använder ${Math.round(dPrimeUsedPct)} % av D′. ${
        dPrimeUsedPct >= 97
          ? "Den ligger på gränsen och lämnar inget till en slutspurt."
          : dPrimeUsedPct > 85
            ? "Nära gränsen – det finns lite kvar till en slutspurt."
            : "Det som blir kvar räcker till en spurt på slutet."
      }`,
    );
  }
  if (percentOfCs !== null && metres >= 40000) {
    notes.push(
      `Snittfarten är ${Math.round(percentOfCs)} % av CS. Maratonlöpare håller i snitt 85 % av sin CS, och snabbare löpare en högre andel (Smyth & Muniz-Pumares 2020).`,
    );
  } else if (percentOfCs !== null && percentOfCs < 100 && metres >= 10000) {
    notes.push(
      `Snittfarten är ${Math.round(percentOfCs)} % av CS – under CS kostar farten ingen D′.`,
    );
  }
  if (input.strategy === "positiv") {
    notes.push(
      "Positiv split är sällan en plan värd att välja – den är vad som händer när starten går för fort. Visas här för att se vad den kostar.",
    );
  }

  return {
    laps,
    halves: [firstHalf, secondHalf],
    percentOfCs,
    depletedAt,
    csLimit,
    dPrimeUsedPct,
    notes,
  };
}
