/**
 * Veckans belastning: det planerade och det genomförda, med de vedertagna
 * måtten – pass, tid, TSS, arbete i kJ och sträcka per gren – och planens
 * pass efter huvudsyfte (lugnt, medel, högt) som filosofins avsnitt 19
 * räknar intensitetsfördelningen.
 *
 * Det planerade är adeptens egna pass, planpassen och de planerade
 * styrkepassen. Det genomförda är aktiviteterna ur filerna, med TSS ur
 * effekten eller rTSS, sTSS och hrTSS ur fart och puls (activities/tss.ts).
 *
 * Modulen är ren, utan anrop.
 */

import type { DoneLoad } from "@/lib/activities/tss-queries";
import { distribution, type Distribution } from "@/lib/season/distribution";
import { addDays } from "@/lib/season/season";
import { addLoad, emptyTotals, type LoadTotals } from "@/lib/workouts/load";

import type { CalendarWorkout } from "./queries";

export type WeekLoad = {
  /** Veckans måndag. */
  monday: string;
  planned: LoadTotals;
  done: LoadTotals;
  /** Planens pass efter huvudsyfte. */
  goals: Distribution;
};

type Done = Pick<
  DoneLoad,
  | "adept_id"
  | "performed_on"
  | "sport"
  | "moving_s"
  | "duration_s"
  | "distance_m"
  | "work_kj"
  | "load"
>;

/** Veckans summor för en adept. */
export function weekLoad(
  monday: string,
  workouts: CalendarWorkout[],
  activities: Done[],
  adeptId: string,
): WeekLoad {
  const sunday = addDays(monday, 6);
  const inWeek = (date: string) => date >= monday && date <= sunday;

  const planned = workouts.filter(
    (w) => w.adeptId === adeptId && inWeek(w.date),
  );
  const done = activities.filter(
    (a) => a.adept_id === adeptId && inWeek(a.performed_on),
  );

  return {
    monday,
    planned: planned.reduce(
      (t, w) =>
        addLoad(t, {
          sport: w.sport,
          seconds: w.load?.seconds ?? w.seconds ?? null,
          tss: w.load?.tss ?? null,
          kj: w.load?.kj ?? null,
          metres: w.load?.metres ?? null,
        }),
      emptyTotals(),
    ),
    done: done.reduce(
      (t, a) =>
        addLoad(t, {
          sport: a.sport,
          seconds: a.moving_s ?? a.duration_s,
          tss: a.load?.tss ?? null,
          kj: a.work_kj,
          metres: a.distance_m,
        }),
      emptyTotals(),
    ),
    goals: distribution(planned.map((w) => w.goal ?? null)),
  };
}

/** Summorna för flera veckor, nyckel måndagen. */
export function weekLoads(
  mondays: string[],
  workouts: CalendarWorkout[],
  activities: Done[],
  adeptId: string,
): Map<string, WeekLoad> {
  return new Map(
    mondays.map((m) => [m, weekLoad(m, workouts, activities, adeptId)]),
  );
}
