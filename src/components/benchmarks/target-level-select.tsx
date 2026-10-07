"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Select } from "@/components/ui/field";
import { setTargetLevel } from "@/lib/benchmarks/actions";

/** Målnivån för en adept. Sparas direkt när den byts. */
export function TargetLevelSelect({
  adeptId,
  groups,
  value,
}: {
  adeptId: string;
  groups: { id: string; name: string }[];
  value: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="malniva" className="text-[13px] text-text-muted">
        Målnivå
      </label>
      <Select
        id="malniva"
        className="h-8 w-auto py-1 text-[13px]"
        value={value ?? ""}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value || null;
          setError(null);
          start(async () => {
            const result = await setTargetLevel(adeptId, next);
            if (!result.ok) setError(result.error);
            router.refresh();
          });
        }}
      >
        <option value="">Ingen vald</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </Select>
      {error && <span className="text-[13px] text-text">{error}</span>}
    </div>
  );
}
