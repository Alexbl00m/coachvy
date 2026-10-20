import { Plus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { AdeptPicker } from "@/components/progression/adept-picker";
import { StrengthHistory } from "@/components/strength/strength-history";
import { StrengthLogForm } from "@/components/strength/strength-log-form";
import { StrengthProgress } from "@/components/strength/strength-progress";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { getMyAdeptRow, listAdepts } from "@/lib/adepts/queries";
import { requireSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { todayIso } from "@/lib/season/season";
import { listStrengthSessions } from "@/lib/strength/queries";
import { sessionsPerWeek, strengthProgress } from "@/lib/strength/strength";
import type { Adept } from "@/lib/types/database";

export const metadata = { title: "Styrka" };

/**
 * Styrkeloggen: adepten loggar sina styrkepass här i stället för som en
 * kommentar i TrainingPeaks, och både hon och coachen följer progressionen
 * per övning.
 */
export default async function StyrkaPage({
  searchParams,
}: PageProps<"/app/styrka">) {
  const user = await requireSessionUser();
  const query = await searchParams;
  const today = todayIso();
  const isCoach = user.profile?.role === "coach";

  let adept: Adept | null = null;
  let picker: React.ReactNode = null;
  if (isCoach) {
    const own = (await listAdepts()).filter((a) => a.coach_id === user.id);
    if (own.length === 0) {
      return (
        <>
          <PageHeader title="Styrka" />
          <EmptyState
            title="Inga adepter ännu"
            description="Styrkeloggen förs per adept. Lägg till en adept först."
            action={
              <ButtonLink href={routes.newAdept} className="font-semibold">
                <Plus aria-hidden className="size-4" />
                Lägg till adept
              </ButtonLink>
            }
          />
        </>
      );
    }
    const wanted = typeof query.adept === "string" ? query.adept : null;
    adept = own.find((a) => a.id === wanted) ?? own[0];
    picker =
      own.length > 1 ? (
        <AdeptPicker
          adepts={own.map((a) => ({ id: a.id, name: a.full_name }))}
          current={adept.id}
          basePath={routes.strength}
        />
      ) : null;
  } else {
    adept = await getMyAdeptRow(user.id);
  }

  if (!adept) {
    return (
      <>
        <PageHeader title="Styrka" />
        <EmptyState
          title="Ingen adeptprofil hittades"
          description="Styrkeloggen hör till en adept. Ditt konto är inte kopplat till någon adeptprofil."
        />
      </>
    );
  }

  const sessions = await listStrengthSessions(adept.id);
  const editingId = typeof query.andra === "string" ? query.andra : null;
  const editing = sessions.find((s) => s.id === editingId) ?? null;

  return (
    <>
      <PageHeader
        title="Styrka"
        description={
          isCoach
            ? `${adept.full_name}: styrkepassen och progressionen per övning.`
            : "Logga styrkepassen här i stället för som en kommentar – så syns progressionen per övning för dig och din coach."
        }
        action={picker}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardTitle>{editing ? "Ändra passet" : "Logga ett pass"}</CardTitle>
          <StrengthLogForm
            // Ny montering när passet som ändras byts.
            key={editing?.id ?? "nytt"}
            adeptId={adept.id}
            today={today}
            editing={editing}
            previous={sessions[0] ?? null}
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
          <StrengthHistory sessions={sessions} adeptId={adept.id} />
        </Card>
      </div>
    </>
  );
}
