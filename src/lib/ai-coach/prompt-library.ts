/**
 * Frågebiblioteket i AI Coach: färdiga frågor, ordnade efter vad coachen
 * vill förstå. Varje fråga går att besvara ur underlaget appen skickar med –
 * testerna, säsongsplanen, incheckningarna och hela historiken ur de
 * uppladdade passen (`src/lib/activities/history-digest.ts`).
 *
 * Vilopuls och HRV finns inte i appen; frågor om återhämtning läser
 * incheckningarna (sömn, trötthet, ömhet, stress) i stället.
 *
 * Text inom hakparenteser är en plats att fylla i – den markeras när frågan
 * väljs, så att den går att skriva över direkt.
 */

export type PromptCategory = {
  id: string;
  label: string;
  prompts: string[];
};

export const PROMPT_LIBRARY: PromptCategory[] = [
  {
    id: "nu",
    label: "Läget nu",
    prompts: [
      "Vad säger de senaste testerna om var adepten står?",
      "Adepten känns tung i benen – vad ser du i belastningen och incheckningarna?",
      "Vad bör vi prioritera de närmaste fyra veckorna?",
      "Hur bör veckorna fram till A-loppet se ut, med toppningen?",
      "Räcker den anaeroba kapaciteten för ett lopp med mycket backar?",
    ],
  },
  {
    id: "sasonger",
    label: "Mönster över säsonger",
    prompts: [
      "Jämför de åtta veckorna före adeptens tre senaste stora tävlingar. Vad var lika, vad skilde sig, och vad gjorde adepten före det bästa loppet?",
      "När var adepten som mest effektiv – mest fart eller effekt per hjärtslag på lugna pass? Vad gjorde adepten de sex veckorna innan?",
      "Hur lång återhämtning behöver adepten efter en tävling? Titta på mängden, incheckningarna och formen veckorna efter varje lopp.",
      "Finns det tider på året då adepten är i bäst form? Gå igenom alla år som finns.",
    ],
  },
  {
    id: "tavling",
    label: "Tävlingsförberedelse",
    prompts: [
      "Titta på de sista tio dagarna före adeptens bästa lopp. Hur såg intensitet, vilodagar och öppningspass ut? Vilka detaljer gjorde skillnaden?",
      "Hur har toppningen sett ut före de lopp där adepten slog testmodellen, jämfört med de andra loppen?",
      "Hur mår adepten i incheckningarna de två veckorna före en tävling, och hänger det ihop med resultatet?",
    ],
  },
  {
    id: "fysiologi",
    label: "Fysiologi och fartstrategi",
    prompts: [
      "Jämför adeptens effekt och fart över olika tävlingsdistanser. Hur väl håller det som fungerar på kortare lopp på längre?",
      "Utifrån de senaste passen och testerna: vilken effekt och fart är rimlig för [lopp och distans]?",
      "Hur bör adepten köra backarna på [bana] för att ha kvar en stark avslutning?",
      "Hur stämmer testvärdena – VO2max, VLamax och trösklarna – med träningsdatan, och vad betyder det för fartstrategin i tävling?",
    ],
  },
  {
    id: "vinster",
    label: "Små vinster",
    prompts: [
      "Var finns den största utvecklingspotentialen just nu? Titta på de senaste tolv veckorna.",
      "Vilka pass ger adepten mest framsteg? Vad har de gemensamt?",
      "Jämför förberedelserna inför adeptens bästa lopp. Vad gjordes annorlunda, bortsett från mängden träning?",
    ],
  },
  {
    id: "overraska",
    label: "Överraska mig",
    prompts: [
      "Hitta tre mönster i datan från de senaste två åren som jag inte har frågat om. Hur säker är du på varje?",
      "Titta på datan med nya ögon. Vad sticker ut som jag kan ha missat?",
      "Vilka var adeptens bästa pass – de som gick bättre än väntat? Vad hände dagarna före?",
      "Vilka pass ger mest tillbaka för vad de kostar i belastning?",
      "Var är adepten stark i datan, och var finns det mest kvar att hämta?",
    ],
  },
  {
    id: "linjer",
    label: "Långa linjer",
    prompts: [
      "Håller adepten effekten bättre sent i långa pass nu? Jämför frikopplingen och andra halvan på långpassen över säsongerna.",
      "Hur förändras sömn, trötthet och stress i incheckningarna över tid? Visa den långsiktiga trenden, inte svängningarna dag för dag.",
      "Hur hänger träningsmängden ihop med tävlingsresultaten över åren? Var ligger adeptens bästa nivå?",
    ],
  },
];

/** Var den första platsen att fylla i finns, för att markera den. */
export function placeholderRange(text: string): [number, number] | null {
  const start = text.indexOf("[");
  const end = text.indexOf("]", start);
  return start >= 0 && end > start ? [start, end + 1] : null;
}
