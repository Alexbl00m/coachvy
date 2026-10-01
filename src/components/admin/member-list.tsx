"use client";

import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { setMemberPlan } from "@/lib/admin/actions";
import type { AdminMember } from "@/lib/types/database";

type Filter = "alla" | "coach" | "adept" | "medlem";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "alla", label: "Alla" },
  { key: "coach", label: "Coacher" },
  { key: "adept", label: "Adepter" },
  { key: "medlem", label: "Medlemmar" },
];

/** Alla konton, sökbara och filtrerbara, med medlemskapet en knapptryckning bort. */
export function MemberList({ members }: { members: AdminMember[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("alla");
  const [plans, setPlans] = useState<Record<string, AdminMember["plan"]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const planOf = (m: AdminMember) => plans[m.id] ?? m.plan;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (filter === "coach" && m.role !== "coach") return false;
      if (filter === "adept" && m.role !== "adept") return false;
      if (filter === "medlem" && (plans[m.id] ?? m.plan) !== "medlem") return false;
      if (!q) return true;
      return [m.full_name, m.email, m.company_name ?? "", m.coach_name ?? ""].some((v) =>
        v.toLowerCase().includes(q),
      );
    });
  }, [members, query, filter, plans]);

  const toggle = (member: AdminMember) => {
    const next = planOf(member) === "medlem" ? "bas" : "medlem";
    if (next === "bas" && !window.confirm(`Ta bort medlemskapet för ${member.full_name}?`)) return;

    setError(null);
    setBusy(member.id);
    startTransition(async () => {
      const result = await setMemberPlan(member.id, next);
      if (result.ok) setPlans((p) => ({ ...p, [member.id]: next }));
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
          aria-label="Sök konto"
          placeholder="Sök på namn, e-post, företag eller coach"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[12px] transition-colors",
              filter === f.key
                ? "border-text-subtle bg-surface-3 font-medium text-text"
                : "border-line-strong text-text-muted hover:border-accent hover:text-text",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-line-strong bg-surface-2 p-3 text-sm text-text">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong px-6 py-10 text-center text-sm text-text-muted">
          {members.length === 0 ? "Ingen har registrerat sig än." : "Inget konto matchar."}
        </p>
      ) : (
        <Card className="min-w-0 p-0">
          <ul className="divide-y divide-line">
            {shown.map((m) => {
              const member = planOf(m) === "medlem";
              const details =
                m.role === "coach"
                  ? [
                      m.company_name,
                      `${m.adept_count ?? 0} ${m.adept_count === 1 ? "adept" : "adepter"}`,
                    ]
                  : [m.coach_name ? `coach: ${m.coach_name}` : "ingen coach – inte med i communityn"];
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                  <div className="min-w-0 flex-1 basis-60">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
                      {m.full_name}
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-normal text-text-muted">
                        {m.role === "coach" ? "Coach" : "Adept"}
                      </span>
                      {m.is_admin ? (
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
                    <p className="truncate text-[13px] text-text-muted">{m.email}</p>
                    <p className="text-[12px] text-text-subtle">
                      {[...details, `registrerad ${formatDate(m.created_at)}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {!m.is_admin && (
                    <Button
                      type="button"
                      size="sm"
                      variant={member ? "secondary" : "primary"}
                      disabled={busy === m.id}
                      onClick={() => toggle(m)}
                    >
                      {busy === m.id ? "Sparar …" : member ? "Ta bort medlemskap" : "Gör till medlem"}
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
