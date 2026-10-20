import { readFileSync } from "node:fs";
import path from "node:path";

const philosophy = readFileSync(
  path.join(process.cwd(), "docs", "traningsfilosofi.md"),
  "utf8",
);

/** Hur coachens egen filosofi förhåller sig till Coachvys grundfilosofi. */
export type PhilosophyMode = "komplettera" | "ersatt";

export type CoachPhilosophy = { text: string; mode: PhilosophyMode };

/** Samma gräns som i databasen. */
export const PHILOSOPHY_MAX = 40000;

const GUIDANCE =
  "Låt den styra hur du resonerar: vilken egenskap ett pass eller ett block ska utveckla, hur intensiteten fördelas i fasen atleten är i, hur blocken byggs och byggs på, var tester gör nytta, och hur responsen avgör nästa steg. Pekar atletens tal åt ett annat håll än filosofin, säg det rakt ut i stället för att tänja på någon av dem.";

/**
 * Grundfilosofin när ingen egen finns: texten är densamma som i
 * docs/traningsfilosofi.md och ändras bara där.
 */
export const PHILOSOPHY_PROMPT = `Coachen arbetar efter en uttalad träningsfilosofi. Den står nedan, skriven till coachen: "du" i texten är coachen, inte du.

Låt den styra hur du resonerar: vilken egenskap ett pass eller ett block ska utveckla, hur intensiteten fördelas i fasen atleten är i, ett eller två återkommande format per block som byggs på en variabel i taget, tester där de påverkar beslut, och planen som en hypotes som responsen prövar. Pekar atletens tal åt ett annat håll än filosofin, säg det rakt ut i stället för att tänja på någon av dem.

<traningsfilosofi>
${philosophy.trim()}
</traningsfilosofi>`;

/** Grundfilosofin som grund för en annan coachs egen. */
const FOUNDATION_PROMPT = `Coachvy bygger på en grundfilosofi för uthållighetsträning. Den står nedan, skriven till Alexander Lindblom som tog fram den: "du" i texten är Alexander – inte coachen du hjälper, och inte du.

Grundfilosofin är grunden. Coachen du hjälper har en egen filosofi i nästa block, och den går före där de skiljer sig.

<grundfilosofi>
${philosophy.trim()}
</grundfilosofi>`;

/** Coachens text får inte kunna stänga sin egen tagg. */
const contained = (text: string) =>
  text.replace(/<\/?coachens_filosofi>/gi, "");

function ownPrompt(own: CoachPhilosophy): string {
  const intro =
    own.mode === "komplettera"
      ? "Coachen du hjälper har skrivit sin egen träningsfilosofi. Den går före grundfilosofin där de skiljer sig – i intensitetsfördelning, periodisering, testning eller vad det än gäller – och fyller i det grundfilosofin inte säger. Där coachens text är tyst gäller grundfilosofin."
      : "Coachen du hjälper arbetar efter sin egen träningsfilosofi. Den står nedan, skriven av coachen själv, och är den enda filosofi som gäller.";
  return `${intro}

${GUIDANCE}

<coachens_filosofi>
${contained(own.text).trim()}
</coachens_filosofi>`;
}

type SystemText = {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
};

/**
 * Filosofin som block i systemprompten.
 *
 * Utan egen text: grundfilosofin, som förut. Kompletterar coachen den: först
 * grundfilosofin, som är lika för alla coacher och därför cachas för sig,
 * sedan coachens egen, som går före. Ersätter coachen den: bara coachens.
 * Varje block får en egen cachepunkt – högst två, så att anropen håller sig
 * inom API:ets fyra.
 */
export function philosophyBlocks(own: CoachPhilosophy | null): SystemText[] {
  const cached = (text: string): SystemText => ({
    type: "text",
    text,
    cache_control: { type: "ephemeral" },
  });
  if (!own) return [cached(PHILOSOPHY_PROMPT)];
  if (own.mode === "ersatt") return [cached(ownPrompt(own))];
  return [cached(FOUNDATION_PROMPT), cached(ownPrompt(own))];
}

/** En sparad rad till en filosofi, eller null när ingen text finns. */
export function parseCoachPhilosophy(
  row: { philosophy?: unknown; philosophy_mode?: unknown } | null,
): CoachPhilosophy | null {
  const text = typeof row?.philosophy === "string" ? row.philosophy.trim() : "";
  if (!text) return null;
  return {
    text: text.slice(0, PHILOSOPHY_MAX),
    mode: row?.philosophy_mode === "ersatt" ? "ersatt" : "komplettera",
  };
}

/** Grundfilosofin som text, för att visa i inställningarna. */
export const FOUNDATION_TEXT = philosophy.trim();
