/**
 * Steg inklistrade ur ett kalkylark: Excel, Numbers eller Google Kalkylark
 * lägger tabbar mellan cellerna och radbrytning mellan raderna.
 *
 * Kolumnerna känns igen på rubrikraden när den finns med. Utan rubriker
 * gissas de ur värdena – laktat är decimaltal under 25, tider skrivs mm:ss –
 * och resten tas i ordningen belastning, puls. Gissningen visas alltid och kan
 * ändras innan något fylls i.
 */

export type ColumnRole =
  | "intensity"
  | "duration"
  | "lactate"
  | "heartRate"
  | "rpe"
  | "ignore";

export const ROLE_LABELS: Record<ColumnRole, string> = {
  intensity: "Belastning",
  duration: "Tid",
  lactate: "Laktat",
  heartRate: "Puls",
  rpe: "RPE",
  ignore: "Används inte",
};

export type PastedTable = {
  header: string[] | null;
  rows: string[][];
  roles: ColumnRole[];
};

/** Ordning spelar roll: "km/h" ska bli belastning före "h" i något annat. */
const HEADER_WORDS: [ColumnRole, RegExp][] = [
  ["lactate", /laktat|lactate|mmol|\bla\b/],
  ["heartRate", /puls|hjärt|heart|\bhr\b|bpm|slag/],
  ["rpe", /rpe|borg/],
  ["duration", /\btid\b|time|duration|längd|min:s|mm:ss/],
  [
    "intensity",
    /watt|\bw\b|effekt|power|km\/h|kmh|fart|hastighet|speed|belastning|m\/s/,
  ],
];

/** Ett tal ur en cell: decimalkomma, enhet efter. */
export function cellNumber(cell: string): number | null {
  const match = cell
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".")
    .match(/^-?\d+(\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

const isClock = (cell: string) => /^\d{1,2}:\d{2}$/.test(cell.trim());

function splitLines(text: string): string[][] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);
  // Tabbar från ett kalkylark; annars semikolon (svensk CSV) eller flera mellanslag.
  const sep = lines.some((l) => l.includes("\t"))
    ? "\t"
    : lines.some((l) => l.includes(";"))
      ? ";"
      : /\s{2,}| /;
  return lines.map((line) => line.split(sep).map((cell) => cell.trim()));
}

function guessRoles(rows: string[][], width: number): ColumnRole[] {
  const roles: ColumnRole[] = Array(width).fill("ignore");
  const column = (i: number) => rows.map((r) => r[i] ?? "").filter(Boolean);

  for (let i = 0; i < width; i += 1) {
    const cells = column(i);
    if (cells.length === 0) continue;
    if (cells.every(isClock)) {
      roles[i] = "duration";
      continue;
    }
    const values = cells.map(cellNumber).filter((v): v is number => v !== null);
    if (values.length < cells.length * 0.6) continue;
    const decimals = cells.some((c) => /[.,]\d/.test(c));
    // Laktat: decimaltal, aldrig över 25.
    if (!roles.includes("lactate") && decimals && Math.max(...values) <= 25) {
      roles[i] = "lactate";
      continue;
    }
    // Ett löpande stegnummer (1, 2, 3 …) är ingen belastning.
    if (values.every((v, n) => v === n + 1 || v === n)) continue;
    if (!roles.includes("intensity")) roles[i] = "intensity";
    else if (!roles.includes("heartRate")) roles[i] = "heartRate";
  }
  return roles;
}

/** Tolkar det inklistrade. `null` om det inte ser ut som en tabell. */
export function parsePasted(text: string): PastedTable | null {
  const lines = splitLines(text);
  if (lines.length === 0) return null;
  const width = Math.max(...lines.map((l) => l.length));

  // En rubrikrad har ord men nästan inga tal.
  const first = lines[0];
  const numbersInFirst = first.filter((c) => cellNumber(c) !== null).length;
  const header = numbersInFirst <= first.length / 3 ? first : null;
  const rows = header ? lines.slice(1) : lines;
  if (rows.length === 0) return null;

  let roles = guessRoles(rows, width);
  if (header) {
    const fromHeader = header.map((h): ColumnRole | null => {
      const word = h.toLowerCase();
      return HEADER_WORDS.find(([, re]) => re.test(word))?.[0] ?? null;
    });
    if (fromHeader.some((r) => r !== null)) {
      roles = roles.map(
        (guess, i) =>
          fromHeader[i] ?? (fromHeader.includes(guess) ? "ignore" : guess),
      );
    }
  }
  return { header, rows, roles };
}

export type PastedStep = {
  intensity: string;
  duration: string;
  lactate: string;
  heartRate: string;
  comment: string;
};

const sv = (v: number) => String(v).replace(".", ",");

/**
 * Raderna som steg, med kolumnerna som valts. En rad utan belastning hoppas
 * över – utom vilan, som skrivs "vila" eller 0 och blir rad 0.
 */
export function toSteps(table: PastedTable): PastedStep[] {
  const at = (row: string[], role: ColumnRole) => {
    const i = table.roles.indexOf(role);
    return i >= 0 ? (row[i] ?? "") : "";
  };
  const steps: PastedStep[] = [];
  for (const row of table.rows) {
    const rest = row.some((c) => /^vila$|^rest$|^baslinje$/i.test(c.trim()));
    const intensity = cellNumber(at(row, "intensity"));
    if (intensity === null && !rest) continue;
    const lactate = cellNumber(at(row, "lactate"));
    const hr = cellNumber(at(row, "heartRate"));
    const rpe = cellNumber(at(row, "rpe"));
    const duration = at(row, "duration").trim();
    steps.push({
      intensity: sv(rest ? 0 : (intensity as number)),
      duration: isClock(duration)
        ? duration
        : cellNumber(duration) !== null
          ? `${cellNumber(duration)}:00`
          : "",
      lactate: lactate !== null ? sv(lactate) : "",
      heartRate: hr !== null ? sv(Math.round(hr)) : "",
      comment: rpe !== null ? `RPE ${sv(rpe)}` : "",
    });
  }
  return steps;
}
