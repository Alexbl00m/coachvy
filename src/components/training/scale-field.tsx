"use client";

import { cn } from "@/lib/cn";

/**
 * En skala som knappar i stället för ett reglage.
 *
 * Ett reglage ser modernt ut men är svårt att träffa exakt, går inte att läsa
 * av utan att titta på ett värde bredvid, och kräver ett extra bibliotek.
 * Knappar 1–5 eller 0–10 är precisa vid första trycket, fungerar med
 * tangentbord utan extra kod, och visar hela skalan samtidigt – vilket är
 * poängen när talen betyder något specifikt.
 *
 * Ändpunkterna skrivs ut under raden. Ett RPE utan förankring är bara en
 * siffra, och "5" betyder ingenting förrän det står att 10 är det hårdaste
 * atleten kan föreställa sig.
 */
export function ScaleField({
  label,
  value,
  onChange,
  min,
  max,
  lowLabel,
  highLabel,
  hint,
}: {
  label: string;
  value: number | null;
  onChange: (next: number) => void;
  min: number;
  max: number;
  /** Vad det lägsta talet betyder. */
  lowLabel: string;
  highLabel: string;
  hint?: string;
}) {
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <fieldset className="space-y-1.5">
      <legend className="flex w-full items-baseline justify-between text-[13px] font-medium text-text">
        <span>{label}</span>
        {value !== null && (
          <span className="text-[12px] font-normal text-text-muted tabular-nums">
            {value}
          </span>
        )}
      </legend>

      <div className="flex flex-wrap gap-1">
        {steps.map((step) => {
          const active = value === step;
          return (
            <button
              key={step}
              type="button"
              onClick={() => onChange(step)}
              aria-pressed={active}
              aria-label={`${label} ${step}`}
              className={cn(
                "h-8 min-w-8 flex-1 rounded-md border text-[13px] tabular-nums transition-colors",
                active
                  ? "border-accent bg-accent text-accent-on"
                  : "border-line-strong text-text-muted hover:border-accent/60 hover:text-text",
              )}
            >
              {step}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between text-[11px] text-text-subtle">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>

      {hint && <p className="text-[11px] text-text-subtle">{hint}</p>}
    </fieldset>
  );
}
