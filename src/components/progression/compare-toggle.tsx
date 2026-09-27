"use client";

import { useState } from "react";
import { GitCompareArrows } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LactateCurve } from "@/lib/tests/progression";
import { LactateCompare } from "./lactate-compare";

/**
 * Jämförelsen under testtillfällena. Stängd från början – listan är det man
 * oftast kommer för – och öppnas med en knapp när det finns något att jämföra.
 */
export function CompareToggle({ curves }: { curves: LactateCurve[] }) {
  const [open, setOpen] = useState(false);
  if (curves.length < 2) return null;

  return (
    <div className="space-y-4">
      <Button
        variant={open ? "secondary" : "ghost"}
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <GitCompareArrows aria-hidden className="size-4" />
        {open
          ? "Dölj jämförelsen"
          : `Jämför laktatkurvor (${curves.length} tester)`}
      </Button>
      {open && <LactateCompare curves={curves} />}
    </div>
  );
}
