import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { ChangeRow } from "@/lib/tests/since-last";

const sv = (value: number, digits = 0) =>
  value.toFixed(digits).replace(".", ",");

const DIGITS: Record<string, number> = { VO2max: 1, VLamax: 2 };

/** VLamax är varken bättre eller sämre i sig: det beror på tävlingen. */
const NEUTRAL = new Set(["VLamax"]);

function Scale({ row }: { row: ChangeRow }) {
  const pad = Math.max(row.spread ?? 0, Math.abs(row.delta) * 0.25) * 2.5 || 1;
  const lo = Math.min(row.now, row.previous) - pad;
  const hi = Math.max(row.now, row.previous) + pad;
  const at = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div aria-hidden className="relative my-2 h-4">
      <div className="absolute inset-x-0 top-1 h-2 rounded bg-surface-2" />
      {row.spread !== null && (
        <div
          className="absolute top-1 h-2 bg-accent-soft"
          style={{ left: at(row.now - row.spread), width: at(lo + 2 * row.spread) }}
        />
      )}
      <div
        className="absolute top-0.5 size-3 -translate-x-1/2 rounded-full border-2 border-text-subtle bg-surface"
        style={{ left: at(row.previous) }}
      />
      <div
        className="absolute top-0 size-4 -translate-x-1/2 rounded-full border-2 border-surface bg-accent"
        style={{ left: at(row.now) }}
      />
    </div>
  );
}

function Verdict({ row }: { row: ChangeRow }) {
  const digits = DIGITS[row.key] ?? 0;
  if (row.changed === false) {
    return (
      <span className="flex items-center gap-1.5 text-text-muted">
        <Minus aria-hidden className="size-4" />
        Oförändrad, inom mätfelet
      </span>
    );
  }
  const up = row.delta > 0;
  const tone = NEUTRAL.has(row.key) ? "text-text-muted" : up ? "text-good" : "text-bad";
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={cn("flex items-center gap-1.5", tone)}>
      <Icon aria-hidden className="size-4" />
      {up ? "Upp" : "Ned"} {sv(Math.abs(row.delta), digits)} {row.unit}
    </span>
  );
}

/**
 * Nyckeltalen mot adeptens förra metabola profil, på en skala per tal: förra
 * testet som ring, det nya som punkt och mätfelet som ett fält runt punkten.
 */
export function SinceLastTest({
  rows,
  previousDate,
}: {
  rows: ChangeRow[];
  previousDate: string;
}) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardTitle>Sedan förra testet</CardTitle>
      <p className="-mt-3 mb-4 text-[0.8125rem] text-text-subtle">
        Jämfört med {formatDate(previousDate)}. En skillnad som är mindre än
        mätfelet i de två testen visas som oförändrad.
      </p>
      <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {rows.map((row) => {
          const digits = DIGITS[row.key] ?? 0;
          return (
            <li key={row.key}>
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <span className="text-text-muted">{row.label}</span>
                <span className="font-semibold tabular-nums text-text">
                  {sv(row.now, digits)} {row.unit}
                </span>
              </div>
              <Scale row={row} />
              <div className="flex items-baseline justify-between gap-4 text-[0.8125rem]">
                <Verdict row={row} />
                <span className="tabular-nums text-text-subtle">
                  förra {sv(row.previous, digits)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
