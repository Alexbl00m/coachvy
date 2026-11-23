/**
 * Simfart i passraden: CSS plus sekunder per 100 m, och tävlingsfarten.
 *
 *   400 m CSS+8-15; 8x(200 m CSS+3-6 + 20 s vila); 200 m CSS+20
 *   10x(200 m @IM + 20 s vila)
 *
 * Simtränare skriver farten som tillägg till CSS – "CSS + 8" är åtta
 * sekunder långsammare per 100 m – och det är tillägget simmaren ser på
 * klockan (filosofin, avsnitt 27). Ett tillägg i sekunder är inte samma
 * andel av farten för en simmare på 1:30 som för en på 2:10, så målet kan
 * inte sparas som en fast procentsats i passet. Raden räknas om mot
 * adeptens egen CSS när passet läggs på adepten. Utan en adept – i
 * biblioteket och i förhandsvisningar – räknas den mot en nominell CSS.
 *
 * `@IM` och `@703` är tävlingsfarten för Ironman och 70.3. De är egna värden
 * per adept, inte en skillnad från CSS, och ett pass med dem kräver att
 * adepten har farten inskriven. Ett tillägg går att skriva efter dem:
 * `@IM-2` är två sekunder snabbare än Ironmanfarten.
 *
 * Modulen är ren.
 */

/** Farterna i sekunder per 100 m. */
export type SwimPaces = {
  css: number;
  im: number | null;
  half: number | null;
};

/**
 * För bibliotek och förhandsvisning: en triathlet på 1:45 per 100 m, med
 * tävlingsfarter strax under. Talen styr bara tid och färg i förhandsvisningen.
 */
export const NOMINAL_SWIM: SwimPaces = { css: 105, im: 113, half: 110 };

export type SwimTarget = {
  low: number;
  high: number;
  /** Snabbaste tillägget mot CSS, för att gissa stegets typ. */
  fastestOffset: number;
  /** Hur mycket av texten målet tog. */
  length: number;
};

const SIGNED = String.raw`([+\-−]\s*\d+(?:[.,]\d+)?)`;
const CSS_TARGET = new RegExp(
  String.raw`^\s*CSS(?:\s*${SIGNED}(?:\s*(?:\.\.|[-–])\s*([+\-−]?\s*\d+(?:[.,]\d+)?))?)?(?![A-Za-z0-9])`,
  "i",
);
const RACE_TARGET = new RegExp(
  String.raw`^\s*@\s*(IM|703)(?:\s*${SIGNED})?(?![A-Za-z0-9])`,
  "i",
);

const signed = (raw: string) =>
  Number(raw.replace(/\s+/g, "").replace("−", "-").replace(",", "."));

/** Finns simfart i raden – då ska den räknas om mot adeptens CSS. */
export const hasSwimTargets = (text: string) =>
  /(^|[\s;(+])CSS(?![A-Za-z])/i.test(text) || /@\s*(IM|703)\b/i.test(text);

/** Andelen av CSS-farten för en fart i sekunder per 100 m. */
const fraction = (css: number, pace: number) => css / pace;

/**
 * Ett simmål i början av texten, som andel av CSS. `null` när texten inte
 * börjar med ett simmål; en sträng när målet inte går att räkna.
 */
export function parseSwimTarget(
  rest: string,
  paces: SwimPaces,
): SwimTarget | string | null {
  const css = rest.match(CSS_TARGET);
  if (css) {
    const first = css[1] ? signed(css[1]) : 0;
    const second =
      css[2] === undefined
        ? first
        : /^[+\-−]/.test(css[2].trim())
          ? signed(css[2])
          : Math.sign(first || 1) * signed(css[2]);
    const offsets = [first, second];
    if (offsets.some((o) => o < -20 || o > 60)) {
      return "Tillägget till CSS ska ligga mellan −20 och +60 sekunder per 100 m.";
    }
    const paceOf = (o: number) => paces.css + o;
    const fractions = offsets.map((o) => fraction(paces.css, paceOf(o)));
    return {
      low: Math.min(...fractions),
      high: Math.max(...fractions),
      fastestOffset: Math.min(...offsets),
      length: css[0].length,
    };
  }

  const race = rest.match(RACE_TARGET);
  if (race) {
    const key = race[1].toUpperCase();
    const base = key === "IM" ? paces.im : paces.half;
    if (base === null || !(base > 0)) {
      return key === "IM"
        ? "Adepten saknar tävlingsfart i simning för Ironman. Skriv in den på profilen."
        : "Adepten saknar tävlingsfart i simning för 70.3. Skriv in den på profilen.";
    }
    const offset = race[2] ? signed(race[2]) : 0;
    const value = fraction(paces.css, base + offset);
    return {
      low: value,
      high: value,
      fastestOffset: base + offset - paces.css,
      length: race[0].length,
    };
  }
  return null;
}

/** "1:45" eller "105" till sekunder per 100 m; null om texten inte är en fart. */
export function parseSwimPace(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const clock = t.match(/^(\d{1,2}):(\d{2})(?:[.,](\d))?$/);
  const value = clock
    ? Number(clock[1]) * 60 +
      Number(clock[2]) +
      (clock[3] ? Number(clock[3]) / 10 : 0)
    : /^\d+(?:[.,]\d)?$/.test(t)
      ? Number(t.replace(",", "."))
      : NaN;
  return Number.isFinite(value) && value >= 50 && value <= 300 ? value : null;
}

/** 105 → "1:45". */
export function swimPaceText(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Raden utan tävlingsfarterna, för kontrollen av löpzonerna (@LO, @HM). */
export const withoutSwimRaces = (text: string) =>
  text.replace(/@\s*(IM|703)(?![A-Za-z0-9])/gi, "");

/**
 * Fel när simfart står i ett pass som inte räknas mot CSS, eller löpzoner i
 * ett pass som inte räknas mot maratonfart; annars null.
 */
export function basisMismatch(text: string, basis: string): string | null {
  if (hasSwimTargets(text) && basis !== "CSS") {
    return "CSS-tillägg och @IM eller @703 räknas mot CSS – välj CSS som bas, eller skriv procent.";
  }
  if (withoutSwimRaces(text).includes("@") && basis !== "MP") {
    return "Zoner som @LO och @HM står mot maratonfart – välj Maratonfart som bas, eller skriv procent.";
  }
  return null;
}
