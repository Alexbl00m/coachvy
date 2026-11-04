import { PillLinks } from "@/components/plan-library/pill-links";
import { StrengthHistory } from "@/components/strength/strength-history";
import { StrengthLogForm } from "@/components/strength/strength-log-form";
import { StrengthProgress } from "@/components/strength/strength-progress";
import { Card, CardTitle } from "@/components/ui/card";
import { todayIso } from "@/lib/season/season";
import {
  listPlannedStrength,
  listStrengthSessions,
} from "@/lib/strength/queries";
import { sessionsPerWeek, strengthProgress } from "@/lib/strength/strength";

/**
 * Styrkan: coachen planerar passen på dagar, adepten loggar dem när de är
 * gjorda, och båda följer progressionen per övning. Ett planerat pass syns i
 * kalendern och under Idag tills det är loggat.
 */
export async function StrengthSection({
  adeptId,
  basePath,
  editingId,
  loggingId = null,
  planDate = null,
}: {
  adeptId: string;
  /** Sidan loggen ligger på. */
  basePath: string;
  /** Passet som ändras, ur `?andra=`. */
  editingId: string | null;
  /** Det planerade pass som loggas, ur `?logga=`. */
  loggingId?: string | null;
  /** Planera ett nytt pass på dagen, ur `?planera=` ("1" för i dag). */
  planDate?: string | null;
}) {
  const today = todayIso();
  const [sessions, planned] = await Promise.all([
    listStrengthSessions(adeptId),
    listPlannedStrength(adeptId),
  ]);
  const editing =
    [...sessions, ...planned].find((s) => s.id === editingId) ?? null;
  const logging = editing
    ? null
    : (planned.find((s) => s.id === loggingId) ?? null);
  const planning =
    editing?.status === "planerad" ||
    (!editing && !logging && planDate !== null);
  const defaultDate =
    planDate && /^\d{4}-\d{2}-\d{2}$/.test(planDate) ? planDate : null;

  const title = editing
    ? planning
      ? "Ändra det planerade passet"
      : "Ändra passet"
    : logging
      ? "Logga det planerade passet"
      : planning
        ? "Planera ett pass"
        : "Logga ett pass";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Card className="min-w-0">
        <CardTitle>{title}</CardTitle>
        {!editing && !logging && (
          <div className="mb-4">
            <PillLinks
              label="Logga eller planera"
              active={planning ? "planera" : "logga"}
              items={[
                { key: "logga", label: "Logga ett gjort pass", href: basePath },
                {
                  key: "planera",
                  label: "Planera ett pass",
                  href: `${basePath}?planera=1`,
                },
              ]}
            />
          </div>
        )}
        <StrengthLogForm
          // Ny montering när passet eller läget byts.
          key={`${editing?.id ?? logging?.id ?? "nytt"}-${planning ? "planera" : "logga"}-${defaultDate ?? ""}`}
          adeptId={adeptId}
          today={today}
          editing={editing}
          logging={logging}
          mode={planning ? "planera" : "logga"}
          defaultDate={defaultDate}
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
        <CardTitle>Planerade pass</CardTitle>
        <StrengthHistory
          sessions={planned}
          basePath={basePath}
          planned
          today={today}
        />
      </Card>

      <Card className="min-w-0 lg:col-span-2">
        <CardTitle>Loggade pass</CardTitle>
        <StrengthHistory sessions={sessions} basePath={basePath} />
      </Card>
    </div>
  );
}
