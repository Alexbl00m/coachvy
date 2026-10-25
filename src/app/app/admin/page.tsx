import { MemberList } from "@/components/admin/member-list";
import { ReviewQueue } from "@/components/admin/review-queue";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth/session";
import { listReviewQueue } from "@/lib/sharing/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();

  const supabase = await createClient();
  const [{ data, error }, review] = await Promise.all([
    supabase.rpc("admin_member_overview"),
    listReviewQueue(),
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
      <MemberList members={members} />
    </>
  );
}
