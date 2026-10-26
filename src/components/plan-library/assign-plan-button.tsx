"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { queuePhase } from "@/lib/plan-library/queue-actions";
import { adeptHref } from "@/lib/routes";

/** Nästa måndag, eller i dag om det är måndag. */
function nextMonday(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  if (day !== 0) d.setDate(d.getDate() + 7 - day);
  return d.toISOString().slice(0, 10);
}

/**
 * Lägger planen på en av coachens adepter, sist i adeptens kö av faser.
 * Har adepten ingen plan börjar den på det valda datumet.
 */
export function AssignPlanButton({
  versionId,
  title,
  minWeeks,
  maxWeeks,
  levels,
  adepts,
}: {
  versionId: string;
  title: string;
  minWeeks: number;
  maxWeeks: number;
  levels: { id: string; key: string; name: string }[];
  adepts: { id: string; full_name: string }[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adeptId, setAdeptId] = useState(adepts[0]?.id ?? "");
  const [weeks, setWeeks] = useState(String(maxWeeks));
  const [levelId, setLevelId] = useState(levels[Math.floor(levels.length / 2)]?.id ?? "");
  const [startDate, setStartDate] = useState(nextMonday);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (adepts.length === 0) return null;

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <UserPlus aria-hidden className="size-4" />
        Lägg på adept
      </Button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        aria-labelledby="lagg-pa-rubrik"
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-text shadow-2xl backdrop:bg-black/60"
      >
        <form
          className="space-y-5 p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const result = await queuePhase({
                adeptId,
                versionId,
                weeks: Number(weeks),
                levelId,
                startDate,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setOpen(false);
              router.push(adeptHref(adeptId, "plan"));
            });
          }}
        >
          <div>
            <p className="text-[0.75rem] font-medium text-text-muted">Lägg på adept</p>
            <h2 id="lagg-pa-rubrik" className="text-lg font-semibold">
              {title}
            </h2>
            <p className="mt-1 text-[0.8125rem] text-text-muted">
              Planen läggs sist i adeptens faser, direkt efter den sista. Har
              adepten ingen plan börjar den på datumet du väljer.
            </p>
          </div>

          <Field label="Adept" htmlFor="lagg-pa-adept">
            <Select id="lagg-pa-adept" value={adeptId} onChange={(e) => setAdeptId(e.target.value)}>
              {adepts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Veckor"
              htmlFor="lagg-pa-veckor"
              hint={minWeeks === maxWeeks ? `${maxWeeks} veckor` : `${minWeeks}–${maxWeeks} veckor`}
            >
              <Input
                id="lagg-pa-veckor"
                type="number"
                inputMode="numeric"
                min={minWeeks}
                max={maxWeeks}
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
              />
            </Field>
            <Field label="Nivå" htmlFor="lagg-pa-niva">
              <Select id="lagg-pa-niva" value={levelId} onChange={(e) => setLevelId(e.target.value)}>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.key} · {l.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Börjar, om adepten saknar plan" htmlFor="lagg-pa-start">
            <Input
              id="lagg-pa-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>

          {error && (
            <p role="alert" className="text-sm text-warn">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={pending} className="font-semibold">
              {pending ? "Lägger på …" : "Lägg på"}
            </Button>
            <Button type="button" variant="ghost" className="ml-auto" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
