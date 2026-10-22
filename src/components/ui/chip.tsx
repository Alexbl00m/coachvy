import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { IntensityZone } from "@/lib/workouts/intensity";

/**
 * Bricka: en pill med kant. Med `zone` får den zonens färg i kanten, en prick
 * och texten – passets huvudzon, som "Z4 Tröskel".
 */
export function Chip({
  children,
  zone,
  className,
}: {
  children: ReactNode;
  zone?: IntensityZone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-2 rounded-full border px-3 text-[13px]",
        zone ? "" : "border-line-strong text-text-muted",
        className,
      )}
      style={
        zone
          ? {
              borderColor: `color-mix(in srgb, var(--zone-${zone}) 45%, transparent)`,
              backgroundColor: `color-mix(in srgb, var(--zone-${zone}) 8%, transparent)`,
              color: `var(--zone-${zone}-text)`,
            }
          : undefined
      }
    >
      {zone && (
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ backgroundColor: `var(--zone-${zone})` }}
        />
      )}
      {children}
    </span>
  );
}
