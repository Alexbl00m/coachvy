"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ScaleField } from "@/components/training/scale-field";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { saveCheckin } from "@/lib/training/actions";
import {
  READINESS_MAX,
  readReadiness,
  readinessScore,
  sessionLoad,
} from "@/lib/training/load";
import type { AdeptCheckinRow } from "@/lib/types/database";

/**
 * Dagens incheckning.
 *
 * Två frågor som hålls isär hela vägen: vad passet kostade, och hur atleten
 * mår. De slås aldrig ihop till ett tal – belastning och återhämtning mäter
 * olika saker och pekar åt olika håll, så ett medelvärde av dem betyder
 * ingenting.
 *
 * Skalan för passet är Borg CR10, satt en stund efteråt och för passet som
 * helhet. De fyra måendefrågorna är Hoopers index, vända så att 5 alltid är
 * bäst – resten av appen läser högre tal som bättre, och en skala som byter
 * riktning mitt i ett formulär blir ifylld fel.
 */

const WELLNESS = [
  {
    key: "sleep" as const,
    label: "Sömn",
    low: "Sov uselt",
    high: "Sov mycket bra",
  },
  {
    key: "fatigue" as const,
    label: "Trötthet",
    low: "Utmattad",
    high: "Pigg",
  },
  {
    key: "soreness" as const,
    label: "Muskelömhet",
    low: "Mycket öm",
    high: "Inte öm alls",
  },
  {
    key: "stress" as const,
    label: "Stress",
    low: "Mycket stressad",
    high: "Avslappnad",
  },
];

type Wellness = Record<(typeof WELLNESS)[number]["key"], number | null>;

const numberOrNull = (raw: string): number | null => {
  const value = Number(raw.replace(",", "."));
  return raw.trim() && Number.isFinite(value) ? value : null;
};

export function CheckinForm({
  adeptId,
  existing,
  onSaved,
}: {
  adeptId: string;
  /** Dagens rad, om adepten redan checkat in. Formuläret skriver över den. */
  existing: AdeptCheckinRow | null;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [performedOn, setPerformedOn] = useState(
    existing?.performed_on ?? new Date().toISOString().slice(0, 10),
  );
  const [trained, setTrained] = useState(existing ? existing.session_rpe !== null : true);
  const [rpe, setRpe] = useState<number | null>(
    existing?.session_rpe === null || existing?.session_rpe === undefined
      ? null
      : Number(existing.session_rpe),
  );
  const [minutes, setMinutes] = useState(
    existing?.duration_minutes ? String(Number(existing.duration_minutes)) : "",
  );
  const [wellness, setWellness] = useState<Wellness>({
    sleep: existing?.sleep ?? null,
    fatigue: existing?.fatigue ?? null,
    soreness: existing?.soreness ?? null,
    stress: existing?.stress ?? null,
  });
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const parsedMinutes = numberOrNull(minutes);
  const load = trained ? sessionLoad(rpe, parsedMinutes) : 0;
  const readiness = readinessScore({
    performedOn,
    sessionRpe: null,
    durationMinutes: null,
    ...wellness,
  });

  const save = () =>
    startTransition(async () => {
      setError(null);
      setSaved(false);

      const result = await saveCheckin({
        adeptId,
        performedOn,
        sessionRpe: trained ? rpe : null,
        durationMinutes: trained ? parsedMinutes : null,
        sleep: wellness.sleep,
        fatigue: wellness.fatigue,
        soreness: wellness.soreness,
        stress: wellness.stress,
        workoutId: null,
        note: note.trim() || null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      onSaved?.();
      router.refresh();
    });

  const canSave =
    !pending && (trained ? rpe !== null && parsedMinutes !== null : true);

  return (
    <Card className="min-w-0">
      <CardTitle>Incheckning</CardTitle>

      <div className="space-y-5">
        <Field label="Datum" htmlFor="checkin_date">
          <Input
            id="checkin_date"
            type="date"
            value={performedOn}
            onChange={(e) => {
              setPerformedOn(e.target.value);
              setSaved(false);
            }}
          />
        </Field>

        <div className="space-y-2">
          <span className="block text-[13px] font-medium text-text">
            Tränade du?
          </span>
          <div className="flex gap-2">
            {[
              { value: true, label: "Ja" },
              { value: false, label: "Vilodag" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setTrained(option.value)}
                aria-pressed={trained === option.value}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  trained === option.value
                    ? "border-accent bg-accent-soft text-text"
                    : "border-line-strong text-text-muted hover:border-accent/60 hover:text-text",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {trained && (
          <>
            <ScaleField
              label="Hur kändes passet?"
              value={rpe}
              onChange={setRpe}
              min={0}
              max={10}
              lowLabel="0 · vila"
              highLabel="10 · maximalt"
              hint="Borg CR10 för passet som helhet. Sätt det en stund efteråt, inte mitt i."
            />

            <Field label="Längd" htmlFor="minutes" hint="minuter">
              <Input
                id="minutes"
                inputMode="numeric"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </Field>

            {load > 0 && (
              <p className="rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] text-text-muted">
                Belastning:{" "}
                <span className="font-medium text-text tabular-nums">
                  {Math.round(load)}
                </span>{" "}
                enheter
              </p>
            )}
          </>
        )}

        <div className="space-y-4 border-t border-line pt-4">
          <span className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-text">Hur mår du?</span>
            {readiness !== null && (
              <span className="text-[12px] text-text-muted tabular-nums">
                {readiness} av {READINESS_MAX} · {readReadiness(readiness)}
              </span>
            )}
          </span>

          {WELLNESS.map((item) => (
            <ScaleField
              key={item.key}
              label={item.label}
              value={wellness[item.key]}
              onChange={(next) =>
                setWellness((current) => ({ ...current, [item.key]: next }))
              }
              min={1}
              max={5}
              lowLabel={item.low}
              highLabel={item.high}
            />
          ))}

          {readiness === null && (
            <p className="text-[11px] text-text-subtle">
              Alla fyra behöver ett svar för att dagen ska gå att jämföra med
              andra dagar. Hoppa hellre över hela måendedelen än att fylla i
              några av frågorna.
            </p>
          )}
        </div>

        <Field label="Anteckning" htmlFor="checkin_note" optional>
          <Textarea
            id="checkin_note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>

      {error && <p className="mt-4 text-sm text-text">{error}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={!canSave}>
          {pending ? "Sparar …" : existing ? "Uppdatera" : "Spara"}
        </Button>
        <span className="text-[13px] text-text-subtle">
          {saved
            ? "Sparat."
            : trained && rpe === null
              ? "Sätt hur passet kändes."
              : "En incheckning per dag – en ny skriver över den gamla."}
        </span>
      </div>
    </Card>
  );
}
