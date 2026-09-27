"use client";

import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { setCoachPlan } from "@/lib/admin/actions";

export type CoachRow = {
  id: string;
  full_name: string;
  email: string;
  company_name: string | null;
  plan: "bas" | "medlem";
  created_at: string;
  adept_count: number;
  is_admin: boolean;
};

/** Alla coacher, sökbara, med medlemskapet en knapptryckning bort. */
export function CoachList({ coaches }: { coaches: CoachRow[] }) {
  const [query, setQuery] = useState("");
  const [plans, setPlans] = useState<Record<string, CoachRow["plan"]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const planOf = (c: CoachRow) => plans[c.id] ?? c.plan;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return coaches;
    return coaches.filter((c) =>
      [c.full_name, c.email, c.company_name ?? ""].some((v) => v.toLowerCase().includes(q)),
    );
  }, [coaches, query]);

  const toggle = (coach: CoachRow) => {
    const next = planOf(coach) === "medlem" ? "bas" : "medlem";
    if (next === "bas" && !window.confirm(`Ta bort medlemskapet för ${coach.full_name}?`)) return;

    setError(null);
    setBusy(coach.id);
    startTransition(async () => {
      const result = await setCoachPlan(coach.id, next);
      if (result.ok) setPlans((p) => ({ ...p, [coach.id]: next }));
      else setError(result.error);
      setBusy(null);
    });
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle"
        />
        <Input
          aria-label="Sök coach"
          placeholder="Sök på namn, e-post eller företag"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-line-strong bg-surface-2 p-3 text-sm text-text">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong px-6 py-10 text-center text-sm text-text-muted">
          {coaches.length === 0 ? "Inga coacher har registrerat sig än." : "Ingen coach matchar sökningen."}
        </p>
      ) : (
        <Card className="min-w-0 p-0">
          <ul className="divide-y divide-line">
            {shown.map((coach) => {
              const member = planOf(coach) === "medlem";
              return (
                <li key={coach.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                  <div className="min-w-0 flex-1 basis-60">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
                      {coach.full_name}
                      {coach.is_admin ? (
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-normal text-text">
                          Admin – full tillgång
                        </span>
                      ) : (
                        <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[11px] font-normal",
                          member ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-muted",
                        )}
                      >
                        {member ? "Medlem" : "Bas"}
                      </span>
                      )}
                    </p>
                    <p className="truncate text-[13px] text-text-muted">{coach.email}</p>
                    <p className="text-[12px] text-text-subtle">
                      {[
                        coach.company_name,
                        `registrerad ${formatDate(coach.created_at)}`,
                        `${coach.adept_count} ${coach.adept_count === 1 ? "adept" : "adepter"}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {!coach.is_admin && (
                  <Button
                    type="button"
                    size="sm"
                    variant={member ? "secondary" : "primary"}
                    disabled={busy === coach.id}
                    onClick={() => toggle(coach)}
                  >
                    {busy === coach.id ? "Sparar …" : member ? "Ta bort medlemskap" : "Gör till medlem"}
                  </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
