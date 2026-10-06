"use client";

import { useId, useState, useTransition } from "react";
import { FileScan, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { readTestReport } from "@/lib/tests/report-actions";
import {
  REPORT_MAX_BYTES,
  REPORT_TYPES,
  type ReportReading,
} from "@/lib/tests/report-read";

const sv = (v: number) => String(v).replace(".", ",");

/**
 * Ett foto från mobilen är ofta 5–10 MB. Det skalas ned i webbläsaren till
 * 2 400 pixlar på längsta sidan – mer än nog för att läsa siffrorna – så att
 * det ryms i anropet.
 */
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 1_500_000) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  return blob ? new File([blob], "rapport.jpg", { type: "image/jpeg" }) : file;
}

const unitOf = (r: ReportReading) => r.unit ?? "";

/**
 * Läser ut ett laktattest ur labbets rapport – PDF eller ett foto av
 * protokollet – och fyller i formuläret. Inget sparas här: coachen ser vad
 * som lästes, fyller i och granskar stegen innan testet sparas.
 */
export function ReportImport({
  adeptId,
  onApply,
}: {
  adeptId: string;
  onApply: (reading: ReportReading) => void;
}) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();
  const [reading, setReading] = useState<ReportReading | null>(null);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const read = (picked: File | undefined) => {
    if (!picked || pending) return;
    setError(null);
    setReading(null);
    setApplied(false);
    if (!REPORT_TYPES[picked.type]) {
      setError("Välj en PDF eller en bild av rapporten.");
      return;
    }
    setFileName(picked.name);
    start(async () => {
      const file = await shrinkImage(picked);
      if (file.size > REPORT_MAX_BYTES) {
        setError("Filen är för stor – högst cirka 4 MB.");
        return;
      }
      const form = new FormData();
      form.set("adeptId", adeptId);
      form.set("file", file);
      const result = await readTestReport(form);
      if (result.ok) setReading(result.reading);
      else setError(result.error);
    });
  };

  const r = reading;
  const first = r?.steps[0];
  const last = r?.steps[r.steps.length - 1];
  const withLactate = r?.steps.filter((s) => s.lactate !== null).length ?? 0;

  return (
    <Card className="print:hidden">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          read(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-dashed px-4 py-3.5 text-sm transition-colors",
          dragging
            ? "border-accent bg-accent-soft"
            : "border-line-strong hover:border-text-subtle",
        )}
      >
        <FileScan aria-hidden className="size-5 shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1">
          <span className="font-medium text-text">
            {pending
              ? `Läser ${fileName ?? "rapporten"} … det tar en halv minut`
              : "Läs in ur labbets rapport"}
          </span>
          <span className="block text-[12px] text-text-subtle">
            PDF eller ett foto av protokollet. Stegen, pulsen och laktatet läses
            ut och fylls i nedan, så granskar du innan du sparar. Rapporten
            skickas till AI-tjänsten för att läsas; Coachvy sparar den inte.
          </span>
        </span>
        <input
          id={inputId}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            read(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      {error && (
        <p role="alert" className="mt-3 text-[13px] text-bad">
          {error}
        </p>
      )}

      {r && first && last && (
        <div className="enter mt-4" role="status">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-4">
            {[
              [
                "Steg",
                `${r.steps.length} · ${sv(first.intensity)}–${sv(last.intensity)} ${unitOf(r)}`,
              ],
              ["Med laktat", `${withLactate} av ${r.steps.length}`],
              [
                "Vila",
                r.rest?.lactate !== null && r.rest?.lactate !== undefined
                  ? `${sv(r.rest.lactate)} mmol/l`
                  : "–",
              ],
              ["Datum", r.performedOn ?? "–"],
              ["Vikt", r.weightKg !== null ? `${sv(r.weightKg)} kg` : "–"],
              [
                "Gren",
                r.sport ? r.sport[0].toUpperCase() + r.sport.slice(1) : "–",
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-text-subtle">{label}</dt>
                <dd className="text-text tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          {r.warnings.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-md border border-line-strong bg-surface-2 px-3 py-2 text-[13px] text-text-muted">
              {r.warnings.map((w) => (
                <li key={w} className="flex gap-2">
                  <TriangleAlert
                    aria-hidden
                    className="mt-0.5 size-3.5 shrink-0 text-warn"
                  />
                  {w}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onApply(r);
                setApplied(true);
              }}
            >
              {applied ? "Fyll i igen" : "Fyll i formuläret"}
            </Button>
            <span className="text-[13px] text-text-subtle">
              {applied
                ? "Granska stegen nedan mot rapporten innan du sparar."
                : "Det som står i formuläret nu ersätts."}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
