"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Result = { ok: true; id?: string } | { ok: false; error: string };

/**
 * Kör en serveråtgärd, visar felet den svarar med och läser om sidan när
 * den lyckas.
 */
export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (
    action: () => Promise<Result>,
    onDone?: (result: { ok: true; id?: string }) => void,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone?.(result);
      router.refresh();
    });
  };

  return { pending, error, setError, run };
}
