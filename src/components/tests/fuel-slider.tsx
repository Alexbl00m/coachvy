"use client";

import { useState } from "react";

import { Card, CardTitle } from "@/components/ui/card";
import {
  CARB_MAX_GRAMS_PER_HOUR,
  KCAL_PER_G_CARB,
  KCAL_PER_G_FAT,
  type MetabolicPoint,
} from "@/lib/calculators/metabolic";

const sv = (value: number) => Math.round(value).toLocaleString("sv-SE");

const STEP = 5;

/**
 * "Vad kräver passet?": adepten väljer en effekt och ser kolhydrater, fett och
 * energi per timme ur testets egen kurva.
 */
export function FuelSlider({
  points,
  atPower,
}: {
  points: MetabolicPoint[];
  atPower: number | null;
}) {
  const top = points[points.length - 1]?.power ?? 0;
  const max = Math.floor(Math.min(atPower ? atPower * 1.15 : top, top) / STEP) * STEP;
  const min = Math.min(100, max - 10 * STEP);
  const start = atPower ? Math.round((atPower * 0.7) / STEP) * STEP : Math.round(max / 2);
  const [watt, setWatt] = useState(Math.min(Math.max(start, min), max));
  if (points.length === 0 || max <= min) return null;

  const nearest = (power: number) =>
    points.reduce((best, q) =>
      Math.abs(q.power - power) < Math.abs(best.power - power) ? q : best,
    );
  const kcalOf = (q: MetabolicPoint) =>
    Math.round((q.carbsPerHour * KCAL_PER_G_CARB + q.fatPerHour * KCAL_PER_G_FAT) / 10) * 10;
  const overAt = atPower !== null && watt > atPower;
  // Över tröskeln räknar modellen också laktat som ansamlas, inte bara det som
  // förbränns, så talen blir för höga. Tröskelns värden är då ett golv.
  const p = overAt ? nearest(atPower) : nearest(watt);
  const over = overAt ? "över " : "";
  const note = overAt
    ? "Över tröskeln. Kolhydratförbrukningen stiger snabbt och farten håller inte länge."
    : p.carbsPerHour > CARB_MAX_GRAMS_PER_HOUR
      ? `Mer kolhydrater än du kan ta upp under passet, cirka ${CARB_MAX_GRAMS_PER_HOUR} g i timmen. Resten tas från glykogenet i musklerna.`
      : null;

  return (
    <Card>
      <CardTitle>Vad kräver passet?</CardTitle>
      <label className="block">
        <span className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-text-muted">Effekt</span>
          <span className="text-[1.75rem] font-semibold leading-none text-text">
            {watt} W
          </span>
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={STEP}
          value={watt}
          onChange={(e) => setWatt(Number(e.target.value))}
          className="mt-3 h-11 w-full accent-[var(--color-accent)]"
        />
      </label>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        {[
          ["Kolhydrater", `${over}${sv(p.carbsPerHour)} g`],
          ["Fett", overAt ? "0 g" : `${sv(p.fatPerHour)} g`],
          ["Energi", `${over}${sv(kcalOf(p))} kcal`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md bg-surface-2 px-3 py-2.5">
            <dt className="text-[0.75rem] text-text-muted">{label}</dt>
            <dd className="mt-0.5 text-[1.0625rem] font-semibold tabular-nums text-text">
              {value}
            </dd>
            <dd className="text-[0.6875rem] text-text-subtle">per timme</dd>
          </div>
        ))}
      </dl>
      {note && (
        <p role="status" className="mt-3 text-[0.8125rem] text-warn">
          {note}
        </p>
      )}
    </Card>
  );
}
