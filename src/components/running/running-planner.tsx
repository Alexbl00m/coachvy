"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { parseRaceTime } from "@/lib/plan-library/paces";
import { RACES, type RaceKey } from "@/lib/plan-library/races";
import {
  distanceByKey,
  inputToParams,
  levelsFor,
  MAX_WEEKS,
  MIN_WEEKS,
  PLANNER_DISTANCES,
  planWeeks,
  REFERENCE,
  type PlannerDistance,
  type PlannerInput,
  type PlannerLevel,
} from "@/lib/running-planner/planner";
import {
  zoneAnchor,
  zoneKeysFor,
  zonePaces,
} from "@/lib/running-planner/zones";
import { TRAINING_PHASES } from "@/lib/tests/phases";

import { WeekBars, type WeekBarRow } from "./week-bars";
import { ZoneBar } from "./zone-bar";

const NUMBER_WORDS = [
  "",
  "en",
  "två",
  "tre",
  "fyra",
  "fem",
  "sex",
  "sju",
  "åtta",
  "nio",
  "tio",
  "elva",
  "tolv",
  "tretton",
  "fjorton",
  "femton",
  "sexton",
  "sjutton",
  "arton",
  "nitton",
  "tjugo",
];
const numberWord = (n: number) =>
  n <= 20
    ? NUMBER_WORDS[n]
    : n < 30
      ? `tjugo${NUMBER_WORDS[n - 20]}`
      : "trettio";

const sv = (v: number) => v.toString().replace(".", ",");

const segment = (on: boolean) =>
  cn(
    "flex-1 rounded-md border px-2.5 py-1.5 text-[0.8125rem] transition-colors",
    on
      ? "border-text-subtle bg-surface-3 text-text"
      : "border-line-strong text-text-muted hover:text-text",
  );

export type PaceSeed = { race: RaceKey; time: string; source: string } | null;

/**
 * Löpplaneraren: inställningarna till vänster, veckorna som staplar och
 * zonerna fästa längst ner. Inställningarna står i adressen, så att en
 * plan går att spara och skicka.
 */
export function RunningPlanner({
  initial,
  pace,
  adepts,
  adeptId,
}: {
  initial: PlannerInput;
  /** Tiden zonerna räknas ur: ur adressen, adeptens form eller ingen. */
  pace: PaceSeed;
  /** Coachens adepter, att utgå från. Tom för en medlem. */
  adepts: { id: string; full_name: string }[];
  adeptId: string | null;
}) {
  const router = useRouter();
  const [input, setInput] = useState(initial);
  const [paceRace, setPaceRace] = useState<RaceKey>(pace?.race ?? "10K");
  const [paceTime, setPaceTime] = useState(pace?.time ?? "");
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => planWeeks(input), [input]);
  const distance = distanceByKey(input.distance);
  const seconds = parseRaceTime(paceTime);
  const anchor = seconds
    ? zoneAnchor({ race: paceRace, seconds }, distance.race)
    : null;
  const zones = anchor ? zonePaces(anchor, zoneKeysFor(distance.race)) : [];

  const query = (next: PlannerInput, race = paceRace, time = paceTime) => {
    const p = inputToParams(next);
    if (time.trim()) {
      p.set("tid", time.trim());
      p.set("tidlopp", race);
    }
    if (adeptId) p.set("adept", adeptId);
    return p;
  };
  const sync = (next: PlannerInput, race = paceRace, time = paceTime) =>
    router.replace(`?${query(next, race, time)}`, { scroll: false });
  const update = (patch: Partial<PlannerInput>) => {
    const next = { ...input, ...patch };
    if (patch.distance) {
      const levels = levelsFor(patch.distance);
      if (!levels.includes(next.level)) next.level = levels[0];
    }
    setInput(next);
    setCopied(false);
    sync(next);
  };
  const numberOf = (raw: string) => {
    const v = Number(raw.replace(",", "."));
    return raw.trim() && Number.isFinite(v) && v > 0 ? v : 0;
  };

  const reference = REFERENCE[input.distance][input.level];
  const phaseLabel = (key: string) =>
    TRAINING_PHASES.find((p) => p.key === key)?.label ?? key;

  const rows: WeekBarRow[] = result.ok
    ? result.plan.weeks.map((w, i, all) => ({
        key: w.week,
        label: `V${w.week}`,
        value: w.volumeKm,
        valueText: `${sv(w.volumeKm)} km`,
        inner: w.longRunKm,
        emphasis: w.label,
        items: w.sessions,
        quiet:
          w.kind === "avlastning" || w.kind === "taper" || w.kind === "lopp",
        group:
          i === 0 || all[i - 1].phase !== w.phase ? phaseLabel(w.phase) : null,
        note: w.note,
        aside:
          w.longShare !== null ? `${Math.round(w.longShare * 100)} %` : null,
        asideTone:
          w.longShare === null
            ? null
            : w.longShare > 0.4
              ? "varning"
              : w.longShare > 0.33
                ? "notis"
                : null,
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit lg:sticky lg:top-20">
          <CardTitle>Inställningar</CardTitle>
          <div className="space-y-4">
            {adepts.length > 0 && (
              <Field label="Utgå från adept" htmlFor="pl-adept" optional>
                <Select
                  id="pl-adept"
                  value={adeptId ?? ""}
                  onChange={(e) => {
                    const p = inputToParams(input);
                    if (e.target.value) p.set("adept", e.target.value);
                    router.push(`?${p}`);
                  }}
                >
                  <option value="">Ingen – fyll i själv</option>
                  {adepts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <Field label="Lopp" htmlFor="pl-distans">
              <Select
                id="pl-distans"
                value={input.distance}
                onChange={(e) =>
                  update({ distance: e.target.value as PlannerDistance })
                }
              >
                {PLANNER_DISTANCES.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>

            <fieldset>
              <legend className="mb-1.5 text-[0.8125rem] font-medium text-text">
                Nivå
              </legend>
              <div className="flex gap-1.5">
                {([1, 2, 3] as PlannerLevel[]).map((l) => {
                  const r = REFERENCE[input.distance][l];
                  return (
                    <button
                      key={l}
                      type="button"
                      disabled={!r}
                      aria-pressed={input.level === l}
                      onClick={() => update({ level: l })}
                      className={cn(
                        segment(input.level === l),
                        "disabled:opacity-35",
                      )}
                    >
                      <span className="block font-medium">{l}</span>
                      <span className="block text-[0.6875rem] text-text-subtle tabular-nums">
                        {r ? `${r.peakWeekKm} km/v` : "–"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <Field
              label="Veckor till loppet"
              htmlFor="pl-veckor"
              hint={`${MIN_WEEKS}–${MAX_WEEKS} veckor, loppveckan inräknad.`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={MIN_WEEKS}
                  max={MAX_WEEKS}
                  value={input.weeks}
                  onChange={(e) => update({ weeks: Number(e.target.value) })}
                  aria-label="Veckor till loppet"
                  className="flex-1 accent-[var(--accent)]"
                />
                <Input
                  id="pl-veckor"
                  inputMode="numeric"
                  value={input.weeks}
                  onChange={(e) => {
                    const n = Math.round(Number(e.target.value));
                    if (n >= MIN_WEEKS && n <= MAX_WEEKS) update({ weeks: n });
                  }}
                  className="w-16 text-center tabular-nums"
                />
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Långpass i dag" htmlFor="pl-langpass" hint="km">
                <Input
                  id="pl-langpass"
                  inputMode="decimal"
                  defaultValue={input.longRunKm || ""}
                  placeholder={reference ? String(reference.startLongKm) : ""}
                  onChange={(e) =>
                    update({ longRunKm: numberOf(e.target.value) })
                  }
                />
              </Field>
              <Field label="Veckovolym i dag" htmlFor="pl-volym" hint="km">
                <Input
                  id="pl-volym"
                  inputMode="decimal"
                  defaultValue={input.weeklyKm || ""}
                  placeholder={reference ? String(reference.startWeekKm) : ""}
                  onChange={(e) =>
                    update({ weeklyKm: numberOf(e.target.value) })
                  }
                />
              </Field>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-[0.8125rem] font-medium text-text">
                Avlastning
              </legend>
              <div className="flex gap-1.5">
                {([3, 4] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={input.deloadEvery === n}
                    onClick={() => update({ deloadEvery: n })}
                    className={segment(input.deloadEvery === n)}
                  >
                    Var {n === 3 ? "tredje" : "fjärde"} vecka
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="border-t border-line pt-4">
              <p className="mb-1.5 text-[0.8125rem] font-medium text-text">
                Zoner ur en tid
              </p>
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
                <Input
                  aria-label="Tid"
                  inputMode="numeric"
                  value={paceTime}
                  placeholder={RACES.find((r) => r.key === paceRace)?.example}
                  onChange={(e) => {
                    setPaceTime(e.target.value);
                    sync(input, paceRace, e.target.value);
                  }}
                />
                <Select
                  aria-label="Distans för tiden"
                  value={paceRace}
                  onChange={(e) => {
                    const race = e.target.value as RaceKey;
                    setPaceRace(race);
                    sync(input, race, paceTime);
                  }}
                >
                  {RACES.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </div>
              <p className="mt-1.5 text-[0.6875rem] leading-snug text-text-subtle">
                {pace?.source ??
                  "Ett färskt lopp eller en måltid. Tiden närmast loppet i distans träffar bäst – en mil för halvmaran, en halvmara för maran."}
                {paceTime.trim() && !seconds && (
                  <span className="block text-warn">
                    Skriv tiden som 46:30 eller 1:45:00.
                  </span>
                )}
              </p>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={async () => {
                const url = `${window.location.origin}${window.location.pathname}?${query(input)}`;
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                } catch {
                  window.prompt("Kopiera länken", url);
                }
              }}
            >
              {copied ? (
                <Check aria-hidden className="size-4" />
              ) : (
                <Link2 aria-hidden className="size-4" />
              )}
              {copied ? "Länken är kopierad" : "Kopiera länk till planen"}
            </Button>
          </div>
        </Card>

        <div className="min-w-0 space-y-6">
          {!result.ok ? (
            <Card>
              <p role="alert" className="text-sm text-warn">
                {result.error}
              </p>
            </Card>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    label: "Toppvecka",
                    value: `${result.plan.reference.peakWeekKm} km`,
                    hint: `vecka ${result.plan.peakWeek}`,
                  },
                  {
                    label: "Längsta långpass",
                    value: `${result.plan.reference.peakLongKm} km`,
                    hint: `från ${sv(result.plan.start.longRunKm)} km`,
                  },
                  {
                    label: "Start",
                    value: `${sv(result.plan.start.weeklyKm)} km`,
                    hint: "i veckan",
                  },
                  {
                    label: "Totalt",
                    value: `${result.plan.totalKm} km`,
                    hint: `på ${input.weeks} veckor`,
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg border border-line bg-surface px-4 py-3"
                  >
                    <dt className="text-[0.6875rem] font-medium tracking-wide text-text-subtle uppercase">
                      {s.label}
                    </dt>
                    <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-text">
                      {s.value}
                    </dd>
                    <dd className="text-[0.75rem] text-text-subtle">{s.hint}</dd>
                  </div>
                ))}
              </dl>

              {result.plan.warnings.length > 0 && (
                <ul className="space-y-1.5 rounded-lg border border-warn/40 bg-warn/5 px-4 py-3 text-[0.8125rem] text-text">
                  {result.plan.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}

              <Card>
                <h2 className="mb-3 text-2xl font-semibold tracking-tight text-text">
                  De {numberWord(input.weeks)} veckorna
                </h2>
                <WeekBars
                  rows={rows}
                  legend="Stapeln är veckans volym, den ljusa början långpasset. Procenten till höger är långpassets andel av veckan: gul över 40 %. Passen är blockets återkommande format – ett eller två, som byggs på en sak i taget. Nivåns siffra är toppveckans volym."
                />
                <ZoneBar
                  zones={zones}
                  caption={`Zoner för ${distance.name.toLowerCase()}`}
                />
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
