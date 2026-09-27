"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { acceptCoachInvitation } from "@/lib/adepts/invitation-actions";

type Invitation = { id: string; coach_name: string; company_name: string | null };

/** En coach har lagt till adepten – adepten tackar ja själv. */
export function CoachInvitations({ invitations }: { invitations: Invitation[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (invitations.length === 0) return null;

  const accept = (id: string) =>
    start(async () => {
      setError(null);
      const result = await acceptCoachInvitation(id);
      if (!result.ok) return setError(result.error);
      router.refresh();
    });

  return (
    <div className="mb-6 space-y-3">
      {invitations.map((inv) => (
        <Card key={inv.id} className="border-accent/40">
          <div className="flex flex-wrap items-center gap-4">
            <UserPlus aria-hidden className="size-5 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text">
                {inv.coach_name}
                {inv.company_name ? `, ${inv.company_name}` : ""} vill bli din coach
              </p>
              <p className="text-[13px] text-text-muted">
                Tackar du ja ser din coach dina tester, pass och incheckningar, och du kommer in i
                communityn. Det du redan loggat följer med.
              </p>
            </div>
            <Button type="button" onClick={() => accept(inv.id)} disabled={pending}>
              {pending ? "Kopplar …" : "Tacka ja"}
            </Button>
          </div>
        </Card>
      ))}
      {error && <p className="text-[13px] text-text">{error}</p>}
    </div>
  );
}
