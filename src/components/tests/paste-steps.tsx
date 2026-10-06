"use client";

import { useId, useState } from "react";
import { ClipboardPaste } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import {
  parsePasted,
  ROLE_LABELS,
  toSteps,
  type ColumnRole,
  type PastedStep,
  type PastedTable,
} from "@/lib/tests/paste-steps";

const ROLES = Object.keys(ROLE_LABELS) as ColumnRole[];

/**
 * Klistra in stegen ur ett kalkylark. Kolumnerna gissas och visas, och kan
 * ändras innan tabellen fylls i – inget skrivs över förrän coachen bekräftar.
 */
export function PasteSteps({
  onApply,
}: {
  onApply: (steps: PastedStep[]) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [table, setTable] = useState<PastedTable | null>(null);

  const read = (value: string) => {
    setText(value);
    setTable(parsePasted(value));
  };
  const steps = table ? toSteps(table) : [];

  if (!open) {
    return (
      <div className="mb-3 print:hidden">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <ClipboardPaste aria-hidden className="size-3.5" />
          Klistra in ur Excel
        </Button>
      </div>
    );
  }

  return (
    <div className="enter mb-4 rounded-lg border border-line-strong bg-surface-2 p-4 print:hidden">
      <label htmlFor={id} className="text-[13px] font-medium text-text">
        Klistra in stegen
      </label>
      <p className="mt-0.5 text-[12px] text-text-subtle">
        Markera raderna i kalkylarket – gärna med rubrikraden – kopiera och
        klistra in här. En rad som heter ”vila” blir vilovärdet.
      </p>
      <textarea
        id={id}
        rows={4}
        value={text}
        onChange={(e) => read(e.target.value)}
        placeholder={"Watt\tPuls\tLaktat\n150\t128\t1,4\n180\t139\t1,9"}
        className="mt-2 w-full resize-y rounded-md border border-line-control bg-surface px-3 py-2 font-mono text-[12px] text-text"
      />

      {table && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-[13px] tabular-nums">
            <thead>
              <tr>
                {table.roles.map((role, i) => (
                  <th key={i} className="pb-2 pr-2 text-left font-normal">
                    <Select
                      aria-label={`Kolumn ${i + 1}${table.header?.[i] ? ` (${table.header[i]})` : ""}`}
                      value={role}
                      onChange={(e) =>
                        setTable({
                          ...table,
                          roles: table.roles.map((r, j) =>
                            j === i ? (e.target.value as ColumnRole) : r,
                          ),
                        })
                      }
                      className="h-8 min-w-[7.5rem] text-[12px]"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </Select>
                    {table.header?.[i] && (
                      <span className="mt-1 block truncate text-[11px] text-text-subtle">
                        {table.header[i]}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.slice(0, 6).map((row, r) => (
                <tr key={r} className="border-t border-line">
                  {table.roles.map((role, i) => (
                    <td
                      key={i}
                      className={
                        role === "ignore"
                          ? "py-1.5 pr-2 text-text-subtle"
                          : "py-1.5 pr-2 text-text"
                      }
                    >
                      {row[i] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {table.rows.length > 6 && (
            <p className="mt-1 text-[12px] text-text-subtle">
              … och {table.rows.length - 6} rader till.
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={steps.length === 0 || !table?.roles.includes("intensity")}
          onClick={() => {
            onApply(steps);
            setOpen(false);
            setText("");
            setTable(null);
          }}
        >
          {steps.length > 0
            ? `Fyll i ${steps.length} ${steps.length === 1 ? "rad" : "rader"}`
            : "Fyll i"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Avbryt
        </Button>
        {table && !table.roles.includes("intensity") && (
          <span className="text-[12px] text-text-subtle">
            Välj vilken kolumn som är belastningen.
          </span>
        )}
      </div>
    </div>
  );
}
