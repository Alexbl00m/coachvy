import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * En sektion på sajten. Sektionerna skiljs åt med en hårfin linje, inte med
 * olika bakgrunder – samma plan hela vägen, som hos Linear.
 */
export function Section({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-16 border-t border-line px-5 py-20 sm:px-8 sm:py-28",
        className,
      )}
    >
      <div className="mx-auto max-w-[1120px]">{children}</div>
    </section>
  );
}

/**
 * Sektionsrubrik i två toner: påståendet i `text`, fortsättningen i
 * `text-muted` på samma rad. Rubriken säger vad det gäller, fortsättningen
 * varför – utan en extra rad brödtext under.
 */
export function SectionHeading({
  label,
  title,
  continuation,
  description,
  className,
}: {
  /** Kort etikett ovanför, i mono: vad sektionen handlar om. */
  label?: string;
  title: string;
  continuation?: string;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-3xl", className)}>
      {label && (
        <p className="mb-5 font-mono text-[12px] text-text-subtle">{label}</p>
      )}
      <h2 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.028em] text-balance text-text sm:text-[44px]">
        {title}
        {continuation && (
          <span className="text-text-muted"> {continuation}</span>
        )}
      </h2>
      {description && (
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-text-muted sm:text-base">
          {description}
        </p>
      )}
    </div>
  );
}
