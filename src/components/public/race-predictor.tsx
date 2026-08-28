"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { DataTable, ResultGrid } from "@/components/calculators/result-grid";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { formatDuration, parseMinutes } from "@/lib/calculators/time";
import {
  STANDARD_DISTANCES,
  buildPredictionModel,
  predictRaces,
  splits,
  type RaceResult,
} from "@/lib/calculators/race-prediction";

type Row = { id: number; distance: string; time: string };

const DEFAULTS: Row[] = [
  { id: 0, distance: "5000", time: "18:30" },
  { id: 1, distance: "10000", time: "38:40" },
];

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

/** "38:40" eller "1:25:30" till sekunder. */
function parseTime(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((p) => Number(p.replace(",", ".")));
  if (parts.some((p) => !Number.isFinite(p))) return null;
  if (parts.length === 1) return parts[0] * 60; // enbart minuter
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

const SPLIT_INTERVALS = [
  { label: "Varje kilometer", metres: 1000 },
  { label: "Var 5:e kilometer", metres: 5000 },
  { label: "Varje engelsk mil", metres: 1609.34 },
];

export function RacePredictor() {
  const [rows, setRows] = useState<Row[]>(DEFAULTS);
  const [nextId, setNextId] = useState(DEFAULTS.length);
  const [target, setTarget] = useState("21097.5");
  const [interval, setInterval] = useState("1000");
  const [drift, setDrift] = useState("0");

  const setRow = (id: number, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );

  const results: RaceResult[] = useMemo(
    () =>
      rows.flatMap((row) => {
        const metres = Number(row.distance.replace(",", "."));
        const seconds = parseTime(row.time);
        if (!Number.isFinite(metres) || metres <= 0 || seconds === null) return [];
        return [{ metres, seconds }];
      }),
    [rows],
  );

  const model = useMemo(() => buildPredictionModel(results), [results]);
  const predictions = useMemo(
    () => (model ? predictRaces(model, results) : []),
    [model, results],
  );

  const targetMetres = Number(target);
  const targetPrediction = predictions.find(
    (p) => Math.abs(p.metres - targetMetres) < 1,
  );

  const splitRows = useMemo(() => {
    if (!targetPrediction) return [];
    return splits(
      targetPrediction.seconds,
      targetPrediction.metres,
      Number(interval),
      Number(drift.replace(",", ".")) || 0,
    );
  }, [targetPrediction, interval, drift]);

  const kpis = [
    {
      label: "Utmattningsexponent",
      value: model ? sv(model.exponent, 3) : "–",
      hint: model?.individual
        ? `ur dina ${model.resultCount} lopp`
        : "Riegels förval",
    },
    {
      label: "Anpassning",
      value: model?.rSquared !== null && model?.rSquared !== undefined
        ? sv(model.rSquared * 100, 1)
        : "–",
      unit: model?.rSquared != null ? "%" : undefined,
      hint: model?.rSquared == null ? "kräver tre lopp" : undefined,
    },
    {
      label: "Måltid",
      value: targetPrediction ? formatDuration(targetPrediction.seconds) : "–",
      hint: STANDARD_DISTANCES.find((d) => Math.abs(d.metres - targetMetres) < 1)
        ?.label,
    },
    {
      label: "Måltempo",
      value: targetPrediction
        ? formatDuration(targetPrediction.paceSeconds)
        : "–",
      unit: "/km",
    },
  ];

  return (
    <div className="space-y-6">
      <ResultGrid items={kpis} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="min-w-0">
          <CardTitle
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRows((c) => [...c, { id: nextId, distance: "", time: "" }]);
                  setNextId((n) => n + 1);
                }}
              >
                <Plus aria-hidden className="size-4" />
                Lägg till lopp
              </Button>
            }
          >
            Dina lopp
          </CardTitle>

          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={row.id} className="flex items-end gap-3">
                <div className="flex-1">
                  <Field label={index === 0 ? "Distans" : ""} htmlFor={`d${row.id}`}>
                    <Select
                      id={`d${row.id}`}
                      value={row.distance}
                      onChange={(e) => setRow(row.id, { distance: e.target.value })}
                    >
                      <option value="">Välj …</option>
                      {STANDARD_DISTANCES.map((d) => (
                        <option key={d.metres} value={String(d.metres)}>
                          {d.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <div className="flex-1">
                  <Field
                    label={index === 0 ? "Tid" : ""}
                    htmlFor={`t${row.id}`}
                    hint={index === 0 ? "mm:ss eller h:mm:ss" : undefined}
                  >
                    <Input
                      id={`t${row.id}`}
                      value={row.time}
                      placeholder="38:40"
                      onChange={(e) => setRow(row.id, { time: e.target.value })}
                    />
                  </Field>
                </div>
                <button
                  type="button"
                  aria-label={`Ta bort lopp ${index + 1}`}
                  onClick={() =>
                    setRows((c) => c.filter((r) => r.id !== row.id))
                  }
                  disabled={rows.length <= 1}
                  className="mb-1.5 rounded-md p-1.5 text-text-subtle transition-colors hover:text-accent disabled:opacity-30"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </div>
            ))}
          </div>

          <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-text-subtle">
            Ett lopp räcker för en prognos. Med två eller fler räknas din egen
            utmattningsexponent fram i stället för schablonen – och den skiljer
            sig mer mellan löpare än man tror.
          </p>
        </Card>

        <Card className="min-w-0">
          <CardTitle>Mellantider</CardTitle>
          <div className="space-y-4">
            <Field label="Lopp" htmlFor="target">
              <Select
                id="target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                {STANDARD_DISTANCES.map((d) => (
                  <option key={d.metres} value={String(d.metres)}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Markering" htmlFor="interval">
              <Select
                id="interval"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
              >
                {SPLIT_INTERVALS.map((s) => (
                  <option key={s.metres} value={String(s.metres)}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Negativ split"
              htmlFor="drift"
              hint="% snabbare andra halvan"
            >
              <Input
                id="drift"
                inputMode="decimal"
                value={drift}
                onChange={(e) => setDrift(e.target.value)}
              />
            </Field>
          </div>
        </Card>
      </div>

      {model && model.warnings.length > 0 && (
        <Card>
          <ul className="space-y-1.5 text-sm text-text-muted">
            {model.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Card>
      )}

      {predictions.length > 0 && (
        <Card className="min-w-0">
          <CardTitle>Prognoser</CardTitle>
          <DataTable
            headers={["Distans", "Tid", "Tempo", ""]}
            minWidth={480}
            rows={predictions.map((p) => [
              p.label,
              formatDuration(p.seconds),
              `${formatDuration(p.paceSeconds)}/km`,
              p.extrapolated ? (
                <span key="x" className="text-[12px] text-text-subtle">
                  långt utanför dina lopp
                </span>
              ) : (
                ""
              ),
            ])}
          />
          <p className="mt-3 text-[12px] leading-relaxed text-text-subtle">
            Modellen håller väl inom ungefär tre gånger de distanser du matat
            in. Utanför det – och särskilt mot maraton – blir den optimistisk,
            eftersom det då är bränslet och inte utmattningen som sätter
            gränsen.
          </p>
        </Card>
      )}

      {splitRows.length > 0 && (
        <Card className="min-w-0">
          <CardTitle>
            Mellantider ·{" "}
            {STANDARD_DISTANCES.find((d) => Math.abs(d.metres - targetMetres) < 1)
              ?.label}
          </CardTitle>
          <DataTable
            headers={["Vid", "Klocka", "Tempo"]}
            minWidth={420}
            rows={splitRows.map((r) => [
              r.atMetres >= 1000
                ? `${sv(r.atMetres / 1000, r.atMetres % 1000 === 0 ? 0 : 2)} km`
                : `${Math.round(r.atMetres)} m`,
              formatDuration(r.elapsedSeconds),
              `${formatDuration(r.paceSeconds)}/km`,
            ])}
          />
        </Card>
      )}
    </div>
  );
}

export { parseMinutes };
