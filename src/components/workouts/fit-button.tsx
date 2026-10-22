"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { canExportFit, workoutToFit } from "@/lib/workouts/export/fit";
import { workoutFileName } from "@/lib/workouts/export/file-name";
import type { Workout } from "@/lib/workouts/schema";

/**
 * Passet till klockan i ett tryck: en .fit-fil byggd i webbläsaren, samma som
 * under Till klockan på passets sida. Visas inte för grenar som saknar export.
 */
export function FitButton({
  workout,
  reference,
}: {
  workout: Workout;
  reference: number;
}) {
  const [error, setError] = useState<string | null>(null);
  if (!canExportFit(workout.sport)) return null;

  const save = () => {
    setError(null);
    try {
      const data = workoutToFit(workout, reference) as Uint8Array<ArrayBuffer>;
      const url = URL.createObjectURL(
        new Blob([data], { type: "application/vnd.ant.fit" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = workoutFileName(workout.title, "fit");
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Filen gick inte att skapa.",
      );
    }
  };

  return (
    <>
      <Button onClick={save} className="font-semibold">
        <Download aria-hidden className="size-4" />
        Till klockan (.fit)
      </Button>
      {error && (
        <p role="alert" className="w-full text-[0.8125rem] text-bad">
          {error}
        </p>
      )}
    </>
  );
}
