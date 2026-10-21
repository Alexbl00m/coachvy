import { StrengthHistory } from "@/components/strength/strength-history";
import { StrengthLogForm } from "@/components/strength/strength-log-form";
import { StrengthProgress } from "@/components/strength/strength-progress";
import { Card, CardTitle } from "@/components/ui/card";
import { todayIso } from "@/lib/season/season";
import { listStrengthSessions } from "@/lib/strength/queries";
import { sessionsPerWeek, strengthProgress } from "@/lib/strength/strength";

/**
 * Styrkeloggen: adepten loggar sina styrkepass här i stället för som en
 * kommentar i TrainingPeaks, och både adepten och coachen följer
 * progressionen per övning.
 */
export async function StrengthSection({
  adeptId,
  basePath,
  editingId,
}: {
  adeptId: string;
  /** Sidan loggen ligger på. */
  basePath: string;
  /** Passet som ändras, ur `?andra=`. */
  editingId: string | null;
}) {
  const today = todayIso();
  const sessions = await listStrengthSessions(adeptId);
  const editing = sessions.find((s) => s.id === editingId) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Card className="min-w-0">
        <CardTitle>{editing ? "Ändra passet" : "Logga ett pass"}</CardTitle>
        <StrengthLogForm
          // Ny montering när passet som ändras byts.
          key={editing?.id ?? "nytt"}
          adeptId={adeptId}
          today={today}
          editing={editing}
          previous={sessions[0] ?? null}
          basePath={basePath}
        />
      </Card>

      <Card className="min-w-0">
        <CardTitle>Progression</CardTitle>
        <StrengthProgress
          progress={strengthProgress(sessions, today)}
          perWeek={sessionsPerWeek(sessions, today)}
        />
      </Card>

      <Card className="min-w-0 lg:col-span-2">
        <CardTitle>Loggade pass</CardTitle>
        <StrengthHistory sessions={sessions} basePath={basePath} />
      </Card>
    </div>
  );
}
