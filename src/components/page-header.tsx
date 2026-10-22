import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Sidans huvud: sammanhanget i versaler, rubriken i serif och en rad som
 * förklarar. Rubriken säger det viktigaste på sidan när det går – "Tröskeln
 * har flyttat sig 30 watt." – och annars sidans namn.
 *
 * `size="lg"` är för sidor som läses som en nyhet: Idag, Översikt,
 * Utveckling, säsongen.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  size = "md",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 pb-8 sm:pb-10">
      <div className="min-w-0 max-w-4xl">
        {eyebrow && (
          <p className="eyebrow mb-3 text-text-subtle sm:mb-4">{eyebrow}</p>
        )}
        <h1
          className={cn(
            "headline text-text",
            size === "lg"
              ? "text-[clamp(2.75rem,1.6rem+3.6vw,4.5rem)]"
              : "text-[clamp(2.25rem,1.6rem+2vw,3.5rem)]",
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-muted sm:text-[17px]">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {action}
        </div>
      )}
    </div>
  );
}
