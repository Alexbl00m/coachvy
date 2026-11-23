/**
 * Ett planförslag ur AI-chatten: perioder i säsongen och pass i kalendern.
 *
 * Förslaget byggs av ett fåtal återkommande format, inte av fria pass.
 * Ett format är ett pass ur passbiblioteket, eller ett nytt pass som sparas
 * i biblioteket när förslaget läggs in. Varje pass i kalendern pekar på ett
 * format och kan ge veckans dos som en egen passrad (structure.ts) – samma
 * format, mer eller mindre av det. Så blir ett block 4 × 5, 5 × 5 och
 * 6 × 5 av samma torquepass, inte 3 × 8 en vecka och 8 × 3 nästa.
 *
 * Kontrollerna här gör filosofin till regler som går att pröva:
 *
 * - **Ett eller två kvalitetsformat** per period eller fyraveckorsblock
 *   (avsnitt 4.2).
 * - **En variabel i taget** när ett format byggs på mellan två pass
 *   (avsnitt 5): repetitioner, serier, längd, intensitet eller vila.
 * - **Fördelningen** av passen efter huvudsyfte mot fasens riktmärken
 *   (avsnitt 19).
 * - **Belastningen** vecka för vecka: TSS ur passen (workouts/load.ts), och
 *   en varning när en vecka ökar mycket mot veckan före.
 *
 * Fel stoppar förslaget; varningar följer med till modellen och coachen.
 * Förslaget läggs aldrig in utan att coachen godkänner det – AI:n är
 * underställd tränarens omdöme.
 *
 * Modulen är ren.
 */

import type { Sport } from "@/lib/calculators/lactate";
import { formatStructure, parseStructure } from "@/lib/plan-library/structure";
import {
  distribution,
  MIN_SESSIONS,
  phaseTarget,
  sessionGoal,
  type Distribution,
  type SessionGoal,
} from "@/lib/season/distribution";
import { addDays, daysBetween, isoWeek, mondayOf } from "@/lib/season/season";
import {
  LIBRARY_LEVELS,
  validateLibraryInput,
  type LibraryInput,
  type LibraryLevelKey,
} from "@/lib/session-library/library";
import { TRAINING_PHASES, type TrainingPhase } from "@/lib/tests/phases";
import { protocolByKey } from "@/lib/tests/protocols";
import { workoutLoad, type WorkoutLoad } from "@/lib/workouts/load";
import {
  flattenWorkout,
  TARGET_BASES,
  type TargetBasis,
  type Workout,
  type WorkoutBlock,
} from "@/lib/workouts/schema";

// ---------------------------------------------------------------------------
// Förslaget som det kommer från modellen
// ---------------------------------------------------------------------------

export type DraftPeriod = {
  name: string;
  phase: TrainingPhase;
  starts_on: string;
  ends_on: string;
  focus: string;
};

/** Ett nytt pass, när inget i biblioteket passar. Sparas i biblioteket. */
export type DraftNewSession = {
  title: string;
  sport: Sport;
  kind: string;
  intensity: string;
  purpose: string;
  description: string;
  progression: string;
  basis: TargetBasis;
  structure: string;
};

export type DraftFormat = {
  /** Kort nyckel passen pekar på: "hog", "torque", "distans". */
  key: string;
  library_id: string | null;
  new_session: DraftNewSession | null;
  /** Protokollet när formatet är ett test (protocols.ts). */
  test_protocol: string | null;
};

export type DraftSession = {
  date: string;
  format: string;
  /** Veckans dos som passrad; utan den formatets egen rad eller nivå. */
  structure: string | null;
  level: LibraryLevelKey | null;
  note: string | null;
};

export type PlanDraft = {
  title: string;
  /** Idén bakom planen: vad den utvecklar och varför, ur filosofin. */
  idea: string;
  periods: DraftPeriod[];
  formats: DraftFormat[];
  sessions: DraftSession[];
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const PHASES = TRAINING_PHASES.map((p) => p.key);
const SPORTS: Sport[] = ["cykling", "löpning", "simning"];
const LEVEL_KEYS = LIBRARY_LEVELS.map((l) => l.key);

export const DRAFT_LIMITS = { periods: 24, formats: 30, sessions: 220 };

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, max) : null;
const optStr = (v: unknown, max: number): string | null =>
  v === null || v === undefined ? null : str(v, max);
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Förslaget ur verktygsanropet, kontrollerat fält för fält. Indata strömmas
 * och valideras inte av API:t, så allt prövas här innan något används.
 */
export function parseDraft(
  input: unknown,
): { ok: true; draft: PlanDraft } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isObj(input))
    return { ok: false, errors: ["Förslaget är inte ett objekt."] };

  const title = str(input.title, 120);
  if (!title) errors.push("title saknas.");
  const idea = str(input.idea, 2000);
  if (!idea) errors.push("idea saknas: skriv idén bakom planen.");

  const list = (key: string, max: number): unknown[] => {
    const v = input[key];
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v)) {
      errors.push(`${key} ska vara en lista.`);
      return [];
    }
    if (v.length > max) errors.push(`${key} har fler än ${max} rader.`);
    return v.slice(0, max);
  };

  const periods: DraftPeriod[] = [];
  list("periods", DRAFT_LIMITS.periods).forEach((p, i) => {
    if (!isObj(p)) return void errors.push(`periods[${i}] är inte ett objekt.`);
    const phase = p.phase as TrainingPhase;
    const starts = str(p.starts_on, 10);
    const ends = str(p.ends_on, 10);
    if (!PHASES.includes(phase))
      errors.push(`periods[${i}].phase ska vara en av ${PHASES.join(", ")}.`);
    if (!starts || !ISO.test(starts) || !ends || !ISO.test(ends)) {
      errors.push(
        `periods[${i}] behöver starts_on och ends_on som ÅÅÅÅ-MM-DD.`,
      );
      return;
    }
    periods.push({
      name:
        str(p.name, 80) ??
        TRAINING_PHASES.find((x) => x.key === phase)?.label ??
        "Period",
      phase,
      starts_on: starts,
      ends_on: ends,
      focus: str(p.focus, 400) ?? "",
    });
  });

  const formats: DraftFormat[] = [];
  list("formats", DRAFT_LIMITS.formats).forEach((f, i) => {
    if (!isObj(f)) return void errors.push(`formats[${i}] är inte ett objekt.`);
    const key = str(f.key, 40);
    if (!key) return void errors.push(`formats[${i}].key saknas.`);
    let next: DraftNewSession | null = null;
    if (isObj(f.new_session)) {
      const n = f.new_session;
      const sport = n.sport as Sport;
      const basis = n.basis as TargetBasis;
      if (!SPORTS.includes(sport))
        errors.push(
          `formats[${i}].new_session.sport ska vara ${SPORTS.join(", ")}.`,
        );
      if (!TARGET_BASES.includes(basis))
        errors.push(
          `formats[${i}].new_session.basis ska vara en av ${TARGET_BASES.join(", ")}.`,
        );
      next = {
        title: str(n.title, 120) ?? "",
        sport,
        kind: str(n.kind, 60) ?? "",
        intensity: str(n.intensity, 40) ?? "",
        purpose: str(n.purpose, 1000) ?? "",
        description: str(n.description, 2000) ?? "",
        progression: str(n.progression, 1000) ?? "",
        basis,
        structure: str(n.structure, 2000) ?? "",
      };
    }
    formats.push({
      key,
      library_id: optStr(f.library_id, 64),
      new_session: next,
      test_protocol: optStr(f.test_protocol, 40),
    });
  });

  const sessions: DraftSession[] = [];
  list("sessions", DRAFT_LIMITS.sessions).forEach((s, i) => {
    if (!isObj(s))
      return void errors.push(`sessions[${i}] är inte ett objekt.`);
    const date = str(s.date, 10);
    const format = str(s.format, 40);
    if (!date || !ISO.test(date))
      return void errors.push(`sessions[${i}].date ska vara ÅÅÅÅ-MM-DD.`);
    if (!format) return void errors.push(`sessions[${i}].format saknas.`);
    const level = s.level as LibraryLevelKey;
    sessions.push({
      date,
      format,
      structure: optStr(s.structure, 2000),
      level: LEVEL_KEYS.includes(level) ? level : null,
      note: optStr(s.note, 400),
    });
  });

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    draft: { title: title!, idea: idea!, periods, formats, sessions },
  };
}

// ---------------------------------------------------------------------------
// Upplöst mot biblioteket
// ---------------------------------------------------------------------------

/** Det som behövs av ett bibliotekspass för att lösa upp ett format. */
export type LibraryRef = {
  id: string;
  title: string;
  sport: Sport;
  kind: string;
  intensity: string;
  basis: TargetBasis;
  blocks: WorkoutBlock[];
  levels: { key: LibraryLevelKey; blocks: WorkoutBlock[] }[];
};

export type ResolvedSession = {
  date: string;
  format: string;
  title: string;
  sport: Sport;
  basis: TargetBasis;
  blocks: WorkoutBlock[];
  /** Passraden som den blev, för kortet och modellen. */
  structure: string;
  kind: string;
  level: LibraryLevelKey | null;
  libraryId: string | null;
  isNew: boolean;
  testProtocol: string | null;
  goal: SessionGoal | null;
  load: WorkoutLoad | null;
  note: string | null;
};

export type DraftWeek = {
  monday: string;
  week: number;
  sessions: ResolvedSession[];
  seconds: number;
  tss: number;
  goals: Distribution;
};

export type DraftCheck = {
  errors: string[];
  warnings: string[];
  sessions: ResolvedSession[];
  weeks: DraftWeek[];
};

export type CheckContext = {
  today: string;
  library: Map<string, LibraryRef>;
  /** Referensen per bas, för steg i meter: FTP i W, farterna i m/s. */
  speeds?: Partial<Record<TargetBasis, number>>;
};

/** Ett nytt pass som bibliotekspass, i bibliotekets form. */
export function libraryInputOf(n: DraftNewSession): LibraryInput {
  return {
    title: n.title,
    sport: n.sport,
    kind: n.kind,
    intensity: n.intensity,
    purpose: n.purpose,
    description: n.description,
    progression: n.progression,
    adaptations: "",
    fueling: "",
    timing: "",
    phases: [],
    basis: n.basis,
    structure: n.structure,
    levels: [],
  };
}

/** Ett nytt pass kontrollerat som i biblioteket. */
export const newSessionInput = (n: DraftNewSession) =>
  validateLibraryInput(libraryInputOf(n));

const pct = (n: number) => `${Math.round(n * 100)} %`;
/** "Polariserad" blir "polariserad", men "VO₂max-block" står kvar. */
const lowerFirst = (text: string) =>
  /^\p{Lu}\p{Ll}/u.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
const GOAL_WORD: Record<SessionGoal, string> = {
  lugn: "lugnt",
  medel: "medel",
  hög: "högt",
};

export function checkDraft(draft: PlanDraft, ctx: CheckContext): DraftCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Perioderna: giltiga och utan överlapp sinsemellan.
  const periods = [...draft.periods].sort((a, b) =>
    a.starts_on.localeCompare(b.starts_on),
  );
  periods.forEach((p, i) => {
    if (p.ends_on < p.starts_on)
      errors.push(`Perioden ${p.name} slutar före den börjar.`);
    const next = periods[i + 1];
    if (next && next.starts_on <= p.ends_on) {
      errors.push(`Perioderna ${p.name} och ${next.name} överlappar.`);
    }
  });

  // Formaten: ur biblioteket eller nya, aldrig båda eller inget.
  const bases = new Map<
    string,
    {
      title: string;
      sport: Sport;
      kind: string;
      basis: TargetBasis;
      blocks: WorkoutBlock[];
      levels: LibraryRef["levels"];
      libraryId: string | null;
      isNew: boolean;
      test: string | null;
    }
  >();
  for (const f of draft.formats) {
    if (bases.has(f.key)) {
      errors.push(`Formatet ${f.key} finns två gånger.`);
      continue;
    }
    if (f.test_protocol && !protocolByKey(f.test_protocol)) {
      errors.push(
        `Formatet ${f.key}: testprotokollet ${f.test_protocol} finns inte.`,
      );
    }
    if (f.library_id && f.new_session) {
      errors.push(
        `Formatet ${f.key}: ange library_id eller new_session, inte båda.`,
      );
      continue;
    }
    if (f.library_id) {
      const lib = ctx.library.get(f.library_id);
      if (!lib) {
        errors.push(
          `Formatet ${f.key}: passet ${f.library_id} finns inte i biblioteket. Sök med verktyget bibliotek.`,
        );
        continue;
      }
      bases.set(f.key, {
        title: lib.title,
        sport: lib.sport,
        kind: lib.kind,
        basis: lib.basis,
        blocks: lib.blocks,
        levels: lib.levels,
        libraryId: lib.id,
        isNew: false,
        test: f.test_protocol,
      });
      continue;
    }
    if (f.new_session) {
      const valid = newSessionInput(f.new_session);
      if (!valid.ok) {
        errors.push(`Formatet ${f.key} (nytt pass): ${valid.error}`);
        continue;
      }
      bases.set(f.key, {
        title: valid.value.title,
        sport: valid.value.sport,
        kind: valid.value.kind,
        basis: valid.value.basis,
        blocks: valid.value.blocks,
        levels: [],
        libraryId: null,
        isNew: true,
        test: f.test_protocol,
      });
      continue;
    }
    errors.push(`Formatet ${f.key}: ange library_id eller new_session.`);
  }

  // Passen: upplösta mot sitt format, med veckans dos.
  const sessions: ResolvedSession[] = [];
  const used = new Set<string>();
  for (const s of [...draft.sessions].sort((a, b) =>
    a.date.localeCompare(b.date),
  )) {
    const base = bases.get(s.format);
    if (!base) {
      if (!draft.formats.some((f) => f.key === s.format)) {
        errors.push(
          `Passet ${s.date} pekar på formatet ${s.format}, som inte finns.`,
        );
      }
      continue;
    }
    used.add(s.format);
    if (s.date < ctx.today) {
      errors.push(`Passet ${s.date} (${s.format}) ligger före i dag.`);
      continue;
    }
    let blocks = base.blocks;
    if (s.structure) {
      if (s.structure.includes("@") && base.basis !== "MP") {
        errors.push(
          `Passet ${s.date}: zoner som @LO står mot maratonfart, och ${s.format} räknas mot ${base.basis}. Skriv procent.`,
        );
        continue;
      }
      const parsed = parseStructure(s.structure);
      if (!parsed.ok) {
        errors.push(`Passet ${s.date} (${s.format}): ${parsed.error}`);
        continue;
      }
      blocks = parsed.blocks;
    } else if (s.level) {
      blocks =
        base.levels.find((l) => l.key === s.level)?.blocks ?? base.blocks;
    }
    const workout: Pick<Workout, "sport" | "basis" | "blocks"> = {
      sport: base.sport,
      basis: base.basis,
      blocks,
    };
    sessions.push({
      date: s.date,
      format: s.format,
      title: base.title,
      sport: base.sport,
      basis: base.basis,
      blocks,
      structure: formatStructure(blocks, { zones: base.basis === "MP" }),
      kind: base.kind,
      level: s.structure ? null : s.level,
      libraryId: base.libraryId,
      isNew: base.isNew,
      testProtocol: base.test,
      goal: sessionGoal(workout, 0),
      load: workoutLoad(workout, ctx.speeds?.[base.basis] ?? null),
      note: s.note,
    });
  }
  for (const f of draft.formats) {
    if (!used.has(f.key) && bases.has(f.key)) {
      warnings.push(`Formatet ${f.key} används inte av något pass.`);
    }
  }

  // Fler än två pass samma dag är sällan avsikten.
  const perDay = new Map<string, number>();
  for (const s of sessions) perDay.set(s.date, (perDay.get(s.date) ?? 0) + 1);
  for (const [date, n] of perDay) {
    if (n > 2) warnings.push(`${date} har ${n} pass.`);
  }

  warnings.push(...qualityFormatWarnings(sessions, periods));
  warnings.push(...progressionWarnings(sessions));
  warnings.push(...distributionWarnings(sessions, periods));

  const weeks = weeksOf(sessions);
  warnings.push(...rampWarnings(weeks));

  return { errors, warnings, sessions, weeks };
}

// ---------------------------------------------------------------------------
// Filosofins kontroller
// ---------------------------------------------------------------------------

const isQuality = (s: ResolvedSession) =>
  !s.testProtocol && (s.goal === "medel" || s.goal === "hög");

/** Passen grupperade i perioder, eller i fyraveckorsblock utan perioder. */
function blocksOf(
  sessions: ResolvedSession[],
  periods: DraftPeriod[],
): { name: string; period: DraftPeriod | null; sessions: ResolvedSession[] }[] {
  const out = new Map<
    string,
    { name: string; period: DraftPeriod | null; sessions: ResolvedSession[] }
  >();
  const first = sessions[0]?.date;
  for (const s of sessions) {
    const period =
      periods.find((p) => s.date >= p.starts_on && s.date <= p.ends_on) ?? null;
    let key: string;
    let name: string;
    if (period) {
      key = `p:${period.starts_on}`;
      name = period.name;
    } else {
      const index = Math.floor(daysBetween(mondayOf(first!), s.date) / 28);
      const start = addDays(mondayOf(first!), index * 28);
      key = `b:${start}`;
      name = `veckorna ${isoWeek(start)}–${isoWeek(addDays(start, 27))}`;
    }
    const group = out.get(key) ?? { name, period, sessions: [] };
    group.sessions.push(s);
    out.set(key, group);
  }
  return [...out.values()];
}

function qualityFormatWarnings(
  sessions: ResolvedSession[],
  periods: DraftPeriod[],
): string[] {
  const out: string[] = [];
  for (const block of blocksOf(sessions, periods)) {
    const formats = [
      ...new Set(block.sessions.filter(isQuality).map((s) => s.format)),
    ];
    // Ett block längre än sex veckor får fler format över tid.
    const span = block.period
      ? daysBetween(block.period.starts_on, block.period.ends_on) + 1
      : 28;
    const allowed = span > 42 ? 3 : 2;
    if (formats.length > allowed) {
      out.push(
        `${block.name} har ${formats.length} kvalitetsformat (${formats.join(", ")}). Filosofin bygger ett block på ett eller två återkommande format (avsnitt 4.2).`,
      );
    }
  }
  return out;
}

/** Ett pass form, för att se vad som ändras mellan två pass av samma format. */
export type Shape =
  | {
      kind: "intervall";
      series: number;
      reps: number;
      work: number;
      workPct: number;
      rest: number;
    }
  | { kind: "jämnt"; seconds: number; pct: number };

const mid = (s: { low: number; high: number }) => (s.low + s.high) / 2;

export function shapeOf(blocks: WorkoutBlock[]): Shape | null {
  const reps = blocks.filter(
    (b): b is Extract<WorkoutBlock, { type: "repetition" }> =>
      b.type === "repetition",
  );
  if (reps.length > 0) {
    const workOf = (b: (typeof reps)[number]) => {
      const steps = b.steps.filter(
        (s) => (s.durationSeconds ?? 0) > 0 || (s.distanceM ?? 0) > 0,
      );
      const work = [...steps].sort((a, z) => mid(z) - mid(a))[0];
      const rest = steps.filter((s) => s !== work);
      return { work, rest };
    };
    const main = [...reps].sort((a, z) => {
      const w = (b: typeof a) =>
        b.times *
        (workOf(b).work?.durationSeconds ?? workOf(b).work?.distanceM ?? 0);
      return w(z) - w(a);
    })[0];
    const { work, rest } = workOf(main);
    if (!work) return null;
    const same = reps.filter((b) => {
      const w = workOf(b).work;
      return (
        w &&
        w.durationSeconds === work.durationSeconds &&
        w.distanceM === work.distanceM &&
        Math.abs(mid(w) - mid(work)) < 0.005
      );
    });
    return {
      kind: "intervall",
      series: same.length,
      reps: main.times,
      work: work.durationSeconds ?? work.distanceM ?? 0,
      workPct: Math.round(mid(work) * 100),
      rest: rest.reduce(
        (t, s) => t + (s.durationSeconds ?? s.distanceM ?? 0),
        0,
      ),
    };
  }
  const steps = flattenWorkout({ blocks } as Workout)
    .map((f) => f.step)
    .filter((s) => s.kind !== "uppvärmning" && s.kind !== "nedvarvning");
  const main = [...steps].sort(
    (a, z) =>
      (z.durationSeconds ?? z.distanceM ?? 0) -
      (a.durationSeconds ?? a.distanceM ?? 0),
  )[0];
  if (!main) return null;
  return {
    kind: "jämnt",
    seconds: steps.reduce(
      (t, s) => t + (s.durationSeconds ?? s.distanceM ?? 0),
      0,
    ),
    pct: Math.round(mid(main) * 100),
  };
}

/** Variablerna som skiljer två former åt, i ord. */
export function changedVariables(a: Shape, b: Shape): string[] {
  if (a.kind !== b.kind) return ["passets form"];
  if (a.kind === "intervall" && b.kind === "intervall") {
    const out: string[] = [];
    if (a.series !== b.series) out.push(`serier ${a.series}→${b.series}`);
    if (a.reps !== b.reps) out.push(`repetitioner ${a.reps}→${b.reps}`);
    if (a.work !== b.work) out.push(`intervallens längd ${a.work}→${b.work}`);
    if (Math.abs(a.workPct - b.workPct) >= 1)
      out.push(`intensitet ${a.workPct}→${b.workPct} %`);
    if (a.rest !== b.rest) out.push(`vila ${a.rest}→${b.rest}`);
    return out;
  }
  if (a.kind === "jämnt" && b.kind === "jämnt") {
    const out: string[] = [];
    if (Math.abs(a.pct - b.pct) >= 3)
      out.push(`intensitet ${a.pct}→${b.pct} %`);
    return out;
  }
  return [];
}

function progressionWarnings(sessions: ResolvedSession[]): string[] {
  const out: string[] = [];
  const byFormat = new Map<string, ResolvedSession[]>();
  for (const s of sessions.filter(isQuality)) {
    byFormat.set(s.format, [...(byFormat.get(s.format) ?? []), s]);
  }
  for (const [format, list] of byFormat) {
    for (let i = 1; i < list.length; i += 1) {
      const a = shapeOf(list[i - 1].blocks);
      const b = shapeOf(list[i].blocks);
      if (!a || !b) continue;
      const changed = changedVariables(a, b);
      if (changed.length > 1) {
        out.push(
          `${format} ${list[i - 1].date} → ${list[i].date} ändrar ${changed.length} variabler (${changed.join(", ")}). Progressionen ändrar en variabel i taget (avsnitt 5).`,
        );
      }
    }
  }
  return out;
}

function distributionWarnings(
  sessions: ResolvedSession[],
  periods: DraftPeriod[],
): string[] {
  const out: string[] = [];
  for (const period of periods) {
    const within = sessions.filter(
      (s) => s.date >= period.starts_on && s.date <= period.ends_on,
    );
    const counts = distribution(within.map((s) => s.goal));
    if (counts.total < MIN_SESSIONS) continue;
    const target = phaseTarget(
      { phase: period.phase, focus: period.focus },
      null,
    );
    if (!target.bands) continue;
    for (const goal of ["lugn", "medel", "hög"] as SessionGoal[]) {
      const share = counts[goal] / counts.total;
      const band = target.bands[goal];
      if (share < band.min - 0.05 || share > band.max + 0.05) {
        out.push(
          `${period.name}: ${pct(share)} ${GOAL_WORD[goal]} av passen, riktmärket (${lowerFirst(target.model)}) är ${band.min <= 0 ? `upp till ${pct(band.max)}` : band.max >= 1 ? `minst ${pct(band.min)}` : `${Math.round(band.min * 100)}–${pct(band.max)}`} (avsnitt 19).`,
        );
      }
    }
  }
  return out;
}

export function weeksOf(sessions: ResolvedSession[]): DraftWeek[] {
  const map = new Map<string, ResolvedSession[]>();
  for (const s of sessions) {
    const m = mondayOf(s.date);
    map.set(m, [...(map.get(m) ?? []), s]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monday, list]) => ({
      monday,
      week: isoWeek(monday),
      sessions: list,
      seconds: list.reduce((t, s) => t + (s.load?.seconds ?? 0), 0),
      tss: list.reduce((t, s) => t + (s.load?.tss ?? 0), 0),
      goals: distribution(list.map((s) => s.goal)),
    }));
}

function rampWarnings(weeks: DraftWeek[]): string[] {
  const out: string[] = [];
  for (let i = 1; i < weeks.length; i += 1) {
    const before = weeks[i - 1];
    const now = weeks[i];
    // Bara veckor som följer direkt på varandra jämförs.
    if (daysBetween(before.monday, now.monday) !== 7 || before.tss < 100)
      continue;
    const rise = now.tss / before.tss - 1;
    if (rise > 0.2) {
      out.push(
        `Vecka ${now.week} ökar planerad TSS med ${Math.round(rise * 100)} % mot vecka ${before.week} (${Math.round(before.tss)} → ${Math.round(now.tss)}).`,
      );
    }
  }
  return out;
}

/** Det modellen får tillbaka: fel, varningar och veckorna i korthet. */
export function checkSummary(check: DraftCheck) {
  return {
    errors: check.errors,
    warnings: check.warnings,
    weeks: check.weeks.map((w) => ({
      vecka: w.week,
      måndag: w.monday,
      pass: w.sessions.length,
      timmar: Math.round((w.seconds / 3600) * 10) / 10,
      tss: Math.round(w.tss),
      lugnt: w.goals.lugn,
      medel: w.goals.medel,
      högt: w.goals.hög,
    })),
  };
}
