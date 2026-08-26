import type { ReactNode } from "react";

export type ResultItem = {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
};

/** Nyckeltalen överst i varje kalkyl. */
export function ResultGrid({ items }: { items: ResultItem[] }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-line bg-surface p-5"
        >
          <dt className="text-[12px] font-medium uppercase tracking-[0.1em] text-text-muted">
            {item.label}
          </dt>
          <dd className="mt-2 text-2xl font-semibold tracking-tight text-text tabular-nums">
            {item.value}
            {item.unit && (
              <span className="ml-1.5 text-sm font-normal text-text-muted">
                {item.unit}
              </span>
            )}
          </dd>
          {item.hint && (
            <p className="mt-1 text-[12px] text-text-subtle">{item.hint}</p>
          )}
        </div>
      ))}
    </dl>
  );
}

/** Enkel datatabell för zoner och prognoser. */
export function DataTable({
  headers,
  rows,
  minWidth = 640,
}: {
  headers: string[];
  rows: ReactNode[][];
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table
        className="w-full border-collapse text-sm"
        style={{ minWidth: `${minWidth}px` }}
      >
        <thead>
          <tr className="border-b border-line bg-surface text-left">
            {headers.map((header, i) => (
              <th
                key={header}
                className={`px-4 py-3 font-medium text-text-muted ${i > 0 ? "text-right" : ""}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-line last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`px-4 py-3 ${
                    cellIndex === 0
                      ? "font-medium text-text"
                      : "text-right text-text-muted tabular-nums"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
