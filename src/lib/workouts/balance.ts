/**
 * W′bal – hur mycket av den anaeroba reserven som är kvar, sekund för sekund.
 *
 * Det här är vad som skiljer ett genererat pass från en text som ser ut som
 * ett pass. Coachvy har atletens *mätta* CP och W′ ur testtillfällena, så
 * frågan "räcker reserven till det här passet?" har ett riktigt svar i stället
 * för en gissning.
 *
 * Modellen är differentialformen (Skiba, Clarke, Vanhatalo & Jones 2014), som
 * bygger på Froncionis omskrivning av integralmodellen från 2012:
 *
 *   över CP:   dW′bal/dt = −(P − CP)
 *   under CP:  dW′bal/dt =  (CP − P) · (W′ − W′bal) / W′
 *
 * Raden över CP är bara den hyperboliska modellen skriven som en derivata:
 * vid konstant effekt tar reserven slut efter W′/(P − CP) sekunder, precis
 * som t = W′/(P − CP) säger. Raden under CP gör återhämtningen exponentiell
 * med tidskonstanten τ = W′/(CP − P): ju längre under tröskeln vilan ligger,
 * desto snabbare fylls reserven på.
 *
 * Två saker att veta om den:
 *
 *  - Differentialformen återhämtar snabbare än integralmodellen från 2012.
 *    Bartram m.fl. (2018) fann att den går för fort för elitcyklister och
 *    föreslog en långsammare tidskonstant. Passet visas därför som en
 *    *prognos*, och den som ser reserven ta slut i grafen bör läsa det som
 *    "det här passet ligger på gränsen", inte som en utsaga om sekunden.
 *  - Den förutsätter att atleten träffar målen. Ett pass är en plan, inte en
 *    fil från en mätare.
 *
 * Samma ekvationer gäller löpning och simning med fart i stället för effekt:
 * CS ersätter CP och D′ (meter) ersätter W′ (joule). Formen är identisk
 * eftersom båda är "kapacitet över tröskeln", bara i olika enheter.
 */

import type { ResolvedStep } from "./schema";

export type BalanceModel = {
  /** CP i watt, eller CS i m/s. */
  critical: number;
  /** W′ i joule, eller D′ i meter. */
  reserve: number;
};

export type BalancePoint = {
  /** Sekunder in i passet. */
  t: number;
  /** Målet vid den tidpunkten, i watt eller m/s. */
  target: number;
  /** Reserven som är kvar, i joule eller meter. */
  balance: number;
  /** Samma sak som andel av full reserv, 0–1. */
  fraction: number;
};

export type BalanceResult = {
  series: BalancePoint[];
  /** Lägsta reserven under passet, i joule eller meter. */
  minimum: number;
  /** Lägsta reserven som andel av full reserv. */
  minimumFraction: number;
  /** Sant när reserven tar slut, alltså när passet inte går att genomföra. */
  depleted: boolean;
  /** Sekunden reserven först tar slut, eller null. */
  depletedAt: number | null;
  /** Summan av arbetet över tröskeln, i joule eller meter. */
  aboveCritical: number;
};

/** Antal punkter grafen får – nog för att en dipp ska synas. */
const CHART_POINTS = 360;

/**
 * Kör passet genom modellen.
 *
 * Upplösningen är en sekund. Ett pass på tre timmar ger 10 800 steg, vilket
 * är försumbart att räkna, och en grövre upplösning skulle missa korta
 * spurter helt – och det är just de som tömmer reserven.
 */
export function wPrimeBalance(
  steps: ResolvedStep[],
  model: BalanceModel,
): BalanceResult | null {
  const { critical, reserve } = model;
  if (!(critical > 0) || !(reserve > 0) || steps.length === 0) return null;

  const totalSeconds = Math.round(
    steps.reduce((sum, s) => sum + s.seconds, 0),
  );
  if (!(totalSeconds > 0)) return null;

  // Målet per sekund, utrullat en gång, så själva integrationen blir en
  // rak loop utan att leta upp rätt steg vid varje tidpunkt.
  const targets = new Float64Array(totalSeconds);
  let cursor = 0;
  for (const step of steps) {
    const length = Math.round(step.seconds);
    for (let i = 0; i < length && cursor < totalSeconds; i += 1, cursor += 1) {
      targets[cursor] = step.target;
    }
  }
  // Avrundningen per steg kan lämna en lucka på någon sekund i slutet.
  for (let i = cursor; i < totalSeconds; i += 1) {
    targets[i] = steps[steps.length - 1].target;
  }

  const balances = new Float64Array(totalSeconds + 1);
  balances[0] = reserve;

  let minimum = reserve;
  let depletedAt: number | null = null;
  let aboveCritical = 0;

  for (let t = 0; t < totalSeconds; t += 1) {
    const target = targets[t];
    const previous = balances[t];
    let next: number;

    if (target > critical) {
      const excess = target - critical;
      aboveCritical += excess;
      next = previous - excess;
    } else {
      next = previous + (critical - target) * ((reserve - previous) / reserve);
    }

    // Reserven kan varken bli negativ eller större än sig själv.
    next = Math.min(Math.max(next, 0), reserve);
    balances[t + 1] = next;

    if (next < minimum) minimum = next;
    if (next <= 0 && depletedAt === null) depletedAt = t + 1;
  }

  return {
    series: downsample(targets, balances, reserve, totalSeconds),
    minimum,
    minimumFraction: minimum / reserve,
    depleted: depletedAt !== null,
    depletedAt,
    aboveCritical,
  };
}

/**
 * Glesar ut serien till något en graf klarar.
 *
 * Varje hink redovisas med sitt *lägsta* värde, inte sitt medel. En dipp mot
 * noll är hela poängen med kurvan, och ett medelvärde hade jämnat ut just
 * den. Målet tas från hinkens början, så trappstegen behåller sin form.
 */
function downsample(
  targets: Float64Array,
  balances: Float64Array,
  reserve: number,
  totalSeconds: number,
): BalancePoint[] {
  const stride = Math.max(1, Math.ceil(totalSeconds / CHART_POINTS));
  const points: BalancePoint[] = [];

  for (let start = 0; start < totalSeconds; start += stride) {
    const end = Math.min(start + stride, totalSeconds);
    let lowest = balances[start];
    for (let i = start; i < end; i += 1) {
      if (balances[i + 1] < lowest) lowest = balances[i + 1];
    }
    points.push({
      t: start,
      target: targets[start],
      balance: lowest,
      fraction: lowest / reserve,
    });
  }

  // Sista punkten så att kurvan slutar där passet slutar.
  points.push({
    t: totalSeconds,
    target: targets[totalSeconds - 1],
    balance: balances[totalSeconds],
    fraction: balances[totalSeconds] / reserve,
  });

  return points;
}

/**
 * Hur länge en konstant belastning över tröskeln går att hålla.
 *
 * Den hyperboliska modellen rakt av: t = W′ / (P − CP). Under tröskeln finns
 * ingen sluttid i modellen alls, och då säger den här funktionen det i stället
 * för att svara med ett stort tal.
 */
export function timeToExhaustion(
  target: number,
  model: BalanceModel,
): number | null {
  if (!(model.critical > 0) || !(model.reserve > 0)) return null;
  if (target <= model.critical) return null;
  return model.reserve / (target - model.critical);
}

/**
 * En mening om vad kurvan visar.
 *
 * Den ersätter inte grafen, men ett pass bedöms oftast på en enda fråga –
 * går det att genomföra? – och den frågan förtjänar ett svar i text.
 */
export function readBalance(
  result: BalanceResult,
  unit: "J" | "m",
): string {
  const left = Math.round(result.minimumFraction * 100);

  if (result.depleted) {
    const minutes = Math.floor((result.depletedAt as number) / 60);
    const seconds = Math.round((result.depletedAt as number) % 60);
    return `Reserven tar slut efter ${minutes} min ${seconds} s. Som passet står går det inte att genomföra fullt ut – korta intervallerna, sänk målet eller förläng vilorna.`;
  }
  if (left <= 10) {
    return `Reserven bottnar på ${left} % – passet ligger precis på gränsen för vad atleten klarar.`;
  }
  if (left <= 35) {
    return `Reserven bottnar på ${left} %. Ett rejält uttag, men med marginal kvar.`;
  }
  if (left >= 90) {
    const over = Math.round(result.aboveCritical);
    return over > 0
      ? `Reserven bottnar på ${left} %. Passet ligger nästan helt under tröskeln – bara ${over} ${unit} togs ur reserven.`
      : `Passet ligger helt under tröskeln. Ingenting tas ur den anaeroba reserven.`;
  }
  return `Reserven bottnar på ${left} %.`;
}
