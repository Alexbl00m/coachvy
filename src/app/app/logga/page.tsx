import { redirect } from "next/navigation";
import { Activity, BicepsFlexed, FlaskConical, HeartPulse } from "lucide-react";

import { ActionList, type ActionItem } from "@/components/action-list";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/card";
import { isMember } from "@/lib/auth/membership";
import { requireSessionUser } from "@/lib/auth/session";
import { adeptHref, routes } from "@/lib/routes";
import { longDate, todayIso } from "@/lib/season/season";
import { listStrengthSessions } from "@/lib/strength/queries";
import { getCheckin } from "@/lib/training/queries";

export const metadata = { title: "Logga" };

/**
 * Det adepten för in själv, på ett ställe: incheckningen, styrkepasset, ett
 * lopp eller pass ur klockan och – som medlem – ett test.
 */
export default async function LogPage() {
  const user = await requireSessionUser();
  if (user.profile?.role !== "adept") redirect(routes.dashboard);
  const adept = user.adept;
  if (!adept) {
    return (
      <>
        <PageHeader title="Logga" />
        <EmptyState
          title="Ingen adeptprofil hittades"
          description="Ditt konto är inte kopplat till någon coach ännu. Be din coach lägga upp dig."
        />
      </>
    );
  }

  const today = todayIso();
  const [checkin, strength] = await Promise.all([
    getCheckin(adept.id, today),
    listStrengthSessions(adept.id),
  ]);
  const lastStrength = strength[0] ?? null;

  const items: ActionItem[] = [
    {
      href: adeptHref(adept.id, "maende"),
      icon: HeartPulse,
      title: "Incheckning",
      description: "Hur passet kändes och hur du har sovit.",
      status: checkin ? "Klar i dag" : "Inte gjord i dag",
      pending: !checkin,
    },
    {
      href: routes.strength,
      icon: BicepsFlexed,
      title: "Styrkepass",
      description: "Övningar, set och vikt – progressionen räknas ut åt dig.",
      status: lastStrength
        ? `Senast ${longDate(lastStrength.performed_on, today)}`
        : undefined,
    },
    {
      href: routes.activities,
      icon: Activity,
      title: "Lopp eller pass ur klockan",
      description:
        "Ladda upp en .fit-fil från Garmin, Wahoo, Coros eller Zwift.",
    },
    ...(isMember(user)
      ? [
          {
            href: `${routes.adepts}/${adept.id}/test/nytt`,
            icon: FlaskConical,
            title: "Test",
            description:
              "Ett laktat-, CP- eller fälttest med datumet det gjordes.",
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Logga"
        description="Det du för in syns direkt för din coach."
      />
      <ActionList items={items} label="Logga" />
    </>
  );
}
