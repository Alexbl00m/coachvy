/**
 * Effektprofilen mot Allen & Coggans tabell.
 *
 * Tabellen ur *Training and Racing with a Power Meter* (Allen & Coggan) är
 * den vedertagna referensen för cyklisters effekt per kilo: bästa effekt över
 * 5 sekunder, 1 minut, 5 minuter och vid tröskeln (FT), för män och kvinnor,
 * i åtta kategorier från otränad till världsklass. De fyra längderna står för
 * neuromuskulär kraft, anaerob kapacitet, VO2max och tröskeln.
 *
 * Kategorierna överlappar i originalet. Här används varje kategoris nedre
 * gräns, så att varje värde hamnar i exakt en kategori, och positionen inom
 * kategorin räknas linjärt mellan gränserna. Positionen gör längderna
 * jämförbara: 5,2 på 5 minuter och 4,1 vid FT säger ingenting bredvid
 * varandra, men "Utmärkt" mot "Mycket bra" gör det.
 *
 * 20 minuter finns inte i tabellen. Den jämförs mot FT-gränserna delade med
 * 0,95 – samma omräkning som när FTP skattas ur ett 20-minuterstest.
 *
 * Modulen är ren och körs i webbläsaren när perioden byts.
 */

export type Sex = "man" | "kvinna";
export type CogganDuration = "5s" | "1min" | "5min" | "20min" | "ft";

/** Kategorierna nerifrån och upp. */
export const COGGAN_CATEGORIES = [
  "Otränad",
  "Hyfsad",
  "Måttlig",
  "Bra",
  "Mycket bra",
  "Utmärkt",
  "Exceptionell",
  "Världsklass",
] as const;

type Column = { floors: number[]; top: number };

/** Varje kategoris nedre gräns (nerifrån och upp) och tabellens tak, W/kg. */
const TABLE: Record<Sex, Record<"5s" | "1min" | "5min" | "ft", Column>> = {
  man: {
    "5s": {
      floors: [10.17, 11.8, 13.44, 15.07, 16.97, 18.6, 20.23, 21.86],
      top: 24.04,
    },
    "1min": {
      floors: [5.64, 6.33, 7.02, 7.71, 8.51, 9.2, 9.89, 10.58],
      top: 11.5,
    },
    "5min": {
      floors: [2.33, 2.95, 3.57, 4.19, 4.91, 5.53, 6.15, 6.77],
      top: 7.6,
    },
    ft: {
      floors: [1.86, 2.4, 2.93, 3.47, 4.09, 4.62, 5.15, 5.69],
      top: 6.4,
    },
  },
  kvinna: {
    "5s": {
      floors: [8.43, 9.72, 11.01, 12.31, 13.82, 15.11, 16.4, 17.7],
      top: 19.42,
    },
    "1min": {
      floors: [4.67, 5.21, 5.76, 6.3, 6.93, 7.48, 8.02, 8.56],
      top: 9.29,
    },
    "5min": {
      floors: [1.89, 2.45, 3.0, 3.56, 4.2, 4.76, 5.31, 5.87],
      top: 6.61,
    },
    ft: {
      floors: [1.5, 1.99, 2.49, 2.98, 3.55, 4.05, 4.54, 5.03],
      top: 5.69,
    },
  },
};

/** FTP skattas som 95 % av 20 minuter, så 20 minuter jämförs mot FT / 0,95. */
const TWENTY_TO_FT = 0.95;

function column(sex: Sex, duration: CogganDuration): Column {
  if (duration === "20min") {
    const ft = TABLE[sex].ft;
    return {
      floors: ft.floors.map((f) => f / TWENTY_TO_FT),
      top: ft.top / TWENTY_TO_FT,
    };
  }
  return TABLE[sex][duration];
}

/** Kategoriernas nedre gränser och taket för en längd, W/kg. */
export function cogganColumn(sex: Sex, duration: CogganDuration): Column {
  return column(sex, duration);
}

/**
 * Var i tabellen ett värde ligger: 0 är otränads nedre gräns, 8 världsklassens
 * tak. Heltalsdelen är kategorin. Under tabellen blir talet negativt (högst
 * −0,5), över den större än 8 (högst 8,5).
 */
export function cogganPosition(
  wattsPerKg: number,
  sex: Sex,
  duration: CogganDuration,
): number {
  const { floors, top } = column(sex, duration);
  if (wattsPerKg < floors[0]) {
    return Math.max(-0.5, (wattsPerKg - floors[0]) / (floors[1] - floors[0]));
  }
  for (let i = 0; i < floors.length; i += 1) {
    const upper = i + 1 < floors.length ? floors[i + 1] : top;
    if (wattsPerKg < upper) {
      return i + (wattsPerKg - floors[i]) / (upper - floors[i]);
    }
  }
  const last = floors[floors.length - 1];
  return Math.min(8.5, 8 + (wattsPerKg - top) / (top - last));
}

/** Kategorin för en position, och om värdet ligger utanför tabellen. */
export function cogganCategory(position: number): {
  index: number;
  name: (typeof COGGAN_CATEGORIES)[number];
  outside: "under" | "över" | null;
} {
  const index = Math.max(0, Math.min(7, Math.floor(position)));
  return {
    index,
    name: COGGAN_CATEGORIES[index],
    outside: position < 0 ? "under" : position > 8 ? "över" : null,
  };
}

export const DURATION_LABEL: Record<CogganDuration, string> = {
  "5s": "5 s",
  "1min": "1 min",
  "5min": "5 min",
  "20min": "20 min",
  ft: "FT",
};

/** Vad längden mäter, i Coggans indelning. */
export const DURATION_MEANING: Record<CogganDuration, string> = {
  "5s": "neuromuskulär kraft",
  "1min": "anaerob kapacitet",
  "5min": "VO2max",
  "20min": "tröskeln",
  ft: "tröskeln",
};

export type ProfilePoint = {
  duration: CogganDuration;
  wattsPerKg: number;
  watts: number;
  position: number;
};

const sv = (v: number, digits = 1) => v.toFixed(digits).replace(".", ",");

/**
 * Profilen i text: var adepten är starkast och svagast mot tabellen, vilken
 * form profilen har och vad det brukar betyda för träningen.
 *
 * Regelbaserad som resten av analyserna: samma värden ger samma text.
 */
export function readPowerProfile(points: ProfilePoint[]): string[] {
  if (points.length < 2) return [];
  const lines: string[] = [];
  const byPos = [...points].sort((a, b) => b.position - a.position);
  const top = byPos[0];
  const bottom = byPos[byPos.length - 1];
  const spread = top.position - bottom.position;
  const name = (p: ProfilePoint) =>
    `${DURATION_LABEL[p.duration]} (${cogganCategory(p.position).name.toLowerCase()}, ${sv(p.wattsPerKg, 2)} W/kg)`;

  if (spread < 0.75) {
    lines.push(
      `Jämn profil: alla längder ligger inom samma kategori ungefär – ${cogganCategory((top.position + bottom.position) / 2).name.toLowerCase()}. En allroundprofil, utan någon längd som sticker ut åt något håll.`,
    );
    return lines;
  }

  lines.push(
    `Starkast mot tabellen: ${name(top)}. Svagast: ${name(bottom)} – ${sv(spread, 1)} kategorier emellan.`,
  );

  const at = (d: CogganDuration) =>
    points.find((p) => p.duration === d)?.position ?? null;
  const before = lines.length;
  const p5s = at("5s");
  const p1 = at("1min");
  const p5 = at("5min");
  const pft = at("ft") ?? at("20min");

  if (
    p5s !== null &&
    p1 !== null &&
    p5 !== null &&
    pft !== null &&
    Math.min(p5s, p1) >= Math.max(p5, pft) + 0.75
  ) {
    lines.push(
      "Profilen lutar mot sprinter: de korta längderna ligger klart högre än de långa. Styrkan är spurten och de korta attackerna; tröskeln och VO2max har mest att hämta om målen är långa lopp.",
    );
  } else if (
    p5s !== null &&
    pft !== null &&
    p5 !== null &&
    pft >= p5s + 0.75 &&
    p5 >= p5s + 0.5
  ) {
    lines.push(
      "Profilen lutar mot tempo och klättring: motorn – VO2max och tröskeln – bär, medan spurten är svagast. Det är en uthållighetsprofil; spurten behöver bara tränas om loppen avgörs där.",
    );
  } else if (
    p1 !== null &&
    p5 !== null &&
    pft !== null &&
    p5s !== null &&
    Math.min(p1, p5) >= Math.max(p5s, pft) + 0.5
  ) {
    lines.push(
      "Profilen lutar mot förföljare: starkast på 1–5 minuter. Bra för korta stigningar, kriterier och lagtempo; tröskeln avgör de längre loppen.",
    );
  } else if (p5 !== null && pft !== null && p5 >= pft + 0.75) {
    lines.push(
      "Tröskeln ligger efter syreupptaget: 5 minuter är klart starkare än tröskeln. Mer tid vid och strax under tröskeln brukar lyfta FT närmare det VO2max redan tillåter.",
    );
  } else if (p5 !== null && pft !== null && pft >= p5 + 0.75) {
    lines.push(
      "Tröskeln ligger högt i förhållande till VO2max: adepten utnyttjar redan mycket av motorn. Det som lyfter tröskeln vidare är oftast VO2max – intervaller på 3–8 minuter.",
    );
  }

  const weakest: Record<CogganDuration, string> = {
    "5s": "Svagast är sprintkraften – korta, maximala spurter och styrka.",
    "1min":
      "Svagast är den anaeroba kapaciteten – intervaller på 30 s–2 min med full vila.",
    "5min": "Svagast är VO2max – intervaller på 3–8 minuter.",
    "20min": "Svagast är tröskeln – långa intervaller vid och strax under FT.",
    ft: "Svagast är tröskeln – långa intervaller vid och strax under FT.",
  };
  // Säger formen redan var svagheten sitter behövs ingen rad till om den.
  if (spread >= 1 && lines.length === before) {
    lines.push(weakest[bottom.duration]);
  }
  return lines;
}
