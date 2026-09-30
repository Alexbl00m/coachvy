import { PageHeader } from "@/components/page-header";
import { CoachInvitations } from "@/components/adepts/coach-invitations";
import { AdeptOverview } from "@/components/overview/adept-overview";
import { CoachOverview } from "@/components/overview/coach-overview";
import { EmptyState } from "@/components/ui/card";
import { listCoachInvitations } from "@/lib/adepts/invitations";
import { getMyAdeptRow } from "@/lib/adepts/queries";
import { getSessionUser } from "@/lib/auth/session";
import { todayIso } from "@/lib/season/season";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Min översikt" };

export default async function OversiktPage() {
  const user = await getSessionUser();
  const isCoach = user?.profile?.role === "coach";
  const today = todayIso();
  const invitations =
    user?.profile?.role === "adept" && !user.adept?.coach_id
      ? await listCoachInvitations()
      : [];
  const adept =
    user && user.profile?.role === "adept"
      ? (user.adept ?? (await getMyAdeptRow(user.id)))
      : null;

  const firstName = user?.profile?.full_name?.split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Hej ${firstName}` : "Min översikt"}
        description={
          isCoach
            ? "Läget hos dina adepter: vem som är värd en titt, vad som ligger framför och vad som hänt."
            : "Var du är i säsongen, dagens incheckning och passen som ligger framför."
        }
      />

      <CoachInvitations invitations={invitations} />

      {!isSupabaseConfigured() && (
        <div className="mb-6 rounded-lg border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-ink-100">
          Supabase är inte konfigurerat. Kopiera{" "}
          <code className="rounded bg-ink-800 px-1.5 py-0.5 text-[12px]">
            .env.example
          </code>{" "}
          till{" "}
          <code className="rounded bg-ink-800 px-1.5 py-0.5 text-[12px]">
            .env.local
          </code>{" "}
          och fyll i projektets URL och anon-nyckel för att aktivera inloggning.
        </div>
      )}

      {user && isCoach ? (
        <CoachOverview coachId={user.id} today={today} />
      ) : user && adept ? (
        <AdeptOverview
          userId={user.id}
          adept={adept}
          today={today}
          consentGiven={Boolean(user.profile?.health_consent_at)}
        />
      ) : (
        <EmptyState
          title="Översikten är tom så länge"
          description="När ditt konto är kopplat till en adeptprofil samlas säsongen, passen och testerna här."
        />
      )}
    </>
  );
}
