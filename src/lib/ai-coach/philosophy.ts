import { readFileSync } from "node:fs";
import path from "node:path";

const philosophy = readFileSync(
  path.join(process.cwd(), "docs", "traningsfilosofi.md"),
  "utf8",
);

/**
 * Coachens träningsfilosofi som ett eget block i systemprompten. Texten är
 * densamma som i docs/traningsfilosofi.md och ändras bara där. Blocket är
 * statiskt och ligger före cachepunkten.
 */
export const PHILOSOPHY_PROMPT = `Coachen arbetar efter en uttalad träningsfilosofi. Den står nedan, skriven till coachen: "du" i texten är coachen, inte du.

Låt den styra hur du resonerar: vilken egenskap ett pass eller ett block ska utveckla, hur intensiteten fördelas i fasen atleten är i, ett eller två återkommande format per block som byggs på en variabel i taget, tester där de påverkar beslut, och planen som en hypotes som responsen prövar. Pekar atletens tal åt ett annat håll än filosofin, säg det rakt ut i stället för att tänja på någon av dem.

<traningsfilosofi>
${philosophy.trim()}
</traningsfilosofi>`;
