import { ActivityImport } from "@/components/activities/activity-import";
import { ActivityList } from "@/components/activities/activity-list";
import { ActivityUpload } from "@/components/activities/activity-upload";
import { DevelopmentCard } from "@/components/activities/development-card";
import { TrainingProfile } from "@/components/activities/training-profile";
import { PowerBenchmark } from "@/components/benchmarks/power-benchmark";
import { analyseTraining } from "@/lib/activities/development";
import { listActivities } from "@/lib/activities/queries";
import { candidatesFrom, pickReference } from "@/lib/activities/reference";
import { getAdeptProfile } from "@/lib/adepts/profile";
import { adeptValues } from "@/lib/benchmarks/values";
import { listRaces } from "@/lib/season/queries";
import { todayIso } from "@/lib/season/season";
import { protocolByKey } from "@/lib/tests/protocols";
import { listSessions } from "@/lib/tests/session-queries";

const heading = "mb-3 text-[13px] font-medium text-text-muted";

/**
 * En adepts lopp och aktiviteter: utvecklingen i text, uppladdning,
 * tävlingarna, profilen ur träningen, listan och historikimporten. Samma
 * innehåll under adeptens flik och under Lopp och aktiviteter i menyn.
 */
export async function AdeptActivities({
  adept,
  canUpload,
  consentGiven,
  showAll,
  moreHref,
}: {
  adept: { id: string; full_name: string };
  canUpload: boolean;
  /** Adepten har godkänt behandlingen av hälsouppgifter (eller är du). */
  consentGiven: boolean;
  showAll: boolean;
  /** Adressen som visar hela listan. */
  moreHref: string;
}) {
  const [activities, races, sessions, profile] = await Promise.all([
    listActivities(adept.id),
    listRaces(adept.id),
    listSessions(adept.id),
    getAdeptProfile(adept.id),
  ]);
  const today = todayIso();
  const candidates = candidatesFrom(
    sessions,
    (key) => protocolByKey(key)?.label ?? key,
  );
  const development = analyseTraining(activities, today, {
    cp: pickReference(candidates, today, "cykling").cp,
    cs: pickReference(candidates, today, "löpning").cs,
  });
  const raceNames = Object.fromEntries(races.map((r) => [r.id, r.name]));
  // Vikt, kön och FTP för effektprofilen mot Coggans tabell.
  const body = adeptValues(sessions, {
    profileSex: profile?.sex ?? null,
    protocolLabel: (key) => protocolByKey(key)?.label ?? key,
  });
  const sources = activities.map((a) => ({
    id: a.id,
    name: a.name,
    sport: a.sport,
    performed_on: a.performed_on,
    curve: a.curve,
    best: a.sport === "löpning" ? a.best : null,
  }));
  const competitions = activities.filter((a) => a.is_race || a.race_id);
  const planned = competitions.filter((a) => a.race_id).length;
  const unplanned = competitions.length - planned;

  return (
    <div className="space-y-6">
      <DevelopmentCard reading={development} />

      {canUpload && (
        <ActivityUpload
          adeptId={adept.id}
          candidates={candidates}
          races={races.map((r) => ({
            id: r.id,
            name: r.name,
            race_date: r.race_date,
          }))}
        />
      )}

      {competitions.length > 0 && (
        <section>
          <h2 className={heading}>
            Tävlingar · {planned} {planned === 1 ? "planerad" : "planerade"},{" "}
            {unplanned} {unplanned === 1 ? "oplanerad" : "oplanerade"}
          </h2>
          <ActivityList
            adeptId={adept.id}
            activities={competitions}
            raceNames={raceNames}
          />
        </section>
      )}

      <TrainingProfile
        adeptId={adept.id}
        sources={sources}
        candidates={candidates}
        today={today}
      />

      <PowerBenchmark
        sources={sources}
        weightKg={body.weightKg}
        weightDate={body.weightDate}
        sex={body.sex}
        testFtp={body.ftp}
        today={today}
      />

      <section>
        {activities.length > 0 && (
          <h2 className={heading}>Alla aktiviteter · {activities.length}</h2>
        )}
        <ActivityList
          adeptId={adept.id}
          activities={showAll ? activities : activities.slice(0, 20)}
          total={activities.length}
          moreHref={moreHref}
          raceNames={raceNames}
        />
      </section>

      {canUpload && (
        <ActivityImport
          adeptId={adept.id}
          adeptName={adept.full_name}
          candidates={candidates}
          existingStarts={activities.map((a) => a.started_at)}
          allowed={consentGiven}
        />
      )}
    </div>
  );
}
