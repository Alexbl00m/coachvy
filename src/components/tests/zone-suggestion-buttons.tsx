"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  acceptZoneSuggestion,
  dismissZoneSuggestion,
} from "@/lib/tests/zone-suggestion-actions";
import type { ZoneSport } from "@/lib/tests/zone-suggestion";

/** Godkänn eller avvisa ett zonförslag. Sidan laddas om med det nya läget. */
export function ZoneSuggestionButtons({
  adeptId,
  sport,
  testName,
}: {
  adeptId: string;
  sport: ZoneSport;
  /** "CP-test" eller "CS-test", för knappens beskrivning. */
  testName: string;
}) {
  const [pending, start] = useTransition();
  const [doing, setDoing] = useState<"accept" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (kind: "accept" | "dismiss") => {
    setError(null);
    setDoing(kind);
    start(async () => {
      const result =
        kind === "accept"
          ? await acceptZoneSuggestion(adeptId, sport)
          : await dismissZoneSuggestion(adeptId, sport);
      if (!result.ok) setError(result.error);
      setDoing(null);
    });
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => run("accept")}
          aria-describedby={`zon-${sport}-forklaring`}
        >
          {doing === "accept" ? "Sparar …" : "Uppdatera zonerna"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => run("dismiss")}
        >
          {doing === "dismiss" ? "Sparar …" : "Inte nu"}
        </Button>
      </div>
      <p
        id={`zon-${sport}-forklaring`}
        className="mt-2 text-[13px] text-text-muted"
      >
        Uppdatera sparar insatserna som ett {testName} daterat i dag, med varje
        insats eget datum. Inte nu döljer förslaget tills träningen visar mer.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
