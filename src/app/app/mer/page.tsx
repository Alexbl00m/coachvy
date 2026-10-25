import { redirect } from "next/navigation";
import {
  ChartBarBig,
  Dumbbell,
  Library,
  LibraryBig,
  LogOut,
  MessageSquare,
  MessagesSquare,
  Settings,
  ShieldCheck,
} from "lucide-react";

import { ActionList, type ActionItem } from "@/components/action-list";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { isMember } from "@/lib/auth/membership";
import { requireSessionUser } from "@/lib/auth/session";
import { countUnread } from "@/lib/messages/queries";
import { adeptHref, routes } from "@/lib/routes";

export const metadata = { title: "Mer" };

/** Allt adepten inte gör varje dag: meddelanden, community, verktyg, konto. */
export default async function MorePage() {
  const user = await requireSessionUser();
  if (user.profile?.role !== "adept") redirect(routes.dashboard);
  const adept = user.adept;
  const unread = adept ? await countUnread(adept.id, user.id) : 0;
  const member = isMember(user);

  const contact: ActionItem[] = [
    ...(adept
      ? [
          {
            href: adeptHref(adept.id, "meddelanden"),
            icon: MessageSquare,
            title: "Meddelanden",
            description: "Tråden med din coach.",
            status: unread > 0 ? `${unread} olästa` : undefined,
            pending: unread > 0,
          },
        ]
      : []),
    {
      href: routes.community,
      icon: MessagesSquare,
      title: "Community",
      description: "Frågor och erfarenheter med andra som tränar.",
    },
  ];
  const tools: ActionItem[] = [
    {
      href: routes.workoutBuilder,
      icon: Dumbbell,
      title: "Passbyggare",
      description: member
        ? "Bygg egna pass ur dina zoner."
        : "Bygg egna pass ur dina zoner. Ingår i medlemskapet.",
    },
    {
      href: routes.runningPlanner,
      icon: ChartBarBig,
      title: "Löpplanerare",
      description: "Vägen till ett lopp vecka för vecka.",
    },
    {
      href: routes.sessionLibrary,
      icon: LibraryBig,
      title: "Passbibliotek",
      description: "Pass från din coach och från Coachvy, med syfte och utförande.",
    },
    {
      href: routes.planLibrary,
      icon: Library,
      title: "Planbibliotek",
      description: "Hela planer mot ett lopp att starta själv.",
    },
  ];
  const account: ActionItem[] = [
    {
      href: routes.settings,
      icon: Settings,
      title: "Inställningar",
      description: "Konto, samtycke och e-post.",
    },
    {
      href: routes.privacy,
      icon: ShieldCheck,
      title: "Integritetspolicy och villkor",
    },
  ];

  return (
    <>
      <PageHeader title="Mer" />
      <div className="space-y-6">
        <section className="space-y-2">
          <h2 className="px-1 text-[0.8125rem] font-medium text-text-muted">
            Kontakt
          </h2>
          <ActionList items={contact} />
        </section>
        <section className="space-y-2">
          <h2 className="px-1 text-[0.8125rem] font-medium text-text-muted">
            Verktyg
          </h2>
          <ActionList items={tools} />
        </section>
        <section className="space-y-2">
          <h2 className="px-1 text-[0.8125rem] font-medium text-text-muted">
            Konto
          </h2>
          <ActionList items={account} />
        </section>
        <form action={signOut}>
          <Button
            type="submit"
            variant="secondary"
            className="w-full sm:w-auto"
          >
            <LogOut aria-hidden className="size-4" />
            Logga ut
          </Button>
        </form>
      </div>
    </>
  );
}
