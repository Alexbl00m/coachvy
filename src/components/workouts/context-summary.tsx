"use client";

import type { AthleteContext } from "@/lib/workouts/context";
import { formatPace } from "@/lib/workouts/schema";

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

/**
 * Vad ett svar vilar på, i klartext.
 *
 * Både passbyggaren och AI-coachen räknar på samma underlag, och coachen ska
 * kunna se exakt vad som går med – att skadan i profilen och veckans
 * belastning faktiskt följer med, inte behöva lita på att de gör det.
 */
export function ContextSummary({ context }: { context: AthleteContext }) {
  const cycling = context.sport === "cykling";

  return (
    <div className="border-t border-line pt-3 text-[12px] leading-relaxed text-text-subtle">
      {context.reference !== null && context.basis ? (
        <p className="text-text-muted">
          {context.basis}{" "}
          <span className="tabular-nums text-text">
            {cycling
              ? `${Math.round(context.reference)} W`
              : `${sv(context.reference, 2)} m/s · ${formatPace(context.reference, context.sport)}`}
          </span>
          {context.referenceSource && ` – ${context.referenceSource}`}
        </p>
      ) : (
        <p>Inget referensvärde ännu.</p>
      )}

      {context.balance && (
        <p className="mt-1 text-text-muted">
          {cycling
            ? `CP ${Math.round(context.balance.critical)} W · W′ ${sv(context.balance.reserve / 1000, 1)} kJ`
            : `CS ${sv(context.balance.critical, 2)} m/s · D′ ${Math.round(context.balance.reserve)} m`}
          {context.balanceSource && ` – ${context.balanceSource}`}
        </p>
      )}

      {/* Vad mer som följer med i prompten. Coachen ska kunna se att skadan
          och veckans belastning faktiskt går med, inte behöva lita på det. */}
      {(context.background || context.loadSummary) && (
        <details className="mt-2">
          <summary className="cursor-pointer text-text-muted hover:text-text">
            Går också med i prompten
          </summary>
          <div className="mt-1.5 space-y-1.5 whitespace-pre-line">
            {context.background && <p>{context.background}</p>}
            {context.loadSummary && <p>{context.loadSummary}</p>}
          </div>
        </details>
      )}

      {context.gaps.map((gap) => (
        <p key={gap} className="mt-1.5">
          {gap}
        </p>
      ))}
    </div>
  );
}
