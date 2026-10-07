import { GapCard } from "@/components/benchmarks/gap-card";
import { MetabolicBenchmark } from "@/components/benchmarks/metabolic-benchmark";
import { PowerBenchmark } from "@/components/benchmarks/power-benchmark";
import type { ProfileSource } from "@/lib/activities/profile";
import { listActivities } from "@/lib/activities/queries";
import { getAdeptProfile } from "@/lib/adepts/profile";
import { computeGoals } from "@/lib/benchmarks/goals";
import { referenceLevelsFor } from "@/lib/benchmarks/queries";
import { listRaces } from "@/lib/season/queries";
import { todayIso } from "@/lib/season/season";
import { protocolByKey } from "@/lib/tests/protocols";
import type { FullSession } from "@/lib/tests/session-queries";
import type { Adept } from "@/lib/types/database";

/** Effektprofilens underlag ur aktiviteterna. */
export function profileSources(
  activities: Awaited<ReturnType<typeof listActivities>>,
): ProfileSource[] {
  return activities.map((a) => ({
    id: a.id,
    name: a.name,
    sport: a.sport,
    performed_on: a.performed_on,
    curve: a.curve,
    best: a.sport === "löpning" ? a.best : null,
  }));
}

/**
 * Fliken "Mål och referens": gap-analysen, den metabola profilen mot
 * referensnivåerna och effektprofilen mot Coggans tabell. Hämtar sitt eget
 * underlag, så att det bara görs när fliken är öppen.
 */
export async function ReferenceAndGoals({
  adept,
  sessions,
  canEdit,
}: {
  adept: Adept;
  sessions: FullSession[];
  canEdit: boolean;
}) {
  const [levels, profile, activities, races] = await Promise.all([
    referenceLevelsFor(adept.coach_id),
    getAdeptProfile(adept.id),
    listActivities(adept.id),
    listRaces(adept.id),
  ]);
  const today = todayIso();
  const sources = profileSources(activities);
  const goals = computeGoals({
    targetLevel: adept.target_level,
    sessions,
    profileSex: profile?.sex ?? null,
    sources,
    races,
    levels,
    today,
    protocolLabel: (key) => protocolByKey(key)?.label ?? key,
  });

  return (
    <div className="space-y-6">
      <GapCard
        adeptId={adept.id}
        groups={levels.groups.map((g) => ({ id: g.id, name: g.name }))}
        targetId={goals.target?.id ?? null}
        gaps={goals.gaps}
        reading={goals.reading}
        races={goals.races}
        canEdit={canEdit}
      />
      <MetabolicBenchmark
        adept={goals.values}
        levels={levels}
        sex={goals.sex}
        targetId={goals.target?.id ?? null}
        isCoach={canEdit}
      />
      <PowerBenchmark
        sources={sources}
        weightKg={goals.values.weightKg}
        weightDate={goals.values.weightDate}
        sex={goals.values.sex}
        testFtp={goals.values.ftp}
        today={today}
      />
    </div>
  );
}
