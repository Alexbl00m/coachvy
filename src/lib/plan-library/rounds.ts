/**
 * Varven: när det är längre till målet än planen är lång.
 *
 * Målet är att alltid ha så lång tid på sig som möjligt. Är det 24 veckor
 * kvar och planen är 12–18 veckor går den två varv om 12; är det 36 veckor
 * två varv om 18. Varje varv är hela planen, kortad på samma sätt som en
 * kort plan – grunden först – och slutar i ett testlopp, utom det sista,
 * som slutar i målet. Mellan varven kan nivån bytas: Breeze 65 första varvet
 * och 80 det andra.
 *
 * Går det inte jämnt upp blir de sista varven en vecka längre – närmast
 * målet är där veckorna gör mest nytta. Blir ett varv kortare än planens
 * minsta längd går planen ett varv färre och börjar lite senare; veckorna
 * före start är lugn grundträning.
 *
 * Modulen är ren.
 */

/** Så många veckors lugn träning före start är rimligt innan ett varv till är bättre. */
export const LEAD_IN_OK = 2;

/** Fler varv än så blir sällan bättre än en längre grundperiod före start. */
export const MAX_ROUNDS = 3;

export type RoundsOption = {
  /** Varvens längd i veckor, i ordning. */
  rounds: number[];
  /** Veckor före första varvet, som inte ingår i planen. */
  leadIn: number;
};

/** `total` veckor i `k` varv, med resten på de sista varven. */
export function splitRounds(total: number, k: number): number[] {
  const base = Math.floor(total / k);
  const extra = total - base * k;
  return Array.from({ length: k }, (_, i) => base + (i >= k - extra ? 1 : 0));
}

/**
 * Upplägget i `k` varv på `available` veckor: varven så långa det går inom
 * planens gränser. Null när `k` varv inte ryms.
 */
export function roundsFor(
  available: number,
  k: number,
  minWeeks: number,
  maxWeeks: number,
): RoundsOption | null {
  if (k < 1 || available < k * minWeeks) return null;
  const used = Math.min(available, k * maxWeeks);
  return { rounds: splitRounds(used, k), leadIn: available - used };
}

/** Alla upplägg som ryms, från ett varv och uppåt. */
export function roundOptions(
  available: number,
  minWeeks: number,
  maxWeeks: number,
  maxRounds = MAX_ROUNDS,
): RoundsOption[] {
  const out: RoundsOption[] = [];
  for (let k = 1; k <= maxRounds; k += 1) {
    const option = roundsFor(available, k, minWeeks, maxWeeks);
    if (option) out.push(option);
  }
  return out;
}

/**
 * Förslaget: så få varv som möjligt, men inte så få att mer än ett par
 * veckor blir över före start. Ryms inget varv utan väntan är förslaget det
 * som väntar kortast.
 */
export function proposeRounds(
  available: number,
  minWeeks: number,
  maxWeeks: number,
  maxRounds = MAX_ROUNDS,
): RoundsOption | null {
  const options = roundOptions(available, minWeeks, maxWeeks, maxRounds);
  if (options.length === 0) return null;
  return (
    options.find((o) => o.leadIn <= LEAD_IN_OK) ??
    options.reduce((best, o) => (o.leadIn < best.leadIn ? o : best))
  );
}

export type RoundSpan = {
  /** 1 är första varvet. */
  round: number;
  weeks: number;
  fromWeek: number;
  toWeek: number;
};

/** Varven som planveckor. Null eller tomt: hela planen är ett varv. */
export function roundSpans(
  rounds: number[] | null | undefined,
  totalWeeks: number,
): RoundSpan[] {
  const lengths = rounds && rounds.length > 0 ? rounds : [totalWeeks];
  let from = 1;
  return lengths.map((weeks, i) => {
    const span = {
      round: i + 1,
      weeks,
      fromWeek: from,
      toWeek: from + weeks - 1,
    };
    from += weeks;
    return span;
  });
}

/** Varvet en planvecka ligger i. */
export function roundOf(spans: RoundSpan[], week: number): RoundSpan {
  return (
    spans.find((s) => week >= s.fromWeek && week <= s.toWeek) ?? spans.at(-1)!
  );
}

/** Läser `plan_instances.rounds`: en lista med heltal, annars null. */
export function parseRounds(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const out = value.map(Number);
  return out.every((n) => Number.isInteger(n) && n > 0) ? out : null;
}
