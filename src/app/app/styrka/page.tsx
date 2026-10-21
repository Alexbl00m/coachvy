import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { StrengthSection } from "@/components/strength/strength-section";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { getMyAdeptRow, listAdepts } from "@/lib/adepts/queries";
import { requireSessionUser } from "@/lib/auth/session";
import { adeptHref, routes } from "@/lib/routes";

export const metadata = { title: "Styrka" };

/**
 * Styrkeloggen för adepten själv. Coachen har den i adeptens arbetsyta under
 * Träning, så gamla länkar hit leder dit.
 */
export default async function StyrkaPage({
  searchParams,
}: PageProps<"/app/styrka">) {
  const user = await requireSessionUser();
  const query = await searchParams;
  const editingId = typeof query.andra === "string" ? query.andra : null;

  if (user.profile?.role === "coach") {
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
    const adept = own.find((a) => a.id === wanted) ?? own[0];
    redirect(
      `${adeptHref(adept.id, "styrka")}${editingId ? `?andra=${editingId}` : ""}`,
    );
  }

  const adept = await getMyAdeptRow(user.id);
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

  return (
    <>
      <PageHeader
        title="Styrka"
        description="Logga styrkepassen här i stället för som en kommentar – så syns progressionen per övning för dig och din coach."
      />
      <StrengthSection
        adeptId={adept.id}
        basePath={routes.strength}
        editingId={editingId}
      />
    </>
  );
}
