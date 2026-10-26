import { MemberList } from "@/components/admin/member-list";
import { ReviewQueue } from "@/components/admin/review-queue";
import { SeedPlans } from "@/components/admin/seed-plans";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { seedStatus } from "@/lib/plan-library/seeds/import-actions";
import { listReviewQueue } from "@/lib/sharing/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();

  const supabase = await createClient();
  const [{ data, error }, review, seeds] = await Promise.all([
    supabase.rpc("admin_member_overview"),
    listReviewQueue(),
    seedStatus(),
  ]);
  if (error) throw new Error(`Kunde inte hämta kontona: ${error.message}`);

  const members = data ?? [];
  const coaches = members.filter((m) => m.role === "coach").length;
  const paying = members.filter((m) => m.plan === "medlem").length;

  return (
    <>
      <PageHeader
        title="Admin"
        description={`${members.length} konton · ${coaches} coacher och ${members.length - coaches} adepter · ${paying} med medlemskap.`}
      />
      <ReviewQueue items={review} />
      <SeedPlans plans={seeds} />
      <MemberList members={members} />
    </>
  );
}
