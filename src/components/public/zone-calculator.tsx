"use client";

import { useMemo, useState } from "react";

import { DataTable, ResultGrid } from "@/components/calculators/result-grid";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { formatDuration } from "@/lib/calculators/time";
import { cn } from "@/lib/cn";
import { criticalSpeedZones, ftpZones, thresholdZones } from "@/lib/tests/zones";

type Mode = "ftp" | "tröskeltempo" | "critical-speed";

const MODES: { id: Mode; label: string; description: string }[] = [
  {
    id: "ftp",
    label: "FTP · cykel",
    description:
      "Coggans sjuzonsmodell i procent av FTP. Den vanligaste indelningen på cykel.",
  },
  {
    id: "tröskeltempo",
    label: "Tröskeltempo · löpning",
    description:
      "Zoner som multiplar av tröskeltempot. Använd när tröskeln kommer ur ett laktattest eller ett tröskellopp.",
  },
  {
    id: "critical-speed",
    label: "Critical speed · löpning",
    description:
      "Zoner som fraktioner av critical speed. Använd när tröskeln kommer ur ett CS-test.",
  },
];

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

/** "3:45" till sekunder per km. */
function parsePace(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes(":")) {
    const [m, s = "0"] = trimmed.split(":");
    const minutes = Number(m);
    const seconds = Number(s.replace(",", "."));
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    return minutes * 60 + seconds;
  }
  const value = Number(trimmed.replace(",", "."));
  return Number.isFinite(value) ? value * 60 : null;
}

export function ZoneCalculator() {
  const [mode, setMode] = useState<Mode>("ftp");
  const [ftp, setFtp] = useState("280");
  const [pace, setPace] = useState("4:00");
  const [cs, setCs] = useState("15,0");

  const { rows, unit, headline } = useMemo(() => {
    if (mode === "ftp") {
      const value = Number(ftp.replace(",", "."));
      if (!(value > 0)) return { rows: [], unit: "W", headline: null };
      return {
        rows: ftpZones(value).map((z) => ({
          zone: z.zone,
          span:
            z.max === null
              ? `> ${Math.round(z.min ?? 0)}`
              : `${Math.round(z.min ?? 0)}–${Math.round(z.max)}`,
          description: z.description,
        })),
        unit: "W",
        headline: `${Math.round(value)} W`,
      };
    }

    if (mode === "tröskeltempo") {
      const seconds = parsePace(pace);
      if (seconds === null || !(seconds > 0)) {
        return { rows: [], unit: "min/km", headline: null };
      }
      // Zonerna räknas i fart; tempot är dess invers.
      const speed = 1000 / seconds;
      return {
        rows: thresholdZones(speed).map((z) => ({
          zone: z.zone,
          span:
            z.min === null
              ? `långsammare än ${formatDuration(1000 / (z.max as number))}`
              : z.max === null
                ? `snabbare än ${formatDuration(1000 / z.min)}`
                : `${formatDuration(1000 / z.min)}–${formatDuration(1000 / z.max)}`,
          description: z.description,
        })),
        unit: "min/km",
        headline: `${formatDuration(seconds)}/km`,
      };
    }

    const value = Number(cs.replace(",", "."));
    if (!(value > 0)) return { rows: [], unit: "km/h", headline: null };
    return {
      rows: criticalSpeedZones(value).map((z) => ({
        zone: z.zone,
        span: `${sv(z.min ?? 0, 1)}–${sv(z.max ?? 0, 1)}`,
        description: z.description,
      })),
      unit: "km/h",
      headline: `${sv(value, 1)} km/h`,
    };
  }, [mode, ftp, pace, cs]);

  const active = MODES.find((m) => m.id === mode);

  return (
    <div className="space-y-6">
      <ResultGrid
        items={[
          { label: "Utgår från", value: headline ?? "–", hint: active?.label },
          {
            label: "Zoner",
            value: rows.length || "–",
            hint: rows.length ? "hela skalan nedan" : "fyll i ett värde",
          },
          {
            label: "Tröskelzon",
            value: rows[3]?.span ?? "–",
            unit: rows.length ? unit : undefined,
            hint: rows[3]?.zone,
          },
          {
            label: "Grundzon",
            value: rows[1]?.span ?? "–",
            unit: rows.length ? unit : undefined,
            hint: rows[1]?.zone,
          },
        ]}
      />

      <Card>
        <CardTitle>Vad utgår du från?</CardTitle>
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                mode === m.id
                  ? "border-accent bg-accent-soft text-text"
                  : "border-line-strong text-text-muted hover:border-accent/60 hover:text-text",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-text-muted">
          {active?.description}
        </p>

        <div className="mt-4 max-w-xs">
          {mode === "ftp" && (
            <Field label="FTP" htmlFor="ftp" hint="watt">
              <Input
                id="ftp"
                inputMode="decimal"
                value={ftp}
                onChange={(e) => setFtp(e.target.value)}
              />
            </Field>
          )}
          {mode === "tröskeltempo" && (
            <Field label="Tröskeltempo" htmlFor="pace" hint="min:sek per km">
              <Input
                id="pace"
                value={pace}
                placeholder="4:00"
                onChange={(e) => setPace(e.target.value)}
              />
            </Field>
          )}
          {mode === "critical-speed" && (
            <Field label="Critical speed" htmlFor="cs" hint="km/h">
              <Input
                id="cs"
                inputMode="decimal"
                value={cs}
                onChange={(e) => setCs(e.target.value)}
              />
            </Field>
          )}
        </div>
      </Card>

      {rows.length > 0 && (
        <Card className="min-w-0">
          <CardTitle>Zonerna</CardTitle>
          <DataTable
            headers={["Zon", `Spann (${unit})`, "Vad den gör"]}
            minWidth={540}
            rows={rows.map((r) => [r.zone, r.span, r.description])}
          />
        </Card>
      )}
    </div>
  );
}
