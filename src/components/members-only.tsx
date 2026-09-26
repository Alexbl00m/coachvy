import Link from "next/link";
import { Lock } from "lucide-react";

import { buttonClass } from "@/components/ui/button";
import { routes } from "@/lib/routes";

/**
 * Det en coach utan medlemskap ser i stället för en medlemsfunktion.
 *
 * Sidan renderas på servern, så kalkylen och dess data skickas aldrig till
 * webbläsaren – det här kortet är allt som följer med.
 */
export function MembersOnly({ feature }: { feature: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface-2/60 px-6 py-12 text-center">
      <Lock aria-hidden className="mx-auto size-6 text-accent" />
      <p className="mt-4 text-sm font-medium text-text">{feature} ingår i medlemskapet</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-text-muted">
        Den metabola profilen – VLamax, VO2max, tröskel och FatMax ur ett
        sprint- och maxtest – är en del av medlemskapet i Coachvy.
      </p>
      <div className="mt-5 flex justify-center">
        <Link href={routes.contact} className={buttonClass({ size: "sm" })}>
          Fråga om medlemskap
        </Link>
      </div>
    </div>
  );
}
