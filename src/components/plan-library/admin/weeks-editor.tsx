"use client";

import { useState } from "react";
import { Copy, Flag, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import {
  addWeek,
  copyWeek,
  deleteWeek,
  saveWeek,
  saveWeekVolumes,
} from "@/lib/plan-library/admin-actions";
import { DAY_SHORT, WEEK_KINDS } from "@/lib/plan-library/labels";
import type {
  TemplateSession,
  VolumeUnit,
  WeekKind,
  WeekVolume,
} from "@/lib/plan-library/types";

import { SessionCard } from "../session-card";
import { useAction } from "../use-action";
import type { LibrarySession } from "@/lib/session-library/library";

import { SessionDialog, type DisciplineOption } from "./session-dialog";

type WeekRow = {
  id: string;
  phaseId: string;
  position: number;
  kind: WeekKind;
  title: string | null;
  note: string | null;
  checkpoint: boolean;
};

type Open = {
  weekId: string;
  day: number | null;
  session: TemplateSession | null;
  label: string;
};

/**
 * Veckorna fas för fas, dag för dag. Ett pass visas med den översta
 * nivåns variant och hur många nivåer det finns på; klicka för att ändra
 * alla nivåer. Varje vecka har sin volym per nivå – det nivåerna skiljer
 * sig i – och kan vara en avstämning av formuppskattningen.
 */
export function WeeksEditor({
  versionId,
  editable,
  phases,
  weeks,
  sessions,
  levels,
  disciplines,
  volumes,
  volumeUnit,
  library,
}: {
  versionId: string;
  editable: boolean;
  phases: { id: string; name: string }[];
  weeks: WeekRow[];
  sessions: TemplateSession[];
  levels: { id: string; key: string; name: string }[];
  disciplines: DisciplineOption[];
  volumes: WeekVolume[];
  volumeUnit: VolumeUnit;
  /** Passbiblioteket, att hämta pass ur i passdialogen. */
  library: LibrarySession[];
}) {
  const [open, setOpen] = useState<Open | null>(null);
  const { pending, error, run } = useAction();
  const disciplineName = (key: string) =>
    disciplines.find((d) => d.key === key)?.name ?? key;
  // Ett nytt pass börjar i den disciplin mallen har flest pass i.
  const counts = new Map<string, number>();
  for (const s of sessions) {
    counts.set(s.discipline, (counts.get(s.discipline) ?? 0) + 1);
  }
  const defaultDiscipline =
    [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    disciplines.find((d) => d.key === "löpning")?.key ??
    disciplines[0]?.key ??
    "löpning";

  return (
    <div className="space-y-8">
      {error && (
        <p role="alert" className="text-sm text-warn">
          {error}
        </p>
      )}
      {phases.map((phase) => {
        const own = weeks.filter((w) => w.phaseId === phase.id);
        return (
          <section key={phase.id} aria-labelledby={`fas-${phase.id}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3
                id={`fas-${phase.id}`}
                className="text-sm font-semibold text-text"
              >
                {phase.name}{" "}
                <span className="font-normal text-text-subtle">
                  · {own.length} {own.length === 1 ? "vecka" : "veckor"}
                </span>
              </h3>
              {editable && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    run(() => addWeek({ versionId, phaseId: phase.id }))
                  }
                >
                  <Plus aria-hidden className="size-4" />
                  Lägg till vecka
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {own.map((week) => (
                <WeekBlock
                  key={week.id}
                  week={week}
                  editable={editable}
                  pending={pending}
                  sessions={sessions.filter((s) => s.weekId === week.id)}
                  levels={levels}
                  volumes={volumes.filter((v) => v.weekId === week.id)}
                  volumeUnit={volumeUnit}
                  onSaveVolumes={(next) =>
                    run(() =>
                      saveWeekVolumes({
                        versionId,
                        weekId: week.id,
                        volumes: next,
                      }),
                    )
                  }
                  disciplineName={disciplineName}
                  onOpen={(day, session) =>
                    setOpen({
                      weekId: week.id,
                      day,
                      session,
                      label: `Vecka ${week.position} · ${phase.name}`,
                    })
                  }
                  onCopy={() => run(() => copyWeek(week.id))}
                  onDelete={() => {
                    if (
                      !confirm(`Ta bort vecka ${week.position} med alla pass?`)
                    )
                      return;
                    run(() => deleteWeek({ versionId, weekId: week.id }));
                  }}
                  onSave={(patch) =>
                    run(() =>
                      saveWeek({
                        weekId: week.id,
                        kind: patch.kind ?? week.kind,
                        title: patch.title ?? week.title ?? "",
                        note: week.note ?? "",
                        checkpoint: patch.checkpoint ?? week.checkpoint,
                      }),
                    )
                  }
                />
              ))}
            </div>
          </section>
        );
      })}

      {open && (
        <SessionDialog
          key={`${open.weekId}-${open.session?.id ?? open.day}`}
          open
          onClose={() => setOpen(null)}
          versionId={versionId}
          weekLabel={open.label}
          session={open.session}
          weekId={open.weekId}
          day={open.day}
          levels={levels}
          disciplines={disciplines}
          defaultDiscipline={defaultDiscipline}
          library={library}
        />
      )}
    </div>
  );
}

function WeekBlock({
  week,
  editable,
  pending,
  sessions,
  levels,
  volumes,
  volumeUnit,
  onSaveVolumes,
  disciplineName,
  onOpen,
  onCopy,
  onDelete,
  onSave,
}: {
  week: WeekRow;
  editable: boolean;
  pending: boolean;
  sessions: TemplateSession[];
  levels: { id: string; key: string }[];
  volumes: WeekVolume[];
  volumeUnit: VolumeUnit;
  onSaveVolumes: (
    volumes: { levelId: string; min: number | null; max: number | null }[],
  ) => void;
  disciplineName: (key: string) => string;
  onOpen: (day: number | null, session: TemplateSession | null) => void;
  onCopy: () => void;
  onDelete: () => void;
  onSave: (patch: {
    kind?: WeekKind;
    title?: string;
    checkpoint?: boolean;
  }) => void;
}) {
  const [title, setTitle] = useState(week.title ?? "");
  // Rutan svarar direkt; servern får värdet i bakgrunden.
  const [checkpoint, setCheckpoint] = useState(week.checkpoint);
  const columns: (number | null)[] = [0, 1, 2, 3, 4, 5, 6, null];

  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <span className="text-[13px] font-semibold text-text tabular-nums">
          Vecka {week.position}
        </span>
        <div className="w-40 shrink-0">
          <Select
            aria-label="Veckans typ"
            disabled={!editable || pending}
            value={week.kind}
            onChange={(e) => onSave({ kind: e.target.value as WeekKind })}
            className="h-8 py-1 text-[13px]"
          >
            {WEEK_KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0 flex-1 basis-48">
          <Input
            aria-label="Veckans rubrik"
            disabled={!editable}
            value={title}
            placeholder="Rubrik, till exempel Volymvecka"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== (week.title ?? "") && onSave({ title })}
            className="h-8 py-1 text-[13px]"
          />
        </div>
        <label
          className="flex shrink-0 items-center gap-1.5 text-[13px] text-text-muted"
          title="I slutet av veckan ses formuppskattningen över, och tempona följer med."
        >
          <input
            type="checkbox"
            className="size-4 accent-[var(--accent)]"
            disabled={!editable || pending}
            checked={checkpoint}
            onChange={(e) => {
              setCheckpoint(e.target.checked);
              onSave({ checkpoint: e.target.checked });
            }}
          />
          <Flag aria-hidden className="size-3.5" />
          Avstämning
        </label>
        {editable && (
          <span className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={onCopy}
              aria-label={`Kopiera vecka ${week.position}`}
            >
              <Copy aria-hidden className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={onDelete}
              aria-label={`Ta bort vecka ${week.position}`}
            >
              <Trash2 aria-hidden className="size-4" />
            </Button>
          </span>
        )}
      </div>
      {levels.length > 0 && (
        <VolumeStrip
          key={volumes.map((v) => `${v.levelId}:${v.min}:${v.max}`).join("|")}
          week={week.position}
          levels={levels}
          volumes={volumes}
          unit={volumeUnit}
          editable={editable}
          pending={pending}
          onSave={onSaveVolumes}
        />
      )}
      <div className="overflow-x-auto">
        <div className="grid min-w-[56rem] grid-cols-8 divide-x divide-line">
          {columns.map((day) => {
            const own = sessions.filter((s) => s.day === day);
            return (
              <div key={day ?? "valfri"} className="min-h-24 space-y-1.5 p-2">
                <p className="text-[11px] font-medium text-text-subtle">
                  {day === null
                    ? "Valfri dag"
                    : `${DAY_SHORT[day]} · dag ${day + 1}`}
                </p>
                {own.map((s) => {
                  const top = levels.find((l) =>
                    s.variants.some((v) => v.levelId === l.id),
                  );
                  const variant = s.variants.find((v) => v.levelId === top?.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onOpen(day, s)}
                      className="block w-full rounded-md border border-line bg-surface-2 p-2 text-left transition-colors hover:border-text-subtle"
                    >
                      {variant && (
                        <SessionCard
                          session={s}
                          variant={variant}
                          disciplineName={disciplineName(s.discipline)}
                        />
                      )}
                      <span className="mt-1 block text-[11px] text-text-subtle">
                        {levels
                          .filter((l) =>
                            s.variants.some((v) => v.levelId === l.id),
                          )
                          .map((l) => l.key)
                          .join(" ")}
                      </span>
                    </button>
                  );
                })}
                {editable && (
                  <button
                    type="button"
                    onClick={() => onOpen(day, null)}
                    aria-label={`Nytt pass ${day === null ? "valfri dag" : DAY_SHORT[day]}, vecka ${week.position}`}
                    className="flex w-full items-center justify-center rounded-md border border-dashed border-line py-1.5 text-text-subtle transition-colors hover:border-text-subtle hover:text-text"
                  >
                    <Plus aria-hidden className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type VolumeDraft = Record<string, { min: string; max: string }>;

const draftOf = (levels: { id: string }[], volumes: WeekVolume[]) =>
  Object.fromEntries(
    levels.map((l) => {
      const v = volumes.find((x) => x.levelId === l.id);
      return [
        l.id,
        {
          min: v ? String(v.min) : "",
          max: v?.max != null ? String(v.max) : "",
        },
      ];
    }),
  ) as VolumeDraft;

const toNumber = (text: string) => {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** Veckans volym per nivå: ett tal eller ett spann, sparas när fältet lämnas. */
function VolumeStrip({
  week,
  levels,
  volumes,
  unit,
  editable,
  pending,
  onSave,
}: {
  week: number;
  levels: { id: string; key: string }[];
  volumes: WeekVolume[];
  unit: VolumeUnit;
  editable: boolean;
  pending: boolean;
  onSave: (
    volumes: { levelId: string; min: number | null; max: number | null }[],
  ) => void;
}) {
  const [draft, setDraft] = useState(() => draftOf(levels, volumes));
  const initial = draftOf(levels, volumes);
  const save = () => {
    const changed = levels.some(
      (l) =>
        draft[l.id].min !== initial[l.id].min ||
        draft[l.id].max !== initial[l.id].max,
    );
    if (!changed) return;
    onSave(
      levels.map((l) => ({
        levelId: l.id,
        min: toNumber(draft[l.id].min),
        max: toNumber(draft[l.id].max),
      })),
    );
  };
  const field =
    "h-7 w-14 rounded-md border border-line bg-surface-2 px-1.5 text-right text-[13px] tabular-nums text-text focus:border-text-subtle focus:outline-none disabled:opacity-60";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-3 py-2 text-[13px]">
      <span className="text-text-muted">Volym</span>
      {levels.map((l) => (
        <span key={l.id} className="flex items-center gap-1">
          <span className="w-4 font-medium text-text">{l.key}</span>
          <input
            aria-label={`Volym nivå ${l.key}, vecka ${week}`}
            inputMode="decimal"
            disabled={!editable || pending}
            className={field}
            value={draft[l.id].min}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                [l.id]: { ...d[l.id], min: e.target.value },
              }))
            }
            onBlur={save}
          />
          <span aria-hidden className="text-text-subtle">
            –
          </span>
          <input
            aria-label={`Volym nivå ${l.key}, vecka ${week}, övre`}
            inputMode="decimal"
            disabled={!editable || pending}
            placeholder="–"
            className={field}
            value={draft[l.id].max}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                [l.id]: { ...d[l.id], max: e.target.value },
              }))
            }
            onBlur={save}
          />
          <span className="text-text-subtle">{unit}</span>
        </span>
      ))}
    </div>
  );
}
