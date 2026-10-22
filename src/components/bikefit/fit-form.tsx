"use client";

import { useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { saveFit, type FitInput } from "@/lib/bikefit/actions";
import type { BikeFitAnalysis } from "@/lib/bikefit/fit";
import {
  assessFit,
  DISCIPLINES,
  TEMPLATES,
  type Bands,
  type Discipline,
} from "@/lib/bikefit/templates";
import { routes } from "@/lib/routes";
import type { BikeFitRow } from "@/lib/types/database";
import { VERDICT_TEXT } from "./verdict-style";

const ANGLES = [
  {
    key: "knee",
    label: "Knäböjning i nedre dödläget",
    hint: "180° minus vinkeln höft–knä–fotled.",
  },
  { key: "trunk", label: "Bål mot vågrätt", hint: "Linjen axel–höft." },
  {
    key: "elbow",
    label: "Armbågens böjning",
    hint: "180° minus vinkeln axel–armbåge–handled.",
  },
  {
    key: "shoulder",
    label: "Axelvinkel",
    hint: "Höft–axel–armbåge. Bedöms inte.",
  },
  {
    key: "hip",
    label: "Höftvinkel vid nedre dödläget",
    hint: "Axel–höft–knä. Bedöms inte.",
  },
] as const;
type AngleKey = (typeof ANGLES)[number]["key"];

const num = (raw: string): number | null => {
  const v = Number(raw.replace(",", ".").trim());
  return raw.trim() === "" || !Number.isFinite(v) ? null : v;
};
const text = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : String(v).replace(".", ",");

export type VideoResult = {
  angles: Record<AngleKey, number | null>;
  legs: { thighMm: number | null; shankMm: number | null };
  analysis: BikeFitAnalysis;
  /** Filerna att ladda upp när fiten sparats. */
  files: { video: Blob | null; frame: Blob | null };
};

/**
 * En bikefit att fylla i: gren och mall, vinklarna (ur video eller för hand),
 * cykelns mått, checklistan och anteckningar. Bedömningen visas medan man
 * fyller i, med samma regler som rapporten.
 */
export function FitForm({
  adeptId,
  today,
  initial = null,
  previous = null,
  videoPanel,
  onSaved,
}: {
  adeptId: string;
  today: string;
  initial?: BikeFitRow | null;
  /** Förra fiten: måtten fylls i därifrån som utgångsläge. */
  previous?: BikeFitRow | null;
  /** Videoanalysen, när den finns; ger vinklarna i stället för fälten. */
  videoPanel?: (onResult: (r: VideoResult | null) => void) => ReactNode;
  /** Efter sparandet, innan sidan byts – för filerna. */
  onSaved?: (id: string, video: VideoResult | null) => Promise<string | null>;
}) {
  const router = useRouter();
  const ids = { date: useId(), bike: useId() };
  const base = initial ?? previous;
  const [discipline, setDiscipline] = useState<Discipline>(
    base?.discipline ?? "landsväg",
  );
  const [method, setMethod] = useState<"video" | "manuell">(
    initial?.method ?? (videoPanel ? "video" : "manuell"),
  );
  const [date, setDate] = useState(initial?.performed_on ?? today);
  const [bike, setBike] = useState(base?.bike ?? "");
  const [angles, setAngles] = useState<Record<AngleKey, string>>(() => ({
    knee: text(initial?.angles.knee),
    trunk: text(initial?.angles.trunk),
    elbow: text(initial?.angles.elbow),
    shoulder: text(initial?.angles.shoulder),
    hip: text(initial?.angles.hip),
  }));
  const [legs, setLegs] = useState({
    thigh: text(base?.legs.thighMm),
    shank: text(base?.legs.shankMm),
  });
  const [bands, setBands] = useState<Bands>(
    base?.bands ?? TEMPLATES[base?.discipline ?? "landsväg"].bands,
  );
  const [measures, setMeasures] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(base?.measures ?? {}).map(([k, v]) => [
        k,
        typeof v === "number" ? text(v) : (v ?? ""),
      ]),
    ),
  );
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    initial?.checklist ?? {},
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [changes, setChanges] = useState(initial?.changes ?? "");
  const [video, setVideo] = useState<VideoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const template = TEMPLATES[discipline];
  const fromVideo = method === "video" && video !== null;
  const values = useMemo(() => {
    const pick = (k: AngleKey) =>
      fromVideo ? video.angles[k] : num(angles[k]);
    return {
      knee: pick("knee"),
      trunk: pick("trunk"),
      elbow: pick("elbow"),
      shoulder: pick("shoulder"),
      hip: pick("hip"),
    };
  }, [fromVideo, video, angles]);
  const coachLegs = { thigh: num(legs.thigh), shank: num(legs.shank) };
  const legSource =
    coachLegs.thigh && coachLegs.shank
      ? "coach"
      : fromVideo && video.legs.thighMm && video.legs.shankMm
        ? "video"
        : undefined;
  const usedLegs =
    legSource === "coach"
      ? { thighMm: coachLegs.thigh, shankMm: coachLegs.shank }
      : legSource === "video"
        ? video!.legs
        : { thighMm: null, shankMm: null };
  const preview = assessFit(values, bands, { ...usedLegs, source: legSource });

  const chooseDiscipline = (d: Discipline) => {
    setDiscipline(d);
    setBands(TEMPLATES[d].bands);
  };

  const save = () => {
    setError(null);
    // En sparad videofit utan ny video: vinklarna står i fälten. Rättar
    // coachen dem är fiten inte längre mätt ur videon.
    const keptVideo =
      method === "video" && !video && initial?.method === "video";
    if (method === "video" && !video && !keptVideo) {
      setError("Analysera en video först, eller välj Manuellt.");
      return;
    }
    const edited =
      keptVideo &&
      ANGLES.some(
        (a) => num(angles[a.key]) !== (initial?.angles[a.key] ?? null),
      );
    const savedMethod = edited ? "manuell" : method;
    const measureValues: FitInput["measures"] = {};
    for (const m of template.measures) {
      const raw = measures[m.key]?.trim() ?? "";
      if (!raw) continue;
      if (m.unit === "text") measureValues[m.key] = raw;
      else {
        const v = num(raw);
        if (v === null) {
          setError(`${m.label} går inte att läsa som ett tal.`);
          return;
        }
        measureValues[m.key] = v;
      }
    }
    start(async () => {
      const result = await saveFit({
        id: initial?.id,
        adeptId,
        performedOn: date,
        discipline,
        bike,
        method: savedMethod,
        angles: values,
        bands,
        legs: { ...usedLegs, source: legSource },
        measures: measureValues,
        analysis: fromVideo ? video.analysis : (initial?.analysis ?? null),
        checklist,
        notes,
        changes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (onSaved) {
        const uploadError = await onSaved(result.id, fromVideo ? video : null);
        if (uploadError) {
          setError(uploadError);
          return;
        }
      }
      router.push(`${routes.adepts}/${adeptId}/bikefit/${result.id}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Card className="min-w-0">
        <CardTitle>Gren och cykel</CardTitle>
        <div
          role="radiogroup"
          aria-label="Gren"
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {DISCIPLINES.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={discipline === d}
              onClick={() => chooseDiscipline(d)}
              className={cn(
                "rounded-md border px-3 py-2.5 text-left transition-colors",
                discipline === d
                  ? "border-text-subtle bg-surface-3 text-text"
                  : "border-line text-text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              <span className="block text-sm font-medium">
                {TEMPLATES[d].label}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 max-w-3xl text-[13px] text-text-muted">
          {template.focus}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Datum" htmlFor={ids.date}>
            <DatePicker id={ids.date} value={date} onChange={setDate} />
          </Field>
          <Field label="Cykel" htmlFor={ids.bike} optional>
            <Input
              id={ids.bike}
              value={bike}
              maxLength={120}
              placeholder="Canyon Grail, storlek M"
              onChange={(e) => setBike(e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card className="min-w-0">
        <CardTitle>Vinklarna</CardTitle>
        {videoPanel && (
          <div
            role="radiogroup"
            aria-label="Sätt att mäta"
            className="mb-4 inline-flex rounded-md border border-line p-0.5"
          >
            {(
              [
                ["video", "Ur video"],
                ["manuell", "Manuellt"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={method === key}
                onClick={() => setMethod(key)}
                className={cn(
                  "rounded px-3 py-1.5 text-[13px] font-medium transition-colors",
                  method === key
                    ? "bg-surface-3 text-text"
                    : "text-text-muted hover:text-text",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {method === "video" && videoPanel ? (
          videoPanel(setVideo)
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ANGLES.map((a) => (
              <Field
                key={a.key}
                label={a.label}
                htmlFor={`vinkel-${a.key}`}
                hint={a.hint}
                optional={a.key !== "knee"}
              >
                <Input
                  id={`vinkel-${a.key}`}
                  inputMode="decimal"
                  value={angles[a.key]}
                  placeholder="°"
                  onChange={(e) =>
                    setAngles((s) => ({ ...s, [a.key]: e.target.value }))
                  }
                />
              </Field>
            ))}
          </div>
        )}

        <details className="mt-5 border-t border-line pt-4">
          <summary className="cursor-pointer text-[13px] font-medium text-text">
            Målband och benlängder
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {(
              [
                ["knee", "Knäböjning"],
                ["trunk", "Bål mot vågrätt"],
                ["elbow", "Armbåge"],
              ] as const
            ).map(([key, label]) => (
              <fieldset key={key} className="min-w-0">
                <legend className="text-[13px] font-medium text-text">
                  {label}, °
                </legend>
                <div className="mt-1.5 flex items-center gap-2">
                  <Input
                    aria-label={`${label}, lägst`}
                    inputMode="decimal"
                    value={text(bands[key].min)}
                    onChange={(e) =>
                      setBands((b) => ({
                        ...b,
                        [key]: { ...b[key], min: num(e.target.value) ?? 0 },
                      }))
                    }
                  />
                  <span className="text-text-subtle">–</span>
                  <Input
                    aria-label={`${label}, högst`}
                    inputMode="decimal"
                    value={text(bands[key].max)}
                    onChange={(e) =>
                      setBands((b) => ({
                        ...b,
                        [key]: { ...b[key], max: num(e.target.value) ?? 0 },
                      }))
                    }
                  />
                </div>
              </fieldset>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-text-subtle">
            Mallens band för {template.label.toLowerCase()}: knä{" "}
            {template.bands.knee.min}–{template.bands.knee.max}°, bål{" "}
            {template.bands.trunk.min}–{template.bands.trunk.max}°, armbåge{" "}
            {template.bands.elbow.min}–{template.bands.elbow.max}°. Bål och
            armbåge är erfarenhetsvärden; ändra efter din egen erfarenhet.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Lårbenets längd, mm"
              htmlFor="ben-lar"
              optional
              hint="Höftled till knäled. Ger millimeter per grad."
            >
              <Input
                id="ben-lar"
                inputMode="numeric"
                value={legs.thigh}
                onChange={(e) =>
                  setLegs((l) => ({ ...l, thigh: e.target.value }))
                }
              />
            </Field>
            <Field
              label="Underbenets längd, mm"
              htmlFor="ben-under"
              optional
              hint="Knäled till fotled."
            >
              <Input
                id="ben-under"
                inputMode="numeric"
                value={legs.shank}
                onChange={(e) =>
                  setLegs((l) => ({ ...l, shank: e.target.value }))
                }
              />
            </Field>
          </div>
        </details>

        <div
          className="mt-5 rounded-md border border-line bg-surface-2 p-3"
          aria-live="polite"
        >
          <p className="text-[12px] font-medium text-text-muted">Bedömning</p>
          <p className="mt-1 text-sm text-text">{preview.sentence}</p>
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
            {(
              [
                ["Knä", preview.knee],
                ["Bål", preview.trunk],
                ["Armbåge", preview.elbow],
              ] as const
            ).map(([label, a]) => (
              <span key={label} className="text-text-muted">
                {label}:{" "}
                <span
                  className={
                    a.verdict ? VERDICT_TEXT[a.verdict] : "text-text-subtle"
                  }
                >
                  {a.label}
                </span>
              </span>
            ))}
          </p>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardTitle>Cykelns mått</CardTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {template.measures.map((m) => (
              <Field
                key={m.key}
                label={`${m.label}${m.unit === "text" ? "" : `, ${m.unit}`}`}
                htmlFor={`matt-${m.key}`}
                hint={m.hint}
                optional
              >
                <Input
                  id={`matt-${m.key}`}
                  inputMode={m.unit === "text" ? "text" : "decimal"}
                  value={measures[m.key] ?? ""}
                  maxLength={120}
                  onChange={(e) =>
                    setMeasures((s) => ({ ...s, [m.key]: e.target.value }))
                  }
                />
              </Field>
            ))}
          </div>
          {previous && !initial && (
            <p className="mt-3 text-[12px] text-text-subtle">
              Ifyllt från förra fiten som utgångsläge – ändra det som ändrats.
            </p>
          )}
        </Card>

        <Card className="min-w-0">
          <CardTitle>Att titta efter</CardTitle>
          <div className="space-y-2">
            {template.checklist.map((item) => (
              <label key={item} className="flex items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={checklist[item] === true}
                  onChange={(e) =>
                    setChecklist((c) => ({ ...c, [item]: e.target.checked }))
                  }
                  className="mt-0.5 size-4 shrink-0 accent-[var(--text)]"
                />
                <span className="text-text">{item}</span>
              </label>
            ))}
          </div>
          <div className="mt-4 space-y-4">
            <Field
              label="Ändrat vid den här fiten"
              htmlFor="fit-andrat"
              optional
              hint="Det du flyttade – en sak i taget, så att nästa fit visar vad som verkade."
            >
              <Textarea
                id="fit-andrat"
                rows={2}
                maxLength={2000}
                value={changes}
                onChange={(e) => setChanges(e.target.value)}
              />
            </Field>
            <Field label="Anteckningar" htmlFor="fit-anteckningar" optional>
              <Textarea
                id="fit-anteckningar"
                rows={3}
                maxLength={4000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          {pending
            ? "Sparar …"
            : initial
              ? "Spara ändringarna"
              : "Spara bikefiten"}
        </Button>
        {error && (
          <p role="alert" className="text-[13px] text-bad">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
