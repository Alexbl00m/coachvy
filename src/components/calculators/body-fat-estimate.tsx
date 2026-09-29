"use client";

import { useId, useState } from "react";

import {
  BMI_FAT_ERROR,
  bmi,
  bodyFatFromBmi,
  fatFreeMass,
  type Sex,
} from "@/lib/calculators/body-composition";
import { Input } from "@/components/ui/field";

const decimal = (raw: string) => Number(raw.replace(",", "."));
const sv = (v: number, digits = 1) => v.toFixed(digits).replace(".", ",");

/**
 * Uppskatta kroppsfettet ur BMI när det inte är mätt. Hopfälld från början:
 * ett mätt värde – kalipper, bioimpedans, DXA – är alltid bättre, och det ska
 * inte se ut som att BMI är lika bra.
 */
export function BodyFatEstimate({
  weightKg,
  sex,
  onUse,
}: {
  weightKg: number;
  sex: Sex;
  onUse: (pct: number) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");

  const pct = bodyFatFromBmi(weightKg, decimal(height), decimal(age), sex);
  const b = bmi(weightKg, decimal(height));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[12px] text-accent underline-offset-2 hover:underline"
      >
        Inget mätt värde? Uppskatta ur BMI
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-line bg-surface-2/60 p-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-[12px] text-text-muted" htmlFor={`${id}-h`}>
          <span>Längd (cm)</span>
          <Input
            id={`${id}-h`}
            inputMode="decimal"
            value={height}
            placeholder="180"
            onChange={(e) => setHeight(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-[12px] text-text-muted" htmlFor={`${id}-a`}>
          <span>Ålder (år)</span>
          <Input
            id={`${id}-a`}
            inputMode="decimal"
            value={age}
            placeholder="35"
            onChange={(e) => setAge(e.target.value)}
          />
        </label>
      </div>

      {pct !== null && b !== null ? (
        <div className="space-y-2 text-[13px] text-text-muted">
          <p>
            BMI {sv(b)} ger ungefär{" "}
            <span className="font-medium text-text tabular-nums">
              {sv(pct)} % kroppsfett
            </span>{" "}
            och en fettfri massa på{" "}
            <span className="font-medium text-text tabular-nums">
              {sv(fatFreeMass(weightKg, pct))} kg
            </span>
            . Med formelns osäkerhet, ±{BMI_FAT_ERROR} procentenheter, ligger den
            fettfria massan någonstans mellan{" "}
            {sv(fatFreeMass(weightKg, pct + BMI_FAT_ERROR))} och{" "}
            {sv(fatFreeMass(weightKg, Math.max(pct - BMI_FAT_ERROR, 3)))} kg.
          </p>
          <p className="text-[12px] text-text-subtle">
            BMI skiljer inte muskler från fett. För en tränad atlet blir
            kroppsfettet oftast för högt – ett mätt värde är alltid bättre.
          </p>
          <button
            type="button"
            onClick={() => {
              onUse(Math.round(pct * 10) / 10);
              setOpen(false);
            }}
            className="rounded-md border border-line-strong px-3 py-1.5 text-[13px] text-text transition-colors hover:border-accent"
          >
            Använd {sv(pct)} %
          </button>
        </div>
      ) : (
        <p className="text-[12px] text-text-subtle">
          Fyll i längd och ålder. Vikten och könet tas från formuläret.
        </p>
      )}
    </div>
  );
}
