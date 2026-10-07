"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { canExportFit, workoutToFit } from "@/lib/workouts/export/fit";
import { workoutFileName } from "@/lib/workouts/export/file-name";
import { workoutToZwo } from "@/lib/workouts/export/zwo";
import type { Workout } from "@/lib/workouts/schema";

/** Lämnar över en fil till webbläsarens nedladdning. */
function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Ge webbläsaren tid att börja läsa innan adressen släpps.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Passet ut ur Coachvy, till klockan eller cykeldatorn.
 *
 * Filerna byggs i webbläsaren ur exakt det som visas – också ett pass som
 * just ändrats i tabellen och ännu inte sparats.
 */
export function ExportWorkout({
  workout,
  reference,
}: {
  workout: Workout;
  reference: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const cycling = workout.sport === "cykling";

  if (!canExportFit(workout.sport)) {
    return (
      <Card className="print:hidden">
        <CardTitle>Till klockan</CardTitle>
        <p className="text-sm text-text-muted">
          Simpass går inte att exportera än – bassängpass behöver banlängd och
          simsätt per steg, och de flesta klockor saknar fartmål i vatten. Skriv
          ut passet i stället.
        </p>
      </Card>
    );
  }

  const zwo = cycling ? workoutToZwo(workout, reference) : null;

  const saveFit = () => {
    setError(null);
    try {
      download(
        workoutFileName(workout.title, "fit"),
        workoutToFit(workout, reference) as Uint8Array<ArrayBuffer>,
        "application/vnd.ant.fit",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Filen gick inte att skapa. Kontrollera stegens längder.",
      );
    }
  };

  return (
    <Card className="print:hidden">
      <CardTitle>Till klockan och cykeldatorn</CardTitle>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={saveFit}>
          <Download aria-hidden className="size-4" />
          Ladda ner .fit
        </Button>
        {zwo && (
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              download(
                workoutFileName(workout.title, "zwo"),
                zwo,
                "application/xml",
              )
            }
          >
            <Download aria-hidden className="size-4" />
            Ladda ner .zwo
          </Button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-text">{error}</p>}

      <dl className="mt-4 grid gap-x-6 gap-y-3 border-t border-line pt-4 text-[13px] sm:grid-cols-2">
        <div>
          <dt className="font-medium text-text">.fit – Garmin och andra</dt>
          <dd className="mt-1 leading-relaxed text-text-muted">
            Koppla in klockan eller cykeldatorn med USB och lägg filen i mappen{" "}
            <code className="text-text">GARMIN/NewFiles</code>. Passet hamnar
            bland träningspassen när enheten kopplas ur. Många andra enheter och
            appar som tar emot strukturerade pass läser också .fit.
          </dd>
        </div>
        {zwo && (
          <div>
            <dt className="font-medium text-text">.zwo – Zwift med flera</dt>
            <dd className="mt-1 leading-relaxed text-text-muted">
              För Zwift och appar som läser Zwifts format. Effekten står i
              procent av FTP: sätt FTP i appen till {Math.round(reference)} W (
              {workout.basis}) så blir watten desamma som här.
            </dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-[12px] text-text-subtle">
        Målen skrivs i {cycling ? "watt" : "fart"} räknat mot {workout.basis}.
        Ett mål utan spann får {cycling ? "±3 %" : "±2 %"} så att klockan inte
        larmar vid varje svängning.
      </p>
    </Card>
  );
}
