import { CoachList } from "@/components/admin/coach-list";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_coach_overview");
  if (error) throw new Error(`Kunde inte hämta coacherna: ${error.message}`);

  const coaches = data ?? [];
  const members = coaches.filter((c) => c.plan === "medlem").length;

  return (
    <>
      <PageHeader
        title="Admin"
        description={`${coaches.length} ${coaches.length === 1 ? "coach" : "coacher"} · ${members} med medlemskap. Medlemskapet låser upp den metabola profilen, VLamax-kalkylen och VLamax ur stegtestet.`}
      />
      <CoachList coaches={coaches} />
    </>
  );
}
