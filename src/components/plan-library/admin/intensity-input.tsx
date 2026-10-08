"use client";

import { Input } from "@/components/ui/field";

export type Intensity = { låg: number; medel: number; hög: number };

/** Intensitetsfördelningen i procent av tiden, tre fält. */
export function IntensityInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: Intensity;
  onChange: (next: Intensity) => void;
}) {
  const sum = value.låg + value.medel + value.hög;
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-[13px] font-medium text-text">
        Intensitet, % av tiden
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {(["låg", "medel", "hög"] as const).map((k) => (
          <label key={k} className="space-y-1 text-[11px] text-text-subtle">
            <span className="capitalize">{k}</span>
            <Input
              id={`${id}-${k}`}
              type="number"
              min={0}
              max={100}
              value={value[k] || ""}
              onChange={(e) =>
                onChange({ ...value, [k]: Number(e.target.value) })
              }
            />
          </label>
        ))}
      </div>
      {sum > 0 && sum !== 100 && (
        <p className="text-[11px] text-warn">Summan är {sum} %, inte 100.</p>
      )}
    </fieldset>
  );
}
