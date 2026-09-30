"use client";

import { useRouter } from "next/navigation";

import { routes } from "@/lib/routes";

/** Byter adept. Valet ligger i adressen, så sidan går att länka. */
export function AdeptPicker({
  adepts,
  current,
  basePath = routes.progression,
}: {
  /** `tests` visas inom parentes när det finns några. */
  adepts: { id: string; name: string; tests?: number }[];
  current: string;
  basePath?: string;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-3 text-sm text-text-muted">
      Adept
      <select
        value={current}
        onChange={(e) => router.push(`${basePath}?adept=${e.target.value}`)}
        className="h-9 min-w-[200px] rounded-md border border-line-strong bg-surface-2 px-3 text-sm text-text focus:border-accent focus:outline-none"
      >
        {adepts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} {a.tests ? `(${a.tests})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
