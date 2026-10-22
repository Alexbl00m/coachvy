import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { LsctAssessment, LsctResult, LsctSignal } from "@/lib/tests/lsct";

const sv = (value: number, digits = 0) =>
  value.toFixed(digits).replace(".", ",");

const VERDICT: Record<
  LsctAssessment["verdict"],
  { label: string; tone: string }
> = {
  baslinje: { label: "Baslinje", tone: "text-text-muted" },
  normal: { label: "Inom normen", tone: "text-good" },
  bevaka: { label: "Bevaka", tone: "text-warn" },
  vila: { label: "Lugnt före nästa kvalitetspass", tone: "text-bad" },
};

const STATE: Record<LsctSignal["state"], { label: string; tone: string }> = {
  normal: { label: "normal", tone: "text-text-muted" },
  warn: { label: "avviker", tone: "text-warn" },
  up: { label: "bättre", tone: "text-good" },
};

function signalValue(signal: LsctSignal): string {
  switch (signal.key) {
    case "effekt":
      return `${sv(signal.value)} W`;
    case "hrr":
      return `${sv(signal.value)} slag`;
    case "rpe":
      return sv(signal.value, 0);
    case "t90":
      return `${sv(signal.value)} s`;
  }
}

function normValue(signal: LsctSignal): string {
  if (signal.norm === null) return "–";
  switch (signal.key) {
    case "effekt":
      return `${sv(signal.norm)} W`;
    case "hrr":
      return `${sv(signal.norm)} slag`;
    case "rpe":
      return sv(signal.norm, 1);
    case "t90":
      return `${sv(signal.norm)} s`;
  }
}

/**
 * LSCT mot adeptens egen norm: varje signal för sig och en samlad bedömning.
 * Signalerna läses tillsammans – en ensam avvikelse ändrar sällan planen,
 * flera samtidigt talar för ett lugnt pass före nästa kvalitetspass.
 */
export function LsctCard({
  assessment,
  history,
}: {
  assessment: LsctAssessment;
  /** Adeptens LSCT, nyast först, det här inräknat. */
  history: LsctResult[];
}) {
  const verdict = VERDICT[assessment.verdict];
  return (
    <Card className="min-w-0">
      <CardTitle>Mot normen</CardTitle>

      <div className="mb-4">
        <p className={cn("text-lg font-semibold", verdict.tone)}>
          {verdict.label}
        </p>
        <p className="mt-1 max-w-prose text-sm text-text-muted">
          {assessment.summary}
        </p>
      </div>

      <ul className="divide-y divide-line">
        {assessment.signals.map((signal) => (
          <li
            key={signal.key}
            className="grid gap-1 py-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-4"
          >
            <p className="text-sm font-medium text-text">{signal.label}</p>
            <p className="text-[0.8125rem] text-text-muted">
              <span className="font-semibold text-text tabular-nums">
                {signalValue(signal)}
              </span>
              <span className="tabular-nums">
                {" "}
                · norm {normValue(signal)}
                {signal.change ? ` · ${signal.change}` : ""}
              </span>
              <span className="mt-0.5 block text-[0.75rem] text-text-subtle">
                {signal.text}
              </span>
            </p>
            <span
              className={cn(
                "w-fit rounded bg-surface-2 px-1.5 py-0.5 text-[0.6875rem] font-medium",
                STATE[signal.state].tone,
              )}
            >
              {STATE[signal.state].label}
            </span>
          </li>
        ))}
      </ul>

      {history.length > 1 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[26.25rem] border-collapse text-[0.8125rem]">
            <caption className="mb-2 text-left text-[0.75rem] font-medium text-text-muted">
              Senaste testen
            </caption>
            <thead>
              <tr className="border-b border-line text-left text-[0.75rem] text-text-muted">
                <th className="pb-1.5 pr-3 font-medium">Datum</th>
                <th className="pb-1.5 pr-3 font-medium">Effekt steg 3</th>
                <th className="pb-1.5 pr-3 font-medium">HRR</th>
                <th className="pb-1.5 pr-3 font-medium">RPE steg 2</th>
                <th className="pb-1.5 font-medium">Tid till 90 %</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {history.slice(0, 8).map((h) => (
                <tr
                  key={h.sessionId}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="py-1.5 pr-3 text-text-muted">
                    {formatDate(h.performedOn)}
                  </td>
                  <td className="py-1.5 pr-3">
                    {h.values.LSCT_W3 !== undefined
                      ? `${sv(h.values.LSCT_W3)} W`
                      : "–"}
                  </td>
                  <td className="py-1.5 pr-3">
                    {h.values.LSCT_HRR !== undefined
                      ? `${sv(h.values.LSCT_HRR)} slag`
                      : "–"}
                  </td>
                  <td className="py-1.5 pr-3">
                    {h.values.LSCT_RPE2 !== undefined
                      ? sv(h.values.LSCT_RPE2)
                      : "–"}
                  </td>
                  <td className="py-1.5">
                    {h.values.LSCT_T90 !== undefined
                      ? `${sv(h.values.LSCT_T90)} s`
                      : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[0.8125rem] leading-relaxed text-text-muted">
        Normen är medelvärdet av de senaste testen före det här, högst sex. En
        avvikelse är en ändring större än två standardavvikelser, men minst 4 %
        i effekt och 4 slag i återhämtning; RPE räknas som avvikande en poäng
        över normen och tiden till 90 % över en minut. Testet säger att något
        har ändrats, inte varför.
      </p>
    </Card>
  );
}
