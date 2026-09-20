"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { PrintButton } from "@/components/workouts/print-button";
import { ContextSummary } from "@/components/workouts/context-summary";
import { WorkoutView } from "@/components/workouts/workout-view";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Sport } from "@/lib/calculators/lactate";
import {
  manualAthleteContext,
  type AthleteContext,
} from "@/lib/workouts/context";
import { generateWorkout } from "@/lib/workouts/generate";
import { saveWorkout } from "@/lib/workouts/actions";
import type { Workout } from "@/lib/workouts/schema";

type AdeptOption = { id: string; full_name: string };

const SPORTS: { id: Sport; label: string }[] = [
  { id: "cykling", label: "Cykling" },
  { id: "löpning", label: "Löpning" },
  { id: "simning", label: "Simning" },
];

/**
 * Exempel som visar vad rutan klarar, inte vad den helst vill ha.
 *
 * De är medvetet olika i form: ett med en tidsram, ett med ett fysiologiskt
 * mål, ett med ett lopp att förbereda. Coachen ska se att prompten får vara
 * en mening och inte ett formulär.
 */
const EXAMPLES: Record<Sport, string[]> = {
  cykling: [
    "En timme som tömmer W′ men går att genomföra",
    "Tröskelpass, 4×8 min, total tid under 75 min",
    "Lugnt återhämtningspass på 45 min",
  ],
  löpning: [
    "Intervaller på bana, 40 min totalt, strax över CS",
    "Tempopass inför ett milplopp om tre veckor",
    "Backintervaller med full återhämtning",
  ],
  simning: [
    "Teknikpass på 2 000 m med korta hårda avslut",
    "8×100 m på tröskeln med kort vila",
    "Distanspass under CSS, 45 min",
  ],
};

const decimal = (raw: string): number | null => {
  const value = Number(raw.replace(",", "."));
  return raw.trim() && Number.isFinite(value) && value > 0 ? value : null;
};

export function WorkoutBuilder({
  adepts,
  adeptId,
  serverContext,
  initialWorkout,
  configured,
}: {
  adepts: AdeptOption[];
  adeptId: string | null;
  serverContext: AthleteContext | null;
  /** Ett sparat pass som öppnats för ändring. */
  initialWorkout: Workout | null;
  configured: boolean;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [pending, startGeneration] = useTransition();
  const [saving, startSave] = useTransition();

  const [manualSport, setManualSport] = useState<Sport>("cykling");
  const [prompt, setPrompt] = useState("");
  const [reference, setReference] = useState("");
  const [critical, setCritical] = useState("");
  const [reserve, setReserve] = useState("");

  const [workout, setWorkout] = useState<Workout | null>(initialWorkout);
  const [usedContext, setUsedContext] = useState<AthleteContext | null>(null);
  const [usedPrompt, setUsedPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const sport = serverContext?.sport ?? manualSport;
  const cycling = sport === "cykling";

  /**
   * Underlaget passet vilar på.
   *
   * Efter en generering är det exakt det servern räknade med – inte det som
   * råkar stå i fälten nu. Annars skulle grafen kunna visa ett pass mot en
   * tröskel som aldrig var med när passet byggdes.
   */
  const context: AthleteContext = useMemo(() => {
    if (usedContext) return usedContext;
    if (serverContext) return serverContext;
    return manualAthleteContext(sport, {
      reference: decimal(reference),
      // Farten skrivs i km/h för löpning, som i resten av appen; modellen
      // räknar i m/s.
      critical:
        sport === "löpning"
          ? (decimal(critical) ?? 0) / 3.6 || null
          : decimal(critical),
      // W′ skrivs i kilojoule eftersom det är så det redovisas överallt annars.
      reserve: cycling ? (decimal(reserve) ?? 0) * 1000 || null : decimal(reserve),
    });
  }, [usedContext, serverContext, sport, reference, critical, reserve, cycling]);

  const chooseAdept = (next: string) =>
    startNavigation(() => {
      setWorkout(null);
      setUsedContext(null);
      setSaved(null);
      router.push(next ? `?adept=${next}` : "?");
    });

  const build = () =>
    startGeneration(async () => {
      setError(null);
      setSaved(null);

      const result = await generateWorkout({
        prompt,
        sport,
        adeptId,
        manual: {
          reference: context.reference,
          critical: context.balance?.critical ?? null,
          reserve: context.balance?.reserve ?? null,
        },
        previous: workout,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setWorkout(result.workout);
      setUsedContext(result.context);
      setUsedPrompt(prompt);
      setPrompt("");
    });

  const store = () =>
    startSave(async () => {
      if (!workout || adeptId === null || context.reference === null) return;
      setError(null);

      const result = await saveWorkout({
        adeptId,
        workout,
        reference: context.reference,
        critical: context.balance?.critical ?? null,
        reserve: context.balance?.reserve ?? null,
        prompt: usedPrompt || null,
        scheduledFor: null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved("Passet är sparat på adepten.");
    });

  const busy = pending || navigating;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] print:hidden">
        <Card className="min-w-0">
          <CardTitle>{workout ? "Ändra passet" : "Beskriv passet"}</CardTitle>

          <div className="space-y-4">
            <Textarea
              aria-label={workout ? "Ändring" : "Beskrivning av passet"}
              rows={3}
              value={prompt}
              placeholder={
                workout
                  ? "Till exempel: korta intervallerna till 6 minuter och lägg till ett varv"
                  : EXAMPLES[sport][0]
              }
              onChange={(e) => setPrompt(e.target.value)}
            />

            {!workout && (
              <div className="flex flex-wrap gap-2">
                {EXAMPLES[sport].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setPrompt(example)}
                    className="rounded-full border border-line-strong px-3 py-1 text-[12px] text-text-muted transition-colors hover:border-accent/60 hover:text-text"
                  >
                    {example}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={build}
                disabled={busy || prompt.trim().length === 0 || !configured}
              >
                <Sparkles aria-hidden className="size-4" />
                {pending
                  ? "Bygger …"
                  : workout
                    ? "Bygg om passet"
                    : "Bygg passet"}
              </Button>

              {workout && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setWorkout(null);
                    setUsedContext(null);
                    setSaved(null);
                  }}
                >
                  Börja om
                </Button>
              )}
            </div>

            {!configured && (
              <p className="text-[13px] text-text-muted">
                Passbyggaren behöver <code className="text-text">ANTHROPIC_API_KEY</code> i{" "}
                <code className="text-text">.env.local</code>. Resten av sidan
                fungerar ändå – ett sparat pass går att läsa och räkna på utan
                nyckel.
              </p>
            )}
          </div>
        </Card>

        <Card className="min-w-0">
          <CardTitle>Underlag</CardTitle>

          <div className="space-y-4">
            <Field label="Adept" htmlFor="adept" hint="styr både gren och tröskelvärden">
              <Select
                id="adept"
                value={adeptId ?? ""}
                onChange={(e) => chooseAdept(e.target.value)}
              >
                <option value="">Ingen – fyll i talen själv</option>
                {adepts.map((adept) => (
                  <option key={adept.id} value={adept.id}>
                    {adept.full_name}
                  </option>
                ))}
              </Select>
            </Field>

            {adeptId === null && (
              <>
                <Field label="Gren" htmlFor="sport">
                  <Select
                    id="sport"
                    value={manualSport}
                    onChange={(e) => {
                      setManualSport(e.target.value as Sport);
                      setWorkout(null);
                      setUsedContext(null);
                    }}
                  >
                    {SPORTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                {cycling && (
                  <Field label="FTP" htmlFor="reference" hint="W" optional>
                    <Input
                      id="reference"
                      inputMode="decimal"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </Field>
                )}

                <Field
                  label={cycling ? "CP" : "Critical speed"}
                  htmlFor="critical"
                  hint={cycling ? "W" : sport === "löpning" ? "km/h" : "m/s"}
                  optional
                >
                  <Input
                    id="critical"
                    inputMode="decimal"
                    value={critical}
                    onChange={(e) => setCritical(e.target.value)}
                  />
                </Field>

                <Field
                  label={cycling ? "W′" : "D′"}
                  htmlFor="reserve"
                  hint={cycling ? "kJ" : "m"}
                  optional
                >
                  <Input
                    id="reserve"
                    inputMode="decimal"
                    value={reserve}
                    onChange={(e) => setReserve(e.target.value)}
                  />
                </Field>
              </>
            )}

            <ContextSummary context={context} />
          </div>
        </Card>
      </div>

      {error && (
        <Card className="print:hidden">
          <p className="text-sm text-text">{error}</p>
        </Card>
      )}

      {workout && context.reference !== null && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-text">
                {workout.title}
              </h2>
              {workout.summary && (
                <p className="max-w-2xl text-sm text-text-muted">
                  {workout.summary}
                </p>
              )}
            </div>
            <span className="rounded bg-surface-2 px-2 py-1 text-[12px] text-text-muted print:hidden">
              {SPORTS.find((s) => s.id === workout.sport)?.label}
            </span>
          </div>

          <WorkoutView
            workout={workout}
            reference={context.reference}
            model={context.balance}
            onChange={(next) => {
              setWorkout(next);
              setSaved(null);
            }}
          />

          <div className="flex flex-wrap items-center gap-3 print:hidden">
            {adeptId !== null && (
              <Button type="button" onClick={store} disabled={saving}>
                {saving ? "Sparar …" : "Spara på adepten"}
              </Button>
            )}
            <PrintButton />
            <span className="text-[13px] text-text-subtle">
              {saved ??
                (adeptId === null
                  ? "Välj en adept för att kunna spara passet."
                  : "Sparas med de tröskelvärden det byggdes mot.")}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
