"use client";

import { useState } from "react";
import { X } from "lucide-react";

import type { ZonePace } from "@/lib/running-planner/zones";

/**
 * Zonerna i tempo, fäst längst ner medan planen läses. Kan stängas.
 */
export function ZoneBar({
  zones,
  caption,
}: {
  zones: ZonePace[];
  caption?: string;
}) {
  const [open, setOpen] = useState(true);
  if (!open || zones.length === 0) return null;
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line bg-surface/95 backdrop-blur sm:mx-0 sm:rounded-t-lg sm:border-x print:static">
      <div className="flex items-stretch">
        <dl
          aria-label={caption ?? "Zoner"}
          className="grid min-w-0 flex-1 auto-cols-[minmax(4.5rem,1fr)] grid-flow-col overflow-x-auto"
        >
          {zones.map((z) => (
            <div
              key={z.key}
              title={z.name}
              className="border-r border-line px-2 py-2 text-center last:border-r-0"
            >
              <dt className="text-[0.6875rem] font-semibold tracking-[0.08em] text-text-subtle">
                {z.key}
              </dt>
              <dd className="font-mono text-[0.75rem] whitespace-nowrap tabular-nums text-text">
                {z.pace}
              </dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Stäng zonerna"
          className="grid w-10 shrink-0 place-items-center border-l border-line text-text-subtle hover:text-text print:hidden"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}
