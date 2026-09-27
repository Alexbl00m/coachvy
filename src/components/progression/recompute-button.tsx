"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { recomputeAdeptSessions } from "@/lib/tests/session-actions";

/** Räknar om adeptens alla tester med dagens metoder. Rådatan rörs inte. */
export function RecomputeButton({ adeptId }: { adeptId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const result = await recomputeAdeptSessions(adeptId);
            setMessage(
              result.ok
                ? result.updated === 0
                  ? "Inget att räkna om."
                  : `${result.updated} ${result.updated === 1 ? "test" : "tester"} omräknade.`
                : result.error,
            );
          })
        }
      >
        <RefreshCw
          aria-hidden
          className={pending ? "size-4 animate-spin" : "size-4"}
        />
        {pending ? "Räknar om…" : "Räkna om med dagens metoder"}
      </Button>
      {message && (
        <span role="status" className="text-[13px] text-text-muted">
          {message}
        </span>
      )}
    </div>
  );
}
