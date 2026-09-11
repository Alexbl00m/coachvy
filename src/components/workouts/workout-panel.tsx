"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Dumbbell, Plus, Trash2 } from "lucide-react";

import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { deleteWorkout } from "@/lib/workouts/actions";
import {
  formatDuration,
  resolveWorkout,
  toWorkout,
  type SavedWorkout,
} from "@/lib/workouts/schema";

/**
 * Adeptens sparade pass.
 *
 * Längden räknas fram ur stegen i stället för att sparas som en kolumn: ett
 * pass som har redigerats ska inte kunna visa en gammal längd bredvid nya
 * steg, och räkningen är en summa över en handfull rader.
 */
export function WorkoutPanel({
  adeptId,
  workouts,
  canEdit,
}: {
  adeptId: string;
  workouts: SavedWorkout[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);

  const remove = (id: string) => {
    setRemoving(id);
    startTransition(async () => {
      await deleteWorkout(id, adeptId);
      setRemoving(null);
      router.refresh();
    });
  };

  if (workouts.length === 0) {
    return (
      <EmptyState
        title="Inga pass ännu"
        description="Byggda pass som du sparar på adepten hamnar här, med profilen och W′bal-prognosen kvar."
        action={
          canEdit ? (
            <Link
              href={`${routes.workoutBuilder}?adept=${adeptId}`}
              className={buttonClass()}
            >
              <Plus aria-hidden className="size-4" />
              Bygg ett pass
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Link
            href={`${routes.workoutBuilder}?adept=${adeptId}`}
            className={buttonClass({ variant: "secondary", size: "sm" })}
          >
            <Plus aria-hidden className="size-4" />
            Bygg ett pass
          </Link>
        </div>
      )}

      <ul className="space-y-3">
        {workouts.map((saved) => {
          const resolved = resolveWorkout(toWorkout(saved), saved.reference);

          return (
            <li key={saved.id}>
              <Card className="min-w-0 p-4 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Link
                      href={`${routes.adepts}/${adeptId}/pass/${saved.id}`}
                      className="flex items-baseline gap-2 text-sm font-medium text-text hover:text-accent"
                    >
                      <Dumbbell
                        aria-hidden
                        className="size-4 shrink-0 translate-y-0.5 text-accent"
                      />
                      {saved.title}
                    </Link>
                    {saved.summary && (
                      <p className="text-[13px] text-text-muted">{saved.summary}</p>
                    )}
                    <p className="text-[12px] text-text-subtle">
                      {formatDate(saved.created_at)} · {saved.sport} ·{" "}
                      {formatDuration(resolved.totalSeconds)} · byggt mot{" "}
                      {saved.basis}{" "}
                      {saved.sport === "cykling"
                        ? `${Math.round(saved.reference)} W`
                        : `${saved.reference.toFixed(2).replace(".", ",")} m/s`}
                    </p>
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      aria-label={`Ta bort ${saved.title}`}
                      onClick={() => remove(saved.id)}
                      disabled={pending && removing === saved.id}
                      className="shrink-0 rounded-md p-1.5 text-text-subtle transition-colors hover:text-accent disabled:opacity-40"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
