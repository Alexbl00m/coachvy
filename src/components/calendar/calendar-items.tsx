import { Bike, Dumbbell, FlaskConical, Footprints, Waves } from "lucide-react";

import type { Sport } from "@/lib/calculators/lactate";
import { SERIES } from "@/lib/calculators/chart-colors";
import type { ActivityInRange } from "@/lib/activities/queries";
import type { CalendarTest, CalendarWorkout } from "@/lib/calendar/queries";
import type { RaceWithAdept } from "@/lib/season/queries";
import type { AdeptCheckinRow, TrainingBlockRow } from "@/lib/types/database";

/** Allt som hör till en dag. */
export type DayItems = {
  workouts: CalendarWorkout[];
  tests: CalendarTest[];
  races: RaceWithAdept[];
  /** Genomförda pass och lopp, uppladdade ur klockan. */
  activities: ActivityInRange[];
  checkin: AdeptCheckinRow | null;
};

export const emptyDay = (): DayItems => ({
  workouts: [],
  tests: [],
  races: [],
  activities: [],
  checkin: null,
});

/** Dagarna i intervallet med sitt innehåll, nyckel ISO-datum. */
export function groupByDay({
  workouts,
  tests,
  races,
  activities = [],
  checkins,
}: {
  workouts: CalendarWorkout[];
  tests: CalendarTest[];
  races: RaceWithAdept[];
  activities?: ActivityInRange[];
  checkins: AdeptCheckinRow[];
}): Map<string, DayItems> {
  const days = new Map<string, DayItems>();
  const day = (date: string) => {
    let entry = days.get(date);
    if (!entry) {
      entry = emptyDay();
      days.set(date, entry);
    }
    return entry;
  };
  for (const w of workouts) day(w.date).workouts.push(w);
  for (const t of tests) day(t.date).tests.push(t);
  for (const r of races) day(r.race_date).races.push(r);
  for (const a of activities) day(a.performed_on).activities.push(a);
  for (const c of checkins) day(c.performed_on).checkin = c;
  return days;
}

/** Fasen varje dag i intervallet ligger i, för en enskild adept. */
export function phaseByDay(
  blocks: Pick<TrainingBlockRow, "phase" | "starts_on" | "ends_on">[],
  dates: string[],
): Map<string, TrainingBlockRow["phase"]> {
  const map = new Map<string, TrainingBlockRow["phase"]>();
  for (const date of dates) {
    // Senast påbörjade vinner vid överlapp, som i blockOn.
    let found: (typeof blocks)[number] | null = null;
    for (const b of blocks) {
      if (b.starts_on <= date && date <= b.ends_on) {
        if (!found || b.starts_on > found.starts_on) found = b;
      }
    }
    if (found) map.set(date, found.phase);
  }
  return map;
}

export function SportIcon({
  sport,
  className,
}: {
  sport: Sport | "annat";
  className?: string;
}) {
  const Icon =
    sport === "löpning"
      ? Footprints
      : sport === "simning"
        ? Waves
        : sport === "annat"
          ? Dumbbell
          : Bike;
  return <Icon aria-hidden className={className} />;
}

export function TestIcon({ className }: { className?: string }) {
  return (
    <FlaskConical
      aria-hidden
      className={className}
      style={{ color: SERIES.secondary }}
    />
  );
}

/** Förnamnet, för rader där flera adepter delar vy. */
export const firstName = (name: string) => name.split(" ")[0] ?? name;
