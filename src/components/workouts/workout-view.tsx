"use client";

import { useMemo } from "react";

import { ResultGrid } from "@/components/calculators/result-grid";
import { Card, CardTitle } from "@/components/ui/card";
import { WorkoutChart } from "@/components/workouts/workout-chart";
import { WorkoutSteps } from "@/components/workouts/workout-steps";
import { cn } from "@/lib/cn";
import { readBalance, wPrimeBalance, type BalanceModel } from "@/lib/workouts/balance";
import { formatDuration, resolveWorkout, type Workout } from "@/lib/workouts/schema";

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

/**
 * Passet som det ser ut när det är klart: nyckeltal, profil, steg, motivering.
 *
 * Samma vy används av byggaren och av ett sparat pass. Skillnaden är en enda
 * prop: får vyn en `onChange` går stegen att redigera, annars läses de bara.
 * Det är samma uppdelning som testräknaren har mellan appen och den publika
 * sidan – två vyer som inte kan glida isär eftersom det bara finns en.
 */
export function WorkoutView({
  workout,
  reference,
  model,
  onChange,
}: {
  workout: Workout;
  reference: number;
  model: BalanceModel | null;
  onChange?: (next: Workout) => void;
}) {
  const cycling = workout.sport === "cykling";

  const resolved = useMemo(
    () => resolveWorkout(workout, reference),
    [workout, reference],
  );

  const balance = useMemo(
    () => (model ? wPrimeBalance(resolved.steps, model) : null),
    [resolved, model],
  );

  if (resolved.steps.length === 0) {
    return (
      <Card>
        <p className="text-sm text-text-muted">
          Inget av stegen gick att lösa upp i tid. Kontrollera längderna.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ResultGrid
        items={[
          {
            label: "Längd",
            value: formatDuration(resolved.totalSeconds),
          },
          ...(resolved.totalMetres !== null
            ? [
                {
                  label: "Sträcka",
                  value: sv(resolved.totalMetres / 1000, 2),
                  unit: "km",
                },
              ]
            : []),
          ...(balance
            ? [
                {
                  label: cycling ? "Ur W′" : "Ur D′",
                  value: cycling
                    ? sv(balance.aboveCritical / 1000, 1)
                    : String(Math.round(balance.aboveCritical)),
                  unit: cycling ? "kJ" : "m",
                  hint: "arbete över tröskeln",
                },
                {
                  label: "Lägsta reserv",
                  value: String(Math.round(balance.minimumFraction * 100)),
                  unit: "%",
                  hint: balance.depleted ? "tar slut under passet" : "kvar när det är som tommast",
                },
              ]
            : []),
        ]}
      />

      <Card className="min-w-0">
        <CardTitle>{balance ? "Profil och W′bal" : "Profil"}</CardTitle>
        <WorkoutChart
          steps={resolved.steps}
          reference={reference}
          basis={workout.basis}
          sport={workout.sport}
          balance={balance}
        />
        <p
          className={cn(
            "mt-3 border-t border-line pt-3 text-[13px] leading-relaxed",
            balance?.depleted ? "text-text" : "text-text-muted",
          )}
        >
          {balance
            ? readBalance(balance, cycling ? "J" : "m")
            : cycling
              ? "Utan mätt CP och W′ går det inte att säga om passet räcker till. Profilen visas ändå."
              : "Utan mätt CS och D′ går det inte att säga om passet räcker till. Profilen visas ändå."}
        </p>
      </Card>

      <Card className="min-w-0">
        <CardTitle>Stegen</CardTitle>
        <WorkoutSteps
          workout={workout}
          reference={reference}
          onChange={onChange}
        />
        {onChange && (
          <p className="mt-3 text-[12px] text-text-subtle print:hidden">
            Ändra en längd eller ett mål så räknas grafen och W′bal om direkt.
          </p>
        )}
      </Card>

      {workout.rationale && (
        <Card>
          <CardTitle>Därför det här passet</CardTitle>
          <p className="whitespace-pre-line text-sm leading-relaxed text-text-muted">
            {workout.rationale}
          </p>
        </Card>
      )}
    </div>
  );
}
