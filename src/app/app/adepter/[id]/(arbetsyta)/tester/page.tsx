import { CompareToggle } from "@/components/progression/compare-toggle";
import { SessionPanel } from "@/components/tests/session-panel";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { lactateCurves } from "@/lib/tests/progression";
import { sportOf } from "@/lib/tests/protocols";
import {
  rollingCriticalPower,
  rollingCriticalSpeed,
} from "@/lib/tests/rolling";
import {
  listFullSessions,
  listMaximalEfforts,
  listSessions,
} from "@/lib/tests/session-queries";

export const metadata = { title: "Tester" };

export default async function AdeptTestsPage({
  params,
}: PageProps<"/app/adepter/[id]/tester">) {
  const { adept, canEdit, selfMember } = await loadWorkspace(params);
  const sport = sportOf(adept.sport);

  const [sessions, efforts, full] = await Promise.all([
    listSessions(adept.id),
    listMaximalEfforts(adept.id, sport),
    listFullSessions(adept.id),
  ]);
  const curves = lactateCurves(full);

  // Senaste hela testet, för att kunna säga om ett nyare bästavärde har
  // flyttat kurvan sedan dess.
  const lastFullTestOn = sessions[0]?.performed_on ?? null;
  const rolling =
    sport === "cykling"
      ? rollingCriticalPower({ efforts, lastFullTestOn })
      : rollingCriticalSpeed({ efforts, lastFullTestOn });
  const speedUnit = sport === "simning" ? "m/s" : "km/h";

  return (
    <div className="space-y-6">
      {curves.length >= 2 && <CompareToggle curves={curves} />}
      <SessionPanel
        adeptId={adept.id}
        sessions={sessions}
        rolling={rolling}
        rollingLabel={sport === "cykling" ? "CP" : "CS"}
        rollingUnit={sport === "cykling" ? "W" : speedUnit}
        sport={sport}
        reserveLabel={sport === "cykling" ? "W′" : "D′"}
        reserveUnit={sport === "cykling" ? "kJ" : "m"}
        // En medlemsadept registrerar egna tester, också ur cykeldatorns filer.
        canEdit={canEdit || selfMember}
      />
    </div>
  );
}
