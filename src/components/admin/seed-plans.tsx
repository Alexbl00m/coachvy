"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import {
  importSeedPlans,
  type ImportResult,
  type SeedStatus,
} from "@/lib/plan-library/seeds/import-actions";

const STATE: Record<SeedStatus["state"], string> = {
  saknas: "Inte inläst",
  utkast: "Utkast",
  publicerad: "Publicerad",
};

/**
 * De färdiga planerna som finns som data i appen. Knappen läser in dem som
 * saknas och publicerar dem, delade med medlemmar och coacher.
 */
export function SeedPlans({ plans }: { plans: SeedStatus[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const missing = plans.filter((p) => p.state !== "publicerad").length;

  return (
    <Card className="mb-6">
      <CardTitle
        action={
          missing > 0 ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setResults(await importSeedPlans());
                  router.refresh();
                })
              }
            >
              {pending ? "Läser in …" : `Läs in och publicera ${missing}`}
            </Button>
          ) : undefined
        }
      >
        Färdiga planer
      </CardTitle>
      <p className="mb-4 max-w-2xl text-[0.8125rem] text-text-muted">
        Planer som finns färdiga i appen. De läses in med dig som ägare och
        delas med medlemmar och coacher. Publiceringen kontrollerar varje plan
        som i mallverktyget.
      </p>
      <ul className="divide-y divide-line rounded-md border border-line">
        {plans.map((p) => {
          const result = results?.find((r) => r.slug === p.slug);
          return (
            <li
              key={p.slug}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm"
            >
              <span className="text-text">{p.title}</span>
              <span
                className={
                  result && !result.ok ? "text-warn" : "text-text-muted"
                }
              >
                {result ? result.message : STATE[p.state]}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
