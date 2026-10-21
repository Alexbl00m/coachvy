"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, Input, Textarea } from "@/components/ui/field";
import { saveStrengthSession } from "@/lib/strength/actions";
import {
  EXERCISES,
  parseStrengthText,
  type StrengthEntry,
  type StrengthSession,
} from "@/lib/strength/strength";

/** En rad i formuläret: talen som text, så att ett tomt fält får vara tomt. */
type Row = {
  id: number;
  name: string;
  sets: string;
  reps: string;
  weightKg: string;
  perSide: boolean;
};

const text = (value: number | null) =>
  value === null ? "" : String(value).replace(".", ",");
const number = (raw: string): number | null => {
  const value = Number(raw.replace(",", ".").trim());
  return raw.trim() && Number.isFinite(value) ? value : null;
};

let nextId = 1;
const toRow = (e: StrengthEntry): Row => ({
  id: nextId++,
  name: e.name,
  sets: text(e.sets),
  reps: text(e.reps),
  weightKg: text(e.weightKg),
  perSide: e.perSide,
});
const emptyRow = (): Row => ({
  id: nextId++,
  name: "",
  sets: "",
  reps: "",
  weightKg: "",
  perSide: false,
});

/**
 * Loggar ett styrkepass. Snabbast är att skriva som i en kommentar – "FB 4x8
 * 50 kg, RM 4x8 70 kg" – och låta raden tolkas; övningarna hamnar i listan
 * och går att rätta innan passet sparas.
 */
export function StrengthLogForm({
  adeptId,
  today,
  editing,
  previous,
  basePath,
}: {
  adeptId: string;
  /** Sidan formuläret ligger på, dit en ändring går tillbaka. */
  basePath: string;
  today: string;
  /** Passet som ändras, eller null för ett nytt. */
  editing: StrengthSession | null;
  /** Det senaste passet, för "Som förra gången". */
  previous: StrengthSession | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [date, setDate] = useState(editing?.performed_on ?? today);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [quick, setQuick] = useState("");
  const [rows, setRows] = useState<Row[]>(
    editing ? editing.exercises.map(toRow) : [],
  );
  const [rpe, setRpe] = useState(text(editing?.session_rpe ?? null));
  const [note, setNote] = useState(editing?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const parsed = quick.trim() ? parseStrengthText(quick) : [];

  const patch = (id: number, change: Partial<Row>) =>
    setRows((current) =>
      current.map((r) => (r.id === id ? { ...r, ...change } : r)),
    );

  const addParsed = () => {
    if (parsed.length === 0) return;
    setRows((current) => [
      ...current.filter((r) => r.name.trim()),
      ...parsed.map(toRow),
    ]);
    setQuick("");
  };

  const copyPrevious = () => {
    if (!previous) return;
    setRows(previous.exercises.map(toRow));
    if (!title && previous.title) setTitle(previous.title);
  };

  const save = () =>
    start(async () => {
      setError(null);
      setDone(null);
      // Står det något kvar i snabbfältet följer det med.
      const all = [
        ...rows,
        ...(parsed.length > 0 ? parsed.map(toRow) : []),
      ].filter((r) => r.name.trim());
      const result = await saveStrengthSession({
        id: editing?.id ?? null,
        adeptId,
        performedOn: date,
        title,
        exercises: all.map((r) => ({
          name: r.name,
          sets: number(r.sets),
          reps: number(r.reps),
          weightKg: number(r.weightKg),
          perSide: r.perSide,
        })),
        note,
        sessionRpe: number(rpe),
      });
      if (!result.ok) return setError(result.error);
      if (editing) {
        router.push(basePath);
        router.refresh();
        return;
      }
      setRows([]);
      setQuick("");
      setNote("");
      setRpe("");
      setDone("Sparat.");
      router.refresh();
    });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Datum" htmlFor="styrka-datum">
          <DatePicker id="styrka-datum" value={date} onChange={setDate} />
        </Field>
        <Field label="Pass" htmlFor="styrka-titel" optional>
          <Input
            id="styrka-titel"
            value={title}
            maxLength={80}
            placeholder="Styrkepass A"
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="styrka-snabb"
          className="text-[13px] font-medium text-text"
        >
          Skriv som du brukar
        </label>
        <Textarea
          id="styrka-snabb"
          rows={2}
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              addParsed();
            }
          }}
          placeholder="FB 4x8 50 kg, RM 4x8 70 kg, BS 5x5 45 kg. Lats, armhävningar och dead bug"
        />
        {parsed.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12px] text-text-muted">
              Blir:{" "}
              {parsed
                .map(
                  (e) =>
                    `${e.name}${e.sets && e.reps ? ` ${e.sets}×${e.reps}${e.perSide ? "/ben" : ""}` : ""}${e.weightKg ? ` ${text(e.weightKg)} kg` : ""}`,
                )
                .join(" · ")}
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={addParsed}
            >
              Lägg till i listan
            </Button>
          </div>
        )}
        {!editing && previous && rows.length === 0 && !quick && (
          <button
            type="button"
            onClick={copyPrevious}
            className="text-[13px] font-medium text-accent-text underline-offset-2 hover:underline"
          >
            Som förra gången{previous.title ? ` (${previous.title})` : ""}
          </button>
        )}
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-text-muted">
                <th className="pb-1.5 pr-2 font-medium">Övning</th>
                <th className="pb-1.5 pr-2 font-medium">Set</th>
                <th className="pb-1.5 pr-2 font-medium">Reps</th>
                <th className="pb-1.5 pr-2 font-medium">Per ben</th>
                <th className="pb-1.5 pr-2 font-medium">Kg</th>
                <th className="pb-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.id}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="py-1.5 pr-2">
                    <Input
                      aria-label={`Övning ${i + 1}`}
                      list="styrka-ovningar"
                      value={row.name}
                      onChange={(e) => patch(row.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="w-16 py-1.5 pr-2">
                    <Input
                      aria-label={`Set ${i + 1}`}
                      inputMode="numeric"
                      value={row.sets}
                      onChange={(e) => patch(row.id, { sets: e.target.value })}
                    />
                  </td>
                  <td className="w-16 py-1.5 pr-2">
                    <Input
                      aria-label={`Reps ${i + 1}`}
                      inputMode="numeric"
                      value={row.reps}
                      onChange={(e) => patch(row.id, { reps: e.target.value })}
                    />
                  </td>
                  <td className="w-16 py-1.5 pr-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`Per ben ${i + 1}`}
                      checked={row.perSide}
                      onChange={(e) =>
                        patch(row.id, { perSide: e.target.checked })
                      }
                      className="size-4 accent-[var(--accent)]"
                    />
                  </td>
                  <td className="w-20 py-1.5 pr-2">
                    <Input
                      aria-label={`Kg ${i + 1}`}
                      inputMode="decimal"
                      value={row.weightKg}
                      onChange={(e) =>
                        patch(row.id, { weightKg: e.target.value })
                      }
                    />
                  </td>
                  <td className="py-1.5">
                    <button
                      type="button"
                      aria-label={`Ta bort ${row.name || `rad ${i + 1}`}`}
                      onClick={() =>
                        setRows((current) =>
                          current.filter((r) => r.id !== row.id),
                        )
                      }
                      className="rounded-md p-1.5 text-text-subtle transition-colors hover:text-accent"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="styrka-ovningar">
            {EXERCISES.map((e) => (
              <option key={e.key} value={e.name} />
            ))}
          </datalist>
        </div>
      )}

      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setRows((current) => [...current, emptyRow()])}
      >
        <Plus aria-hidden className="size-4" />
        Lägg till övning
      </Button>

      <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <Field label="RPE för passet" htmlFor="styrka-rpe" optional>
          <Input
            id="styrka-rpe"
            inputMode="decimal"
            placeholder="0–10"
            value={rpe}
            onChange={(e) => setRpe(e.target.value)}
          />
        </Field>
        <Field label="Kommentar" htmlFor="styrka-kommentar" optional>
          <Input
            id="styrka-kommentar"
            value={note}
            maxLength={1000}
            placeholder="Hur kändes det?"
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>

      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-sm text-good">
          {done}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          className="font-semibold"
          disabled={
            pending ||
            (rows.every((r) => !r.name.trim()) && parsed.length === 0)
          }
        >
          {pending ? "Sparar…" : editing ? "Spara ändringen" : "Spara passet"}
        </Button>
        {editing && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(basePath)}
          >
            Avbryt
          </Button>
        )}
      </div>
    </form>
  );
}
