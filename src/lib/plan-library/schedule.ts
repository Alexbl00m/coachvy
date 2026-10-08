/**
 * Medlemmens schema, räknat fram – inte lagrat.
 *
 * Ur versionen (veckor, pass, varianter), veckokartan från starten,
 * nivåhistoriken och medlemmens avvikelser byggs planen vecka för vecka.
 * Ett pass har alltid sitt ursprungliga datum kvar bredvid det det flyttats
 * till, så att originalet och ändringen går att skilja åt. Ett nivåbyte
 * byter variant på passen från den vecka bytet gäller; passen själva, och
 * det medlemmen loggat, ligger kvar.
 *
 * Ett pass som saknar variant för veckans nivå ingår inte på den nivån –
 * så får en lägre nivå färre pass i veckan.
 *
 * Modulen är ren.
 */

import { addDays } from "@/lib/season/season";

import { levelForWeek } from "./levels";
import { planWeekOf, planWeekStart } from "./periodization";
import { roundOf, roundSpans } from "./rounds";
import type {
  LevelChange,
  LogStatus,
  Override,
  SessionLog,
  TemplateSession,
  TemplateWeek,
  Variant,
  WeekKind,
  WeekVolume,
} from "./types";
import { volumeFor, type VolumeRange } from "./volume";

export type SessionState = "original" | "flyttad" | "ersatt" | "struken";

export type ScheduledSession = {
  /** Unik i planen: veckan och passet. */
  key: string;
  week: number;
  session: TemplateSession;
  variant: Variant;
  levelId: string;
  /** Dagen i mallen. Null: valfri dag. */
  plannedDate: string | null;
  /** Dagen passet ligger på nu, efter en eventuell flytt. */
  date: string | null;
  state: SessionState;
  override: Override | null;
  log: SessionLog | null;
};

export type ScheduleWeek = {
  week: number;
  startsOn: string;
  endsOn: string;
  templateWeekId: string;
  phaseId: string;
  kind: WeekKind;
  levelId: string;
  /** Varvet veckan ligger i, 1 är första. */
  round: number;
  /** Sista veckan i ett varv som inte är det sista: ett testlopp. */
  roundEnd: boolean;
  /** Formuppskattningen ses över i slutet av veckan. */
  checkpoint: boolean;
  /** Veckans volym på veckans nivå. */
  volume: VolumeRange | null;
  sessions: ScheduledSession[];
};

export const sessionKey = (week: number, sessionId: string) =>
  `${week}:${sessionId}`;

export function buildSchedule(input: {
  startDate: string;
  weekMap: string[];
  templateWeeks: TemplateWeek[];
  sessions: TemplateSession[];
  startLevelId: string;
  changes: LevelChange[];
  overrides: Override[];
  logs: SessionLog[];
  /** Varvens längd. Null: ett varv. */
  rounds?: number[] | null;
  volumes?: WeekVolume[];
}): ScheduleWeek[] {
  const rounds = roundSpans(input.rounds, input.weekMap.length);
  const weeksById = new Map(input.templateWeeks.map((w) => [w.id, w]));
  const overrides = new Map(
    input.overrides.map((o) => [sessionKey(o.planWeek, o.sessionId), o]),
  );
  const logs = new Map(
    input.logs.map((l) => [sessionKey(l.planWeek, l.sessionId), l]),
  );

  return input.weekMap.flatMap((templateWeekId, i): ScheduleWeek[] => {
    const tw = weeksById.get(templateWeekId);
    if (!tw) return [];
    const week = i + 1;
    const startsOn = planWeekStart(input.startDate, week);
    const levelId = levelForWeek(input.startLevelId, input.changes, week);

    const sessions = input.sessions
      .filter((s) => s.weekId === templateWeekId)
      .sort(
        (a, b) =>
          (a.day ?? 7) - (b.day ?? 7) ||
          a.position - b.position ||
          a.title.localeCompare(b.title, "sv"),
      )
      .flatMap((session): ScheduledSession[] => {
        const variant = session.variants.find((v) => v.levelId === levelId);
        if (!variant) return [];
        const key = sessionKey(week, session.id);
        const override = overrides.get(key) ?? null;
        const plannedDate =
          session.day === null ? null : addDays(startsOn, session.day);
        const state: SessionState = !override
          ? "original"
          : override.action === "flytta"
            ? "flyttad"
            : override.action === "ersätt"
              ? "ersatt"
              : "struken";
        return [
          {
            key,
            week,
            session,
            variant,
            levelId,
            plannedDate,
            date:
              override?.action === "flytta" ? override.movedTo : plannedDate,
            state,
            override,
            log: logs.get(key) ?? null,
          },
        ];
      });

    return [
      {
        week,
        startsOn,
        endsOn: addDays(startsOn, 6),
        templateWeekId,
        phaseId: tw.phaseId,
        kind: tw.kind,
        levelId,
        round: roundOf(rounds, week).round,
        roundEnd: rounds.some(
          (r) => r.toWeek === week && r.round < rounds.length,
        ),
        checkpoint: tw.checkpoint ?? false,
        volume: volumeFor(input.volumes ?? [], templateWeekId, levelId),
        sessions,
      },
    ];
  });
}

/** Planveckan i dag, begränsad till planen: 1 före start, sista veckan efter slut. */
export function currentPlanWeek(
  startDate: string,
  weeks: number,
  today: string,
): number {
  return Math.max(1, Math.min(weeks, planWeekOf(startDate, today)));
}

/** Passen på ett datum, i alla veckor – ett flyttat pass syns där det ligger nu. */
export function sessionsOn(
  schedule: ScheduleWeek[],
  date: string,
): ScheduledSession[] {
  return schedule.flatMap((w) =>
    w.sessions.filter((s) => s.date === date && s.state !== "struken"),
  );
}

/** Veckans pass dag för dag (0–6), och de utan dag för sig. */
export function weekByDay(week: ScheduleWeek): {
  days: { date: string; sessions: ScheduledSession[] }[];
  flexible: ScheduledSession[];
} {
  const days = Array.from({ length: 7 }, (_, d) => ({
    date: addDays(week.startsOn, d),
    sessions: [] as ScheduledSession[],
  }));
  const flexible: ScheduledSession[] = [];
  for (const s of week.sessions) {
    const day = days.find((d) => d.date === s.date);
    if (day) day.sessions.push(s);
    else flexible.push(s);
  }
  return { days, flexible };
}

export type WeekSummary = {
  planned: number;
  done: number;
  partial: number;
  skipped: number;
  open: number;
  /** Planerad tid i sekunder, för passen som har en tid. */
  plannedSeconds: number;
  /** Planerad tid per disciplin. */
  byDiscipline: Record<string, number>;
};

/**
 * Veckan i siffror. `secondsOf` räknar ett pass tid när den inte står i
 * mallen – till exempel ett långpass i kilometer, med löparens tempon.
 */
export function summarizeWeek(
  week: ScheduleWeek,
  secondsOf: (s: ScheduledSession) => number | null = () => null,
): WeekSummary {
  const counts: Record<LogStatus, number> = {
    genomförd: 0,
    delvis: 0,
    hoppad: 0,
  };
  const byDiscipline: Record<string, number> = {};
  let planned = 0;
  let plannedSeconds = 0;
  for (const s of week.sessions) {
    if (s.state === "struken") continue;
    planned += 1;
    if (s.log) counts[s.log.status] += 1;
    const seconds =
      s.state === "ersatt" ? 0 : (s.variant.durationS ?? secondsOf(s) ?? 0);
    plannedSeconds += seconds;
    byDiscipline[s.session.discipline] =
      (byDiscipline[s.session.discipline] ?? 0) + seconds;
  }
  return {
    planned,
    done: counts.genomförd,
    partial: counts.delvis,
    skipped: counts.hoppad,
    open: planned - counts.genomförd - counts.delvis - counts.hoppad,
    plannedSeconds,
    byDiscipline,
  };
}
