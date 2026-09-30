/**
 * Trendlinje och en kort kommentar för en tidsserie av testvärden.
 *
 * Regelbaserad, inte en språkmodell: samma tester ger alltid samma text, och
 * varje mening går att följa tillbaka till en siffra. Trendlinjen är en rak
 * linje genom punkterna över tid (minsta kvadrat), och lutningen uttrycks som
 * förändring per år – det mått en coach tänker i mellan två säsonger.
 */

const DAY = 86_400_000;
const YEAR = 365.25 * DAY;

export type TrendInput = { t: number; value: number }[];

export type TrendReading = {
  /** Linjens värde vid tiden t – för att rita den. */
  at: (t: number) => number;
  /** Förändring per år: procent, eller procentenheter för %-storheter. */
  perYear: number | null;
  /** Andel av variationen linjen förklarar, 0–1. null under tre punkter. */
  rSquared: number | null;
  text: string;
};

const sv = (v: number, digits = 1) => v.toFixed(digits).replace(".", ",");
const signed = (v: number, digits = 1) =>
  `${v > 0 ? "+" : v < 0 ? "−" : "±"}${sv(Math.abs(v), digits)}`;

function span(ms: number): string {
  const months = Math.round(ms / (30.44 * DAY));
  if (months < 2) return `${Math.max(1, Math.round(ms / DAY / 7))} veckor`;
  if (months < 24) return `${months} månader`;
  return `${sv(ms / YEAR, 1)} år`;
}

/**
 * Läser en serie. `inPoints` betyder att värdet redan är en procent
 * (utnyttjandegrad, fartvariation) och ändras i procentenheter.
 * `higherIsBetter` null betyder att riktningen inte är bra eller dålig i sig.
 */
export function readTrend(
  points: TrendInput,
  higherIsBetter: boolean | null,
  inPoints = false,
): TrendReading {
  const n = points.length;
  const flat = (v: number) => () => v;
  if (n === 0) return { at: flat(0), perYear: null, rSquared: null, text: "" };
  if (n === 1) {
    return {
      at: flat(points[0].value),
      perYear: null,
      rSquared: null,
      text: "Ett test hittills – trenden kommer med nästa.",
    };
  }

  const first = points[0];
  const last = points[n - 1];
  const change = (from: number, to: number) =>
    inPoints ? to - from : from !== 0 ? ((to - from) / from) * 100 : 0;
  const unit = inPoints ? "procentenheter" : "%";
  const good = (delta: number) =>
    higherIsBetter === null
      ? null
      : delta === 0
        ? null
        : delta > 0 === higherIsBetter;

  if (n === 2) {
    const d = change(first.value, last.value);
    const verdict =
      Math.abs(d) < (inPoints ? 1 : 1.5)
        ? "i stort sett oförändrat"
        : good(d) === true
          ? "framåt"
          : good(d) === false
            ? "bakåt"
            : d > 0
              ? "uppåt"
              : "nedåt";
    return {
      at: (t) =>
        first.value +
        ((last.value - first.value) * (t - first.t)) / (last.t - first.t || 1),
      perYear: null,
      rSquared: null,
      text: `${signed(d)} ${unit} på ${span(last.t - first.t)} – ${verdict}. Ett tredje test gör trenden säkrare.`,
    };
  }

  // Minsta kvadrat över tiden, i år från första testet.
  const xs = points.map((p) => (p.t - first.t) / YEAR);
  const ys = points.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const sxy = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const slope = sxx > 0 ? sxy / sxx : 0;
  const intercept = my - slope * mx;
  const fit = (x: number) => intercept + slope * x;
  const ssTot = ys.reduce((s, y) => s + (y - my) ** 2, 0);
  const ssRes = ys.reduce((s, y, i) => s + (y - fit(xs[i])) ** 2, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : null;
  const perYear = inPoints ? slope : my !== 0 ? (slope / my) * 100 : 0;
  const at = (t: number) => fit((t - first.t) / YEAR);

  const sentences: string[] = [];
  const noisy = rSquared !== null && rSquared < 0.3 && n >= 4;
  if (Math.abs(perYear) < (inPoints ? 0.5 : 1)) {
    sentences.push(
      `I stort sett oförändrat över ${n} tester och ${span(last.t - first.t)}.`,
    );
  } else {
    const word =
      good(perYear) === true
        ? "framåt"
        : good(perYear) === false
          ? "bakåt"
          : perYear > 0
            ? "uppåt"
            : "nedåt";
    sentences.push(
      `Trenden går ${word}: ${signed(perYear)} ${unit} per år över ${n} tester${noisy ? ", men spridningen är stor och trenden osäker" : ""}.`,
    );
  }

  // Har det planat ut? De tre senaste inom en snäv marginal.
  const lastThree = ys.slice(-3);
  const spread =
    ((Math.max(...lastThree) - Math.min(...lastThree)) / (Math.abs(my) || 1)) *
    100;
  const plateau = !inPoints && spread < 2 && Math.abs(perYear) >= 1;
  if (plateau) {
    sentences.push(
      `De tre senaste testerna ligger inom ${sv(spread)} % – det har planat ut.`,
    );
  }

  // Senaste testet mot linjen: ett kliv, eller en sämre dag.
  const residual = change(at(last.t), last.value);
  if (!plateau && Math.abs(residual) >= (inPoints ? 2 : 3)) {
    const better = good(residual);
    sentences.push(
      better === false
        ? `Senaste testet ligger ${sv(Math.abs(residual))} ${unit} under linjen – värt att se över dagsform, testförhållanden och belastningen innan.`
        : better === true
          ? `Senaste testet ligger ${sv(Math.abs(residual))} ${unit} över linjen – ett kliv framåt.`
          : `Senaste testet avviker ${sv(Math.abs(residual))} ${unit} från linjen.`,
    );
  }

  return { at, perYear, rSquared, text: sentences.join(" ") };
}

type SeriesLike = {
  key: string;
  label: string;
  unit: string;
  points: { performedOn: string; value: number }[];
};

/**
 * En kort analys av utvecklingen i en gren, ur tidslinjerna: vart tröskeln
 * och VO2max har rört sig, och vad kombinationen säger om vad träningen har
 * gjort. Varje mening bygger på förändringen från första till senaste test.
 */
export function summariseProgress(series: SeriesLike[], today = new Date()) {
  const pick = (...keys: string[]) =>
    keys
      .map(
        (k) =>
          series
            .filter((s) => s.key === k && s.points.length >= 2)
            .sort((a, b) => b.points.length - a.points.length)[0],
      )
      .find(Boolean) ?? null;
  const change = (s: SeriesLike) => {
    const first = s.points[0];
    const last = s.points[s.points.length - 1];
    return {
      pct:
        first.value !== 0
          ? ((last.value - first.value) / first.value) * 100
          : 0,
      since: first.performedOn,
      years:
        (Date.parse(last.performedOn) - Date.parse(first.performedOn)) / YEAR,
    };
  };
  const when = (iso: string) => iso.slice(0, 7);
  const sentences: string[] = [];

  const threshold = pick("LT2", "CP", "FTP", "CS", "VDOT");
  const vo2 = pick("VO2max", "VO2max_est");
  const thr = threshold ? change(threshold) : null;
  const v = vo2 ? change(vo2) : null;

  if (threshold && thr) {
    sentences.push(
      `${threshold.label}: ${signed(thr.pct)} % sedan ${when(thr.since)}${thr.years >= 1.5 ? `, ungefär ${signed(thr.pct / thr.years)} % per år` : ""}.`,
    );
  }
  if (vo2 && v) {
    sentences.push(`${vo2.label}: ${signed(v.pct)} % sedan ${when(v.since)}.`);
  }
  // Slutsatser om samspelet bara när båda serierna täcker ungefär samma
  // period – tröskeln sedan 2023 mot VO2max sedan i fjol säger ingenting.
  const samePeriod =
    thr &&
    v &&
    Math.abs(Date.parse(thr.since) - Date.parse(v.since)) <= 183 * DAY;
  if (thr && v && !samePeriod) {
    sentences.push(
      "Tröskeln och VO2max är mätta över olika perioder, så de jämförs inte med varandra här.",
    );
  }
  if (thr && v && samePeriod) {
    if (thr.pct >= 3 && Math.abs(v.pct) < 2) {
      sentences.push(
        "Tröskeln har flyttats upp utan att VO2max ändrats – förbättringen sitter i utnyttjandegraden. Det är vad tröskel- och distansträning brukar ge.",
      );
    } else if (v.pct >= 3 && thr.pct < 1.5) {
      sentences.push(
        "Taket har höjts men tröskeln har inte följt med. Tröskelarbete har mest att ge nu, så att den större motorn också används.",
      );
    } else if (thr.pct >= 3 && v.pct >= 3) {
      sentences.push(
        "Tröskel och VO2max har ökat i takt – hela den aeroba motorn har vuxit.",
      );
    }
  }
  if (thr && thr.pct <= -3) {
    sentences.push(
      "Tröskeln har gått tillbaka. Jämför med perioden före testet – uppehåll, sjukdom eller en tung träningsperiod ger samma bild.",
    );
  }

  const vla = pick("VLamax");
  if (vla) {
    const c = change(vla);
    if (c.pct <= -5) {
      sentences.push(
        `VLamax har sjunkit ${sv(Math.abs(c.pct), 0)} % – en mer uthållig profil med högre tröskel och FatMax vid samma VO2max, men mindre spurtkraft.`,
      );
    } else if (c.pct >= 5) {
      sentences.push(
        `VLamax har ökat ${sv(c.pct, 0)} % – mer spurtkraft, men tröskeln och FatMax pressas nedåt vid samma VO2max.`,
      );
    }
  }
  const fat = pick("FatMax");
  if (fat) {
    const c = change(fat);
    if (c.pct >= 5) {
      sentences.push(
        `FatMax har flyttats upp ${sv(c.pct, 0)} % – mer av grundpassen går på fett.`,
      );
    }
  }

  const newest = series
    .flatMap((s) => s.points.map((p) => p.performedOn))
    .sort()
    .pop();
  if (newest) {
    const months = (today.getTime() - Date.parse(newest)) / (30.44 * DAY);
    if (months >= 6) {
      sentences.push(
        `Senaste testet är ${Math.round(months)} månader gammalt – ett nytt visar var formen ligger nu.`,
      );
    }
  }
  return sentences;
}
