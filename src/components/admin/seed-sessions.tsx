"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import {
  importSessionAtlas,
  type AtlasImportResult,
  type AtlasStatus,
} from "@/lib/session-library/atlas/import-actions";

const SPORT: Record<AtlasStatus["sport"], string> = {
  cykling: "Cykel",
  löpning: "Löpning",
  simning: "Simning",
};

/**
 * De färdiga passen i passbiblioteket: cykelatlasen, löppassen och
 * simpassen. Knappen läser in dem som saknas, delade med alla coacher.
 */
export function SeedSessions({ status }: { status: AtlasStatus[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AtlasImportResult | null>(null);
  const missing = status.reduce((n, s) => n + s.total - s.present, 0);

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
                  setResult(await importSessionAtlas());
                  router.refresh();
                })
              }
            >
              {pending ? "Läser in …" : `Läs in ${missing} pass`}
            </Button>
          ) : undefined
        }
      >
        Färdiga pass
      </CardTitle>
      <p className="mb-4 max-w-2xl text-[0.8125rem] text-text-muted">
        Passbibliotekets färdiga pass. De läses in med dig som ägare och delas
        med alla coacher. Ett pass med samma namn som redan finns hoppas över,
        så ett pass du ändrat skrivs inte över.
      </p>
      <ul className="divide-y divide-line rounded-md border border-line">
        {status.map((s) => (
          <li
            key={s.sport}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm"
          >
            <span className="text-text">{SPORT[s.sport]}</span>
            <span className="tabular-nums text-text-muted">
              {s.present} av {s.total} inlästa
            </span>
          </li>
        ))}
      </ul>
      {result && (
        <div role="status" className="mt-3 text-[0.8125rem]">
          <p className={result.ok ? "text-text" : "text-warn"}>
            {result.added} pass inlästa
            {result.failed.length > 0
              ? `, ${result.failed.length} gick inte.`
              : "."}
          </p>
          {result.failed.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-text-muted">
              {result.failed.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
