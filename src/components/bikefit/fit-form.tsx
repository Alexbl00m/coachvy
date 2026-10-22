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
  type Assessment,
  type Bands,
  type Discipline,
} from "@/lib/bikefit/templates";
import type { RenderedMedia } from "@/lib/bikefit/render";
import { legsFromBody } from "@/lib/bikefit/protocol";
import {
  BodyFields,
  FindingsFields,
  IntakeFields,
  MeasureFields,
  ScreeningFields,
  type ScreeningStrings,
  type Strings,
} from "./protocol-fields";
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

/** Sparade värden som fälttext: tal med decimalkomma. */
function toStrings(source: object | null | undefined): Strings {
  return Object.fromEntries(
    Object.entries(source ?? {})
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => [k, typeof v === "number" ? text(v) : String(v)]),
  );
}

/** Fälten som går att läsa som tal. */
function numbers(source: Strings): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(source)) {
    const n = num(v);
    if (n !== null) out[k] = n;
  }
  return out;
}

const nonEmpty = (source: Strings) =>
  Object.fromEntries(Object.entries(source).filter(([, v]) => v.trim() !== ""));

export type VideoResult = {
  angles: Record<AngleKey, number | null>;
  legs: { thighMm: number | null; shankMm: number | null };
  analysis: BikeFitAnalysis;
  /**
   * Analysvideon och bilden från nedre dödläget för en bedömning. Spelas in
   * igen om bedömningen ändrats sedan sist, så att färgerna i videon alltid
   * följer samma gränser som texten.
   */
  media: (assessment: Assessment) => Promise<RenderedMedia>;
};

export type VideoPanelProps = {
  onResult: (r: VideoResult | null) => void;
  /** Bedömningen som den ser ut i formuläret just nu. */
  assessment: Assessment;
  /** Vevlängden ur cykelns mått, för skalan i videon. */
  crankMm: number | null;
  title: string;
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
  videoPanel?: (props: VideoPanelProps) => ReactNode;
  /** Efter sparandet, innan sidan byts – för filerna. */
  onSaved?: (
    id: string,
    video: VideoResult | null,
    assessment: Assessment,
  ) => Promise<string | null>;
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
  // Vid en ny fit filmas cykeln oftast som den kom, innan något flyttas.
  const [anglesAt, setAnglesAt] = useState<"före" | "efter">(
    initial?.angles_at ?? "före",
  );
  const [bike, setBike] = useState(base?.bike ?? "");
  const [angles, setAngles] = useState<Record<AngleKey, string>>(() => ({
    knee: text(initial?.angles.knee),
    trunk: text(initial?.angles.trunk),
    elbow: text(initial?.angles.elbow),
    shoulder: text(initial?.angles.shoulder),
    hip: text(initial?.angles.hip),
  }));
  const [body, setBody] = useState<Strings>(() => toStrings(base?.body));
  const [intake, setIntake] = useState<Strings>(() => {
    if (initial) return toStrings(initial.intake);
    // Från förra fiten följer det som brukar bestå; syftet är nytt varje gång.
    const { purpose: _purpose, ...rest } = previous?.intake ?? {};
    void _purpose;
    return toStrings(rest);
  });
  const [screening, setScreening] = useState<ScreeningStrings>(() =>
    Object.fromEntries(
      Object.entries(initial?.screening ?? {}).map(([k, v]) => [
        k,
        toStrings(v as Record<string, unknown>),
      ]),
    ),
  );
  const [findings, setFindings] = useState<Strings>(() =>
    toStrings(initial?.findings),
  );
  const [bands, setBands] = useState<Bands>(
    base?.bands ?? TEMPLATES[base?.discipline ?? "landsväg"].bands,
  );
  // Före: cykeln som den kom – vid en ny fit förra fitens slutläge. Efter:
  // bara det som ändrades; tomt betyder oförändrat.
  const [before, setBefore] = useState<Strings>(() =>
    toStrings(initial ? initial.measures_before : previous?.measures),
  );
  const [after, setAfter] = useState<Strings>(() => {
    if (!initial) return {};
    const was = toStrings(initial.measures_before);
    return Object.fromEntries(
      Object.entries(toStrings(initial.measures)).filter(
        ([k, v]) => was[k] !== v,
      ),
    );
  });
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    initial?.checklist ?? {},
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [changes, setChanges] = useState(initial?.changes ?? "");
  const [video, setVideo] = useState<VideoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // En ny fit som sparats men vars filer inte kom upp: nästa försök ändrar
  // den i stället för att skapa en till.
  const [savedId, setSavedId] = useState<string | null>(null);
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
  // Benen att räkna millimeter med: coachens mått (den filmade sidan när
  // den är känd), annars videons, annars det en sparad fit redan hade.
  const side = fromVideo
    ? video.analysis.side
    : (initial?.analysis?.side ?? null);
  const bodyLegs = legsFromBody(numbers(body), side);
  const kept =
    initial?.legs.thighMm && initial.legs.shankMm && initial.legs.source
      ? initial.legs
      : null;
  const legSource: "coach" | "video" | undefined = bodyLegs
    ? "coach"
    : fromVideo && video.legs.thighMm && video.legs.shankMm
      ? "video"
      : (kept?.source ?? undefined);
  const usedLegs = bodyLegs
    ? bodyLegs
    : legSource === "video" && fromVideo
      ? video.legs
      : kept
        ? { thighMm: kept.thighMm ?? null, shankMm: kept.shankMm ?? null }
        : { thighMm: null, shankMm: null };
  const crank = num(after.crank_length ?? "") ?? num(before.crank_length ?? "");
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
    const read = (source: Strings) => {
      const out: FitInput["measures"] = {};
      for (const m of template.measures) {
        const raw = source[m.key]?.trim() ?? "";
        if (!raw) continue;
        if (m.unit === "text") out[m.key] = raw;
        else {
          const v = num(raw);
          if (v === null) return `${m.label} går inte att läsa som ett tal.`;
          out[m.key] = v;
        }
      }
      return out;
    };
    const measuresBefore = read(before);
    // Efter är före med ändringarna ovanpå.
    const measuresAfter = read({ ...before, ...nonEmpty(after) });
    if (
      typeof measuresBefore === "string" ||
      typeof measuresAfter === "string"
    ) {
      setError(
        typeof measuresBefore === "string"
          ? measuresBefore
          : (measuresAfter as string),
      );
      return;
    }
    const bodyValues = numbers(body);
    const badBody = Object.entries(body).find(
      ([k, v]) => v.trim() !== "" && bodyValues[k] === undefined,
    );
    if (badBody) {
      setError("Ett kroppsmått går inte att läsa som ett tal.");
      return;
    }
    const screeningValues: FitInput["screening"] = {};
    for (const [test, fields] of Object.entries(screening)) {
      const v: FitInput["screening"][string] = {};
      for (const k of ["l", "r", "value"] as const) {
        const n = num(fields[k] ?? "");
        if (n !== null) v[k] = n;
      }
      if (fields.note?.trim()) v.note = fields.note.trim();
      if (Object.keys(v).length) screeningValues[test] = v;
    }
    start(async () => {
      const result = await saveFit({
        id: initial?.id ?? savedId ?? undefined,
        adeptId,
        performedOn: date,
        discipline,
        bike,
        method: savedMethod,
        angles: values,
        anglesAt,
        bands,
        legs: { ...usedLegs, source: legSource },
        measures: measuresAfter,
        measuresBefore,
        body: bodyValues,
        intake,
        screening: screeningValues,
        findings,
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
        const uploadError = await onSaved(
          result.id,
          fromVideo ? video : null,
          preview,
        );
        if (uploadError) {
          setSavedId(result.id);
          setError(`Fiten är sparad, men ${uploadError} Försök igen.`);
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

      <IntakeFields
        value={intake}
        onChange={(k, v) => setIntake((s) => ({ ...s, [k]: v }))}
      />
      <BodyFields
        value={body}
        onChange={(k, v) => setBody((s) => ({ ...s, [k]: v }))}
        carried={
          !initial && Boolean(previous && Object.keys(previous.body).length)
        }
      />
      <ScreeningFields
        value={screening}
        onChange={(test, k, v) =>
          setScreening((s) => ({ ...s, [test]: { ...s[test], [k]: v } }))
        }
        previous={initial ? null : (previous?.screening ?? null)}
      />

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

        <div
          role="radiogroup"
          aria-label="Vinklarna gäller"
          className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]"
        >
          <span className="text-text-muted">Vinklarna gäller</span>
          {(
            [
              ["före", "cykeln som den kom"],
              ["efter", "efter ändringarna"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name="vinklar-galler"
                checked={anglesAt === key}
                onChange={() => setAnglesAt(key)}
                className="size-4 accent-[var(--text)]"
              />
              <span className="text-text">{label}</span>
            </label>
          ))}
        </div>

        {method === "video" && videoPanel ? (
          videoPanel({
            onResult: setVideo,
            assessment: preview,
            crankMm: crank,
            title: `${template.label}${bike ? ` · ${bike}` : ""}`,
          })
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
            Målband
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

      <MeasureFields
        measures={template.measures}
        before={before}
        after={after}
        onBefore={(k, v) => setBefore((s) => ({ ...s, [k]: v }))}
        onAfter={(k, v) => setAfter((s) => ({ ...s, [k]: v }))}
        carried={!initial && Boolean(previous)}
      />

      <FindingsFields
        value={findings}
        onChange={(k, v) => setFindings((s) => ({ ...s, [k]: v }))}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0">
            <p className="mb-2 text-[13px] font-medium text-text">
              Att titta efter
            </p>
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
          </div>
          <div className="min-w-0 space-y-4">
            <Field
              label="Ändrat vid den här fiten, i korthet"
              htmlFor="fit-andrat"
              optional
              hint="Det viktigaste som flyttades. Visas överst i rapporten och i listan."
            >
              <Textarea
                id="fit-andrat"
                rows={2}
                maxLength={2000}
                value={changes}
                onChange={(e) => setChanges(e.target.value)}
              />
            </Field>
            <Field label="Övrigt" htmlFor="fit-anteckningar" optional>
              <Textarea
                id="fit-anteckningar"
                rows={3}
                maxLength={4000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>
        </div>
      </FindingsFields>

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
