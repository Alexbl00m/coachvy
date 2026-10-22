import Link from "next/link";
import { ChevronLeft, FlaskConical, Plus } from "lucide-react";

import { OwnPageTitle } from "@/components/adepts/own-page-title";
import { WorkspaceTabs } from "@/components/adepts/workspace-tabs";
import { ButtonLink } from "@/components/ui/button";
import { getHealthConsent } from "@/lib/adepts/queries";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { countUnread } from "@/lib/messages/queries";
import { adeptHref, routes } from "@/lib/routes";

/**
 * Adeptens arbetsyta: namnet, de vanligaste handlingarna och flikarna. Allt
 * som gäller en adept bor här – läget, planen, träningen, testerna, måendet,
 * meddelandena och profilen – så att coachen hittar det på ett ställe.
 */
export default async function AdeptWorkspaceLayout({
  params,
  children,
}: LayoutProps<"/app/adepter/[id]">) {
  const { user, adept, isCoach, canEdit, asAdept } =
    await loadWorkspace(params);

  // Adepten själv ser sina sidor som en del av sin egen app.
  if (asAdept) {
    return (
      <>
        <OwnPageTitle />
        {children}
      </>
    );
  }

  const [unread, consent] = await Promise.all([
    countUnread(adept.id, user.id),
    // Samtycket gäller bara ett kopplat konto; utan konto ansvarar coachen.
    isCoach && adept.profile_id
      ? getHealthConsent(adept.profile_id)
      : Promise.resolve(undefined),
  ]);

  const tabs = [
    { href: adeptHref(adept.id), label: "Läge", exact: true },
    { href: adeptHref(adept.id, "plan"), label: "Plan" },
    { href: adeptHref(adept.id, "traning"), label: "Träning" },
    { href: adeptHref(adept.id, "tester"), label: "Tester" },
    { href: adeptHref(adept.id, "maende"), label: "Mående" },
    {
      href: adeptHref(adept.id, "meddelanden"),
      label: "Meddelanden",
      count: unread,
    },
    { href: adeptHref(adept.id, "profil"), label: "Profil" },
  ];

  const meta = [adept.sport, adept.current_level].filter(Boolean).join(" · ");

  return (
    <>
      {isCoach && (
        <Link
          href={routes.adepts}
          className="mb-3 inline-flex items-center gap-1 text-[0.8125rem] text-text-muted hover:text-text"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Adepter
        </Link>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div className="min-w-0">
          <p className="eyebrow mb-3 text-text-subtle">
            {meta ? `Adept · ${meta}` : "Adept"}
          </p>
          <h1 className="headline text-[clamp(2.25rem,1.6rem+2vw,3.5rem)] text-text">
            {adept.full_name}
          </h1>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink
              href={`${routes.adepts}/${adept.id}/test/nytt`}
              variant="secondary"
              size="sm"
            >
              <FlaskConical aria-hidden className="size-4" />
              Nytt test
            </ButtonLink>
            <ButtonLink
              href={`${routes.workoutBuilder}?adept=${adept.id}`}
              size="sm"
              className="font-semibold"
            >
              <Plus aria-hidden className="size-4" />
              Bygg pass
            </ButtonLink>
          </div>
        )}
      </div>

      {isCoach && (consent === null || !adept.profile_id) && (
        <p className="mb-5 rounded-md border border-line-strong bg-surface-2 px-4 py-3 text-sm text-text-muted">
          {adept.full_name.split(" ")[0]}{" "}
          {adept.profile_id
            ? "har inte samtyckt till att hälsouppgifter behandlas i appen."
            : "har inget konto i appen än, och har därför inte samtyckt till att hälsouppgifter behandlas."}{" "}
          AI-funktionerna används inte för hen så länge.{" "}
          <Link
            href={adeptHref(adept.id, "profil")}
            className="font-medium text-text underline decoration-line-strong underline-offset-2 hover:decoration-text"
          >
            {adept.profile_id ? "Skicka en påminnelse" : "Bjud in till appen"}
          </Link>
        </p>
      )}

      <WorkspaceTabs tabs={tabs} label="Adeptens arbetsyta" />

      {children}
    </>
  );
}
