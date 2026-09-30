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
    "Tröskelpass, 4×8 min, total tid under 75 min",
    "En timme som tömmer W′ men går att genomföra",
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
  selfService = false,
}: {
  adepts: AdeptOption[];
  adeptId: string | null;
  serverContext: AthleteContext | null;
  /** Ett sparat pass som öppnats för ändring. */
  initialWorkout: Workout | null;
  configured: boolean;
  /**
   * En medlemsadept som bygger åt sig själv. Adepten är given, och det finns
   * inga tal att fylla i för hand – passet byggs mot de egna testerna.
   */
  selfService?: boolean;
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
  // W′bal är ett val, inte en grind. Förvalt av: de flesta pass handlar inte
  // om att tömma den anaeroba reserven.
  const [useBalance, setUseBalance] = useState(false);

  const [workout, setWorkout] = useState<Workout | null>(initialWorkout);
  const [usedContext, setUsedContext] = useState<AthleteContext | null>(null);
  const [usedPrompt, setUsedPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  /** Datumet passet läggs på i kalendern när det sparas. Valfritt. */
  const [scheduledFor, setScheduledFor] = useState("");

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
      reserve: cycling
        ? (decimal(reserve) ?? 0) * 1000 || null
        : decimal(reserve),
    });
  }, [
    usedContext,
    serverContext,
    sport,
    reference,
    critical,
    reserve,
    cycling,
  ]);

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
        useBalance,
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
        // Byggdes passet utan W′bal sparas det utan – annars skulle det visas
        // med en reservkurva ingen bad om när det öppnas igen.
        critical: useBalance ? (context.balance?.critical ?? null) : null,
        reserve: useBalance ? (context.balance?.reserve ?? null) : null,
        prompt: usedPrompt || null,
        scheduledFor: scheduledFor || null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(
        selfService
          ? "Passet är sparat i dina pass."
          : "Passet är sparat på adepten.",
      );
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
                    onClick={() => {
                      setPrompt(example);
                      if (/W′|D′/.test(example)) setUseBalance(true);
                    }}
                    className="rounded-full border border-line-strong px-3 py-1 text-[12px] text-text-muted transition-colors hover:border-accent/60 hover:text-text"
                  >
                    {example}
                  </button>
                ))}
              </div>
            )}

            <label className="flex items-start gap-3 rounded-md border border-line px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={useBalance}
                onChange={(e) => setUseBalance(e.target.checked)}
                className="mt-0.5 size-4 accent-[var(--color-accent)]"
              />
              <span>
                <span className="font-medium text-text">
                  Bygg mot {cycling ? "W′bal" : "D′bal"}
                </span>
                <span className="block text-[12px] text-text-subtle">
                  För pass som handlar om den anaeroba reserven –
                  VO2max-intervaller, lopp med attacker, banan.{" "}
                  {context.balance
                    ? "Passet prövas mot reserven och grafen visar var den bottnar."
                    : `Kräver ${cycling ? "CP och W′" : "CS och D′"} ur ett test.`}
                </span>
              </span>
            </label>

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
                Passbyggaren behöver en nyckel från Anthropic:{" "}
                <code className="text-text">ANTHROPIC_API_KEY</code> som
                miljövariabel – i Vercel under Settings → Environment Variables.
                Resten av sidan fungerar ändå – ett sparat pass går att läsa och
                räkna på utan nyckel.
              </p>
            )}
          </div>
        </Card>

        <Card className="min-w-0">
          <CardTitle>Underlag</CardTitle>

          <div className="space-y-4">
            {!selfService && (
              <Field
                label="Adept"
                htmlFor="adept"
                hint="styr både gren och tröskelvärden"
              >
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
            )}

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
            model={useBalance ? context.balance : null}
            onChange={(next) => {
              setWorkout(next);
              setSaved(null);
            }}
          />

          <div className="flex flex-wrap items-center gap-3 print:hidden">
            {adeptId !== null && (
              <label className="flex items-center gap-2 text-[13px] text-text-muted">
                Datum
                <input
                  type="date"
                  value={scheduledFor}
                  onChange={(e) => {
                    setScheduledFor(e.target.value);
                    setSaved(null);
                  }}
                  className="h-9 rounded-md border border-line-strong bg-surface px-2 text-sm text-text focus:border-accent focus:outline-none"
                />
              </label>
            )}
            {adeptId !== null && (
              <Button type="button" onClick={store} disabled={saving}>
                {saving
                  ? "Sparar …"
                  : selfService
                    ? "Spara i mina pass"
                    : "Spara på adepten"}
              </Button>
            )}
            <PrintButton />
            <span className="text-[13px] text-text-subtle">
              {saved ??
                (selfService
                  ? "Sparas med de värden det byggdes mot."
                  : adeptId === null
                    ? "Välj en adept för att kunna spara passet."
                    : "Sparas med de tröskelvärden det byggdes mot.")}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
