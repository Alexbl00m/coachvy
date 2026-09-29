/**
 * Intervallzoner ur CP och W′ – eller CS och D′.
 *
 * Varje rad är en serie: så många repetitioner av en viss längd, med en viss
 * vila. Målet räknas fram så att hela serien går att genomföra: W′bal
 * (Skiba m.fl. 2014, samma modell som passbyggaren) följs genom serien, och
 * målet är den högsta nivå där reserven aldrig går under 10 %. Bredvid står
 * vad en enda repetition klarar med hela reserven, CP + W′/t – taket, inte
 * ett mål för en serie.
 *
 * Varför inte bara "X % av W′ per repetition": vilan fyller inte på hela
 * reserven. Med 75 % per repetition och tre minuters vila tar den slut i den
 * andra. Med modellen blir målet lägre ju fler och tätare repetitionerna är,
 * vilket är vad varje coach vet men sällan kan sätta en siffra på.
 *
 * Konstant effekt ger modellens lösning i sluten form:
 *   arbete över CP:  W′bal −= (P − CP) · t
 *   vila vid R < CP: W′bal  = W′ − (W′ − W′bal) · e^(−t / τ)
 * Samma sak gäller fart och D′ i löpning och simning.
 */

export type IntervalSet = {
  /** Repetitionens längd, sekunder. */
  seconds: number;
  reps: number;
  /** Vila mellan repetitionerna, sekunder. */
  rest: number;
  purpose: string;
};

/** Serierna, från korta anaeroba till långa tröskelintervaller. */
export const INTERVAL_SETS: IntervalSet[] = [
  { seconds: 30, reps: 10, rest: 30, purpose: "Anaerob kapacitet, snabbhet" },
  {
    seconds: 60,
    reps: 8,
    rest: 60,
    purpose: "Anaerob kapacitet, laktattolerans",
  },
  { seconds: 120, reps: 6, rest: 120, purpose: "VO2max" },
  { seconds: 180, reps: 5, rest: 120, purpose: "VO2max" },
  { seconds: 240, reps: 5, rest: 180, purpose: "VO2max" },
  { seconds: 300, reps: 4, rest: 180, purpose: "VO2max, tröskel uppifrån" },
  { seconds: 480, reps: 3, rest: 240, purpose: "Tröskel och över" },
  { seconds: 720, reps: 3, rest: 240, purpose: "Tröskel" },
];

/** Reserven som ska finnas kvar vid seriens tyngsta punkt. */
const KEEP = 0.1;

export type IntervalRow = IntervalSet & {
  /** Målet för serien, i watt eller m/s. */
  target: number;
  /** En enda repetition med hela reserven: CP + W′/t. */
  single: number;
  /** Målet i procent av CP eller CS. */
  pctOfCritical: number;
};

/**
 * Återhämtningens tidskonstant, sekunder. På cykeln Skibas integralmodell
 * från 2012, τ = 546 · e^(−0,01 · (CP − R)) + 316: den fyller på långsammare
 * än differentialformen, som Bartram m.fl. (2018) visade går för fort – och
 * i en serie är det återhämtningen som avgör målet. För fart finns ingen
 * motsvarande anpassning. Där används differentialformen, τ = D′/(CS − R),
 * med dubbel tidskonstant – ungefär vad integralmodellen ger på cykeln vid
 * samma relativa vila – hellre för försiktigt än ett mål som inte håller.
 */
function recoveryTau(
  critical: number,
  reserve: number,
  restLevel: number,
  watts: boolean,
): number {
  const below = Math.max(critical - restLevel, 1e-9);
  if (watts) return 546 * Math.exp(-0.01 * below) + 316;
  return (2 * reserve) / below;
}

/** Lägsta W′bal genom serien vid nivån `level`. */
function lowestBalance(
  set: IntervalSet,
  level: number,
  critical: number,
  reserve: number,
  restLevel: number,
  watts: boolean,
): number {
  let balance = reserve;
  let lowest = reserve;
  for (let i = 0; i < set.reps; i += 1) {
    balance -= Math.max(level - critical, 0) * set.seconds;
    lowest = Math.min(lowest, balance);
    if (i < set.reps - 1) {
      const tau = recoveryTau(critical, reserve, restLevel, watts);
      balance = reserve - (reserve - balance) * Math.exp(-set.rest / tau);
    }
  }
  return lowest;
}

/**
 * Serierna med mål. `restFraction` är vilans nivå som andel av CP/CS –
 * 0,5 för lätt trampande eller jogg, 0 för vila på kanten i simningen.
 */
export function intervalZones(
  critical: number,
  reserve: number,
  options: {
    /** Effekt i watt (cykel) eller fart i m/s. */
    watts: boolean;
    restFraction?: number;
    sets?: IntervalSet[];
  },
): IntervalRow[] {
  const { watts, restFraction = 0.5, sets = INTERVAL_SETS } = options;
  if (!(critical > 0) || !(reserve > 0)) return [];
  const restLevel = critical * restFraction;
  return sets.map((set) => {
    // Bisektion: högsta nivå där reserven håller sig över KEEP.
    let low = critical;
    let high = critical + reserve / set.seconds;
    for (let i = 0; i < 50; i += 1) {
      const mid = (low + high) / 2;
      if (
        lowestBalance(set, mid, critical, reserve, restLevel, watts) >=
        KEEP * reserve
      ) {
        low = mid;
      } else {
        high = mid;
      }
    }
    return {
      ...set,
      target: low,
      single: critical + reserve / set.seconds,
      pctOfCritical: (low / critical) * 100,
    };
  });
}
