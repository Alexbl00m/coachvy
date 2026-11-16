/**
 * Kvalitetskontroller för distanstestet: fel som stoppar beräkningen och varningar som
 * talar om när testerna pekar åt olika håll eller resultaten ligger utanför det rimliga.
 */
import {
  CP_EFFORT_RANGE,
  estimateProfile,
  filledSprint,
  MarkerKey,
  MIN_SPRINT_SECONDS,
  pickAerobicTest,
  ProfileEstimate,
  RemoteTestInput,
  sprintLactateVlamax,
  usableSprint,
} from "./inversion";

export type FlagLevel = "error" | "warning" | "info";

export interface QualityFlag {
  level: FlagLevel;
  code: string;
  title: string;
  message: string;
}

const nf = (n: number, d = 0) =>
  n.toLocaleString("sv-SE", { minimumFractionDigits: d, maximumFractionDigits: d });

export const durationLabel = (sec: number) => {
  if (sec < 90) return `${nf(sec)} s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m}:${String(s).padStart(2, "0")} min` : `${m} min`;
};

/** Fel i indata som gör att beräkningen inte kan köras */
export const validateInput = (input: RemoteTestInput): QualityFlag[] => {
  const flags: QualityFlag[] = [];
  const error = (code: string, title: string, message: string) => flags.push({ level: "error", code, title, message });

  if (!(input.bodyMass >= 35 && input.bodyMass <= 150)) {
    error("body-mass", "Kroppsvikten saknas", "Ange en kroppsvikt mellan 35 och 150 kg.");
  }
  if (!input.volRelOverride && !(input.bodyFatPct >= 3 && input.bodyFatPct <= 45)) {
    error("body-fat", "Kroppsfettet saknas", "Ange kroppsfett mellan 3 och 45 %. Uppskatta hellre än att lämna tomt.");
  }
  // Sprinten är valfri, men om den finns ska den vara komplett
  const s = input.sprint;
  const sprintGiven = !!s && (Number.isFinite(s.durationSec) || Number.isFinite(s.power));
  const sprintValid = !!s && s.durationSec >= 5 && s.durationSec <= 35 && s.power >= 150 && s.power <= 3000;
  if (sprintGiven && !sprintValid) {
    error("sprint", "Sprinten är ofullständig", "Ange både sprintens längd (5–35 s) och medeleffekt i watt, eller lämna båda tomma.");
  }
  const la = input.sprintLactate;
  if (la && Number.isFinite(la.peak)) {
    if (!sprintValid) {
      error("sprint-lactate-no-sprint", "Sprinten saknas", "Sprintlaktatet kräver sprintens längd och effekt.");
    } else if (!(la.peak >= 2 && la.peak <= 30) || (la.rest != null && la.rest > 0 && la.rest >= la.peak)) {
      error("sprint-lactate", "Orimligt sprintlaktat", "Högsta laktat efter sprinten ska vara 2–30 mmol/L och högre än vilolaktatet.");
    }
  }
  const long = input.efforts.filter((e) => e.durationSec > 0 && e.power > 0);
  if (!usableSprint(input) && !pickAerobicTest(long)) {
    error(
      "no-sprint-no-aerobic",
      "För få test",
      "Utan sprint behövs ett maximalt test på 2–7 minuter, helst 3 minuter, för att VO2max och VLaMax ska gå att skilja åt."
    );
  }
  const inRange = long.filter((e) => e.durationSec >= CP_EFFORT_RANGE.min && e.durationSec <= CP_EFFORT_RANGE.max);
  if (inRange.length < 2) {
    error("efforts", "För få längre test", "Det behövs minst två maximala test på 2–25 minuter, helst 3, 6 och 12 min.");
  }
  if (long.length !== inRange.length) {
    error("effort-range", "Test utanför 2–25 min", "De längre testerna ska vara mellan 2 och 25 minuter.");
  }
  const sorted = [...long].sort((a, b) => a.durationSec - b.durationSec);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].power >= sorted[i - 1].power) {
      error(
        "order",
        "Effekten ökar med tiden",
        `${durationLabel(sorted[i].durationSec)} har högre eller samma effekt som ${durationLabel(sorted[i - 1].durationSec)}. Kontrollera att testerna är rätt inmatade.`
      );
      break;
    }
  }
  if (sprintValid && sorted.length && s.power <= sorted[0].power) {
    error("sprint-order", "Sprinten är för låg", "Sprintens effekt måste vara högre än det kortaste längre testet.");
  }
  return flags;
};

const MARKER_LABEL: Record<MarkerKey, string> = {
  aerobic: "VO2max-testet (3 min)",
  glycolytic: "sprinten",
  threshold: "CP ur 3–12-minuterstesterna",
};

/** Hur långt ifrån modellen en markör får ligga innan den flaggas, i procent */
const MARKER_TOLERANCE: Record<MarkerKey, number> = { aerobic: 4, glycolytic: 10, threshold: 5 };

/** Varningar och upplysningar efter beräkningen */
export const assessQuality = (input: RemoteTestInput, est: ProfileEstimate): QualityFlag[] => {
  const flags: QualityFlag[] = [];
  const add = (level: FlagLevel, code: string, title: string, message: string) =>
    flags.push({ level, code, title, message });
  const bw = input.bodyMass;

  // Testernas genomförande
  const sprint = usableSprint(input);
  const filled = filledSprint(input);
  if (!sprint && filled) {
    add(
      "warning",
      "short-sprint",
      "Sprinten är för kort",
      `Sprinten var ${nf(filled.durationSec)} s. Under 15 s går VLaMax inte att räkna ur watten, så profilen är räknad utan sprinten. Kör 15–20 s nästa gång, eller mät laktat efter sprinten.`
    );
  } else if (!sprint) {
    add(
      "warning",
      "no-sprint",
      "Ingen sprint",
      "VLaMax skattas då ur 3-minuterstestet och CP och blir osäkrare. En sprint på 15–20 s ger en säkrare VLaMax."
    );
  } else if (sprint.durationSec < MIN_SPRINT_SECONDS || sprint.durationSec > 25) {
    add("info", "sprint-length", "Sprintens längd", "Sprinten bör vara 15–20 s. Kortare eller längre sprintar gör VLaMax osäkrare.");
  }
  if (!est.aerobicTest) {
    add(
      "warning",
      "no-aerobic-test",
      "Inget VO2max-test",
      "Inget test på 2–7 minuter finns. VO2max skattas då bara ur sprinten och CP och blir osäkrare."
    );
  }
  if (est.cp) {
    const long = est.cp.residuals.length;
    if (long < 3) {
      add("info", "two-efforts", "Två längre test", "Med tre längre test (3, 6 och 12 min) blir CP och tröskeln säkrare.");
    }
    for (const r of est.cp.residuals) {
      if (Math.abs(r.deviationPct) >= 2) {
        const dir = r.deviationPct < 0 ? "under" : "över";
        add(
          Math.abs(r.deviationPct) >= 4 ? "warning" : "info",
          `cp-residual-${r.durationSec}`,
          `${durationLabel(r.durationSec)} avviker från CP-kurvan`,
          `Testet ligger ${nf(Math.abs(r.deviationPct), 1)} % ${dir} kurvan (${nf(r.power)} W mot väntat ${nf(r.predicted)} W). ` +
            (r.deviationPct < 0
              ? "Det tyder på för försiktigt tempo, trötthet eller avbrott."
              : "Testet var starkt jämfört med de andra; kontrollera tempot i övriga test.")
        );
      }
    }
    const wkg = est.cp.wPrime / 1000 / bw;
    if (wkg < 0.1 || wkg > 0.45) {
      add(
        "warning",
        "wprime",
        "Ovanligt W′",
        `W′ blev ${nf(est.cp.wPrime / 1000, 1)} kJ (${nf(wkg, 2)} kJ/kg). Vanligt är 0,15–0,40 kJ/kg. Kontrollera testernas tider och effekter.`
      );
    }
  }

  // Pekar testerna åt samma håll?
  const off = est.markers.filter((m) => Math.abs(m.deviationPct) > MARKER_TOLERANCE[m.key]);
  // Stämmer minst tre längre test med CP-kurvan är det sprinten som avviker
  const longAgree =
    !!est.cp && est.cp.residuals.length >= 3 && est.cp.residuals.every((r) => Math.abs(r.deviationPct) < 2);
  const withoutSprint = off.length && sprint && longAgree ? estimateProfile({ ...input, sprint: null }) : null;
  if (withoutSprint) {
    const higher = est.vlamax > withoutSprint.vlamax;
    const atPart = (e: ProfileEstimate) => (e.engine.at ? ` och AT ${nf(e.engine.at.power)} W` : "");
    add(
      "warning",
      "sprint-conflict",
      "Sprinten och de längre testerna pekar åt olika håll",
      `De längre testerna stämmer med varandra, men sprinten ger ${higher ? "högre" : "lägre"} VLaMax än de stöder. ` +
        `Med sprinten blir VLaMax ${nf(est.vlamax, 2)}${atPart(est)}, utan den ${nf(withoutSprint.vlamax, 2)}${atPart(withoutSprint)}. ` +
        (sprintLactateVlamax(input)
          ? "Kontrollera laktatmätningen: högsta värdet kommer oftast 3–7 minuter efter sprinten."
          : higher
          ? "Antingen ger sprinten för hög VLaMax, vilket är vanligt hos atleter med stark sprint, eller så ligger CP ovanligt högt över tröskeln. Mät laktat efter sprinten om det går."
          : "Kontrollera att sprinten var maximal.") +
        " Ett laktattest avgör. Annars kan du räkna utan sprinten."
    );
  } else if (off.length) {
    const parts = off.map(
      (m) => `${MARKER_LABEL[m.key]} säger ${nf(m.test)} W men modellen ${nf(m.model)} W (${m.deviationPct > 0 ? "+" : ""}${nf(m.deviationPct, 1)} %)`
    );
    add(
      "warning",
      "markers",
      "Testerna pekar åt olika håll",
      `${parts.join("; ")}. Kontrollera det testet, eller vikta upp det test du litar mest på.`
    );
  }

  // Rimlighet
  if (est.vo2max < 35 || est.vo2max > 90) {
    add("warning", "vo2max-range", "VO2max utanför normalspannet", `VO2max blev ${nf(est.vo2max, 1)} ml/kg/min. Kontrollera vikt och testvärden.`);
  }
  if (est.vlamax < 0.15 || est.vlamax > 1.0) {
    add("warning", "vlamax-range", "VLaMax utanför normalspannet", `VLaMax blev ${nf(est.vlamax, 2)} mmol/L/s. Kontrollera sprinten.`);
  }
  const at = est.engine.at;
  if (!at) {
    add("warning", "no-at", "Ingen tröskel hittades", "Modellen hittar ingen anaerob tröskel med de här värdena.");
  } else if (est.cp) {
    const ratio = at.power / est.cp.cp;
    if (ratio < 0.85 || ratio > 1.03) {
      add(
        "info",
        "at-cp",
        "Tröskeln ligger långt från CP",
        `AT är ${nf(100 * ratio)} % av CP. Vanligt är 88–100 %. Det kan vara rätt för en mycket glykolytisk eller mycket aerob profil, men kontrollera testerna.`
      );
    }
  }
  if (input.sex === "female" && !input.volRelOverride) {
    add(
      "info",
      "female-volrel",
      "Fördelningsvolym för kvinnor",
      "Fördelningsvolymen räknas ur kroppsfett med en regression som ännu inte är kontrollerad mot referensdata för kvinnor."
    );
  }
  return flags;
};
