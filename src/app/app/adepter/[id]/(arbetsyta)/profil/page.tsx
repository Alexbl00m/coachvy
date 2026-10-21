import { AdeptInfoCard } from "@/components/adepts/adept-info-card";
import { AdeptProfileForm } from "@/components/adepts/adept-profile-form";
import { InviteCard } from "@/components/adepts/invite-card";
import { Card, CardTitle } from "@/components/ui/card";
import { getAdeptProfile } from "@/lib/adepts/profile";
import { getHealthConsent } from "@/lib/adepts/queries";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { isEmailConfigured } from "@/lib/email/send";
import { formatLastActive } from "@/lib/format";

export const metadata = { title: "Profil" };

/** Uppgifterna om adepten, kontot och inbjudan – det som sällan ändras. */
export default async function AdeptProfilePage({
  params,
}: PageProps<"/app/adepter/[id]/profil">) {
  const { user, adept, isCoach, canEdit } = await loadWorkspace(params);
  const [profile, consent] = await Promise.all([
    getAdeptProfile(adept.id),
    isCoach && adept.profile_id
      ? getHealthConsent(adept.profile_id)
      : Promise.resolve(undefined),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <AdeptInfoCard adept={adept} canEdit={canEdit} />

        <div className="space-y-6">
          {canEdit && (!adept.profile_id || consent === null) && (
            <InviteCard
              adeptId={adept.id}
              adeptName={adept.full_name}
              email={adept.email}
              coachName={user.profile?.full_name ?? "din coach"}
              mode={adept.profile_id ? "samtycke" : "inbjudan"}
              invitedAt={adept.invited_at ?? null}
              canEmail={isEmailConfigured()}
            />
          )}

          <Card>
            <CardTitle>Aktivitet i appen</CardTitle>
            <p className="text-sm text-text">
              {formatLastActive(adept.last_active_at)}
            </p>
            <p className="mt-1 text-[12px] text-text-subtle">
              Uppdateras när adepten loggar in.
            </p>
          </Card>
        </div>
      </div>

      <AdeptProfileForm adeptId={adept.id} profile={profile} />
    </div>
  );
}
