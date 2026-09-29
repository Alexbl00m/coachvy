"use client";

import { useState, useSyncExternalStore } from "react";

import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { displayValue } from "@/lib/tests/pace";
import type {
  UtilisationRange,
  UtilisationRow,
  UtilisationSummary,
} from "@/lib/tests/progression";
import { protocolByKey } from "@/lib/tests/protocols";
import { UTILISATION_RANGES } from "@/lib/tests/vo2max";

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

/** Skalan raderna ritas på: 40–100 %. Under 40 är ingen tröskel. */
const SCALE = { from: 40, to: 100 };
const at = (pct: number) =>
  `${Math.min(Math.max(((pct - SCALE.from) / (SCALE.to - SCALE.from)) * 100, 0), 100)}%`;

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) =>
  Math.round(Math.abs(Date.parse(a) - Date.parse(b)) / DAY);

/** Vilka markörer som är avslagna, per webbläsare. */
const STORAGE_KEY = "coachvy:utnyttjande-dolda";
const readHidden = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};
const noSubscription = () => () => {};

function Track({
  pct,
  range,
}: {
  pct: number;
  range: UtilisationRange | null;
}) {
  return (
    <div className="relative h-5" aria-hidden>
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-strong" />
      {range && (
        <span
          className="absolute inset-y-1 rounded-[3px] bg-accent-soft"
          style={{
            left: at(range.from),
            width: `calc(${at(range.to)} - ${at(range.from)})`,
          }}
        />
      )}
      <span
        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-surface"
        style={{ left: at(pct) }}
      />
    </div>
  );
}

function Row({
  label,
  detail,
  pct,
  range,
}: {
  label: string;
  detail: string;
  pct: number;
  range: UtilisationRange | null;
}) {
  const state = !range
    ? null
    : pct < range.from
      ? "under"
      : pct > range.to
        ? "över"
        : "inom";

  return (
    <li className="grid gap-2 py-3 sm:grid-cols-[220px_minmax(0,1fr)_auto] sm:items-center sm:gap-5">
      <div>
        <p className="text-sm font-medium text-text">{label}</p>
        <p className="text-[12px] text-text-subtle tabular-nums">{detail}</p>
      </div>
      <Track pct={pct} range={range} />
      <div className="flex items-center gap-2 sm:justify-end">
        <span className="text-lg font-semibold text-text tabular-nums">
          {sv(pct, 0)} %
        </span>
        {state && (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[11px] font-medium",
              state === "inom"
                ? "bg-surface-2 text-good"
                : "bg-surface-2 text-text-muted",
            )}
            title={
              range
                ? `Referens ${range.from}–${range.to} %${range.note ? ` (${range.note})` : ""}`
                : undefined
            }
          >
            {state === "inom"
              ? "inom spannet"
              : state === "under"
                ? "under spannet"
                : "över spannet"}
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * Alla trösklar på en och samma skala, 40–100 % av VO2max. Stegen mellan
 * dem är vad raderna nedanför säger en i taget – här syns de på en gång.
 */
function Ladder({ rows }: { rows: UtilisationRow[] }) {
  return (
    <div className="mb-5">
      <div className="relative h-16">
        <span className="absolute inset-x-0 top-8 h-1.5 rounded-full bg-surface-2" />
        {/* Referensbanden för aerob och anaerob tröskel, svagt. */}
        {[UTILISATION_RANGES.LT1, UTILISATION_RANGES.LT2].map((r) => (
          <span
            key={r.from}
            className="absolute top-8 h-1.5 rounded-full bg-accent-soft"
            style={{
              left: at(r.from),
              width: `calc(${at(r.to)} - ${at(r.from)})`,
            }}
          />
        ))}
        {rows.map((row, i) => (
          <div
            key={row.key}
            className="absolute flex -translate-x-1/2 flex-col items-center"
            style={{ left: at(row.pct), top: i % 2 === 0 ? 0 : 38 }}
          >
            {i % 2 === 0 && (
              <span className="whitespace-nowrap text-[11px] text-text-muted">
                {row.key === "I_4mmol"
                  ? "4 mmol"
                  : row.key.replace("_speed", "")}
              </span>
            )}
            <span
              className={cn(
                "size-3 rounded-full bg-accent ring-2 ring-surface",
                i % 2 === 0 ? "mt-2" : "-mt-[6px]",
              )}
            />
            {i % 2 === 1 && (
              <span className="mt-0.5 whitespace-nowrap text-[11px] text-text-muted">
                {row.key === "I_4mmol"
                  ? "4 mmol"
                  : row.key.replace("_speed", "")}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-text-subtle tabular-nums">
        {[40, 50, 60, 70, 80, 90, 100].map((p) => (
          <span key={p}>{p} %</span>
        ))}
      </div>
    </div>
  );
}

/**
 * Hur stor del av VO2max trösklarna utnyttjar.
 *
 * Två atleter med samma VO2max kan ha trösklar på 65 och 85 % av det – och
 * det är den skillnaden, inte VO2max, som oftast avgör ett lopp. Olika tester
 * ger olika markörer, så alla tas med och varje coach väljer vilka som är
 * relevanta för adepten. Valet sparas i webbläsaren.
 */
export function UtilisationCard({ summary }: { summary: UtilisationSummary }) {
  const saved = useSyncExternalStore(noSubscription, readHidden, () => null);
  const [override, setOverride] = useState<string[] | null>(null);
  let stored: string[] = [];
  try {
    const parsed = JSON.parse(saved ?? "[]");
    if (Array.isArray(parsed))
      stored = parsed.filter((v) => typeof v === "string");
  } catch {
    // Trasigt värde: allt visas.
  }
  const hidden = new Set(override ?? stored);
  const toggle = (key: string) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    // Minst en markör kvar – ett tomt kort säger ingenting.
    if (next.size >= summary.rows.length) return;
    const list = [...next];
    setOverride(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // Går det inte att spara gäller valet bara nu.
    }
  };

  const { vo2max } = summary;
  const shown = summary.rows.filter((r) => !hidden.has(r.key));
  const unitDigits = (unit: string) => (unit === "W" ? 0 : 1);
  const newest = summary.rows.reduce((a, b) =>
    a.performedOn > b.performedOn ? a : b,
  );
  const borrowed = daysBetween(vo2max.performedOn, newest.performedOn);

  return (
    <Card className="min-w-0">
      <CardTitle>Utnyttjandegrad av VO2max</CardTitle>

      <p className="mb-3 text-sm text-text-muted">
        Räknat mot VO2max{" "}
        <span className="font-medium text-text tabular-nums">
          {sv(vo2max.value, 1)} ml/kg/min
        </span>
        {" – "}
        {vo2max.measured ? "uppmätt" : `skattat, ${vo2max.method}`},{" "}
        {formatDate(vo2max.performedOn)}
        {borrowed > 0 && ` (${borrowed} dagar från det senaste testet)`}.
        Markörer från äldre tester räknas mot det VO2max som låg närmast dem.
      </p>

      <div
        role="group"
        aria-label="Markörer"
        className="mb-5 flex flex-wrap gap-2"
      >
        {summary.rows.map((row) => {
          const on = !hidden.has(row.key);
          return (
            <button
              key={row.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(row.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-[12px] transition-colors",
                on
                  ? "border-accent bg-accent-soft text-text"
                  : "border-line text-text-subtle line-through hover:text-text-muted",
              )}
            >
              {row.label}
            </button>
          );
        })}
      </div>

      {shown.length > 1 && <Ladder rows={shown} />}

      <ul className="divide-y divide-line">
        {shown.map((row) => {
          const d = displayValue(
            row.intensity,
            row.unit,
            summary.sport,
            unitDigits(row.unit),
          );
          const own =
            row.vo2max.sessionId !== vo2max.sessionId
              ? ` · mot VO2max ${sv(row.vo2max.value, 1)}`
              : "";
          return (
            <Row
              key={row.key}
              label={row.label}
              detail={`${d.value} ${d.unit} · ${protocolByKey(row.protocol)?.label ?? row.protocol} ${formatDate(row.performedOn)}${own}`}
              pct={row.pct}
              range={row.range}
            />
          );
        })}
        {summary.lt1OfLt2 !== null &&
          !hidden.has("LT1") &&
          !hidden.has("LT2") && (
            <Row
              label="LT1 i % av LT2"
              detail="samma laktattest"
              pct={summary.lt1OfLt2}
              range={UTILISATION_RANGES.LT1_of_LT2[summary.sport]}
            />
          )}
      </ul>

      <p className="mt-3 text-[12px] leading-relaxed text-text-subtle">
        Syreupptaget vid varje tröskel räknas med ACSM:s ekvation och delas med
        VO2max. Banden är referensspann: FatMax 50–70 %, LT1 65–75 %, och LT2
        75–90 % – som också gäller anaerob tröskel, FTP, 4 mmol och CP, som alla
        mäter ungefär samma gräns på olika sätt. Ett skattat VO2max har ett fel
        på runt ±5 %, och det slår igenom på procenten.
      </p>
    </Card>
  );
}
