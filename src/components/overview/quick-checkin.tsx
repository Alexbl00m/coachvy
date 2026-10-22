"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { saveReadiness } from "@/lib/training/actions";

/**
 * Dagens mående i fyra tryck, direkt på Idag: Hoopers fyra frågor, vända så
 * att 5 alltid är bäst (som i incheckningen under Mående). Passet loggas
 * efteråt där, med hur det kändes och hur långt det var.
 */
const QUESTIONS = [
  { key: "sleep", label: "Sömnen", low: "Uselt", high: "Mycket bra" },
  { key: "fatigue", label: "Orken", low: "Utmattad", high: "Pigg" },
  { key: "soreness", label: "Benen", low: "Mycket öm", high: "Inte öm" },
  { key: "stress", label: "Stressen", low: "Mycket", high: "Avslappnad" },
] as const;

type Key = (typeof QUESTIONS)[number]["key"];
type Answers = Record<Key, number | null>;

export function QuickCheckin({
  adeptId,
  today,
  initial,
}: {
  adeptId: string;
  today: string;
  initial?: Partial<Answers>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<Answers>({
    sleep: initial?.sleep ?? null,
    fatigue: initial?.fatigue ?? null,
    soreness: initial?.soreness ?? null,
    stress: initial?.stress ?? null,
  });
  const [error, setError] = useState<string | null>(null);
  const complete = QUESTIONS.every((q) => answers[q.key] !== null);

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveReadiness({
        adeptId,
        performedOn: today,
        sleep: answers.sleep as number,
        fatigue: answers.fatigue as number,
        soreness: answers.soreness as number,
        stress: answers.stress as number,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });

  return (
    <div className="mt-6 space-y-5">
      {QUESTIONS.map((q) => (
        <fieldset key={q.key} className="min-w-0">
          <legend className="mb-2 flex w-full items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-text">{q.label}</span>
            <span className="text-[0.75rem] text-text-subtle">
              1 {q.low.toLowerCase()} · 5 {q.high.toLowerCase()}
            </span>
          </legend>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => {
              const checked = answers[q.key] === n;
              return (
                <label key={n} className="relative">
                  <input
                    type="radio"
                    name={q.key}
                    value={n}
                    checked={checked}
                    onChange={() =>
                      setAnswers((prev) => ({ ...prev, [q.key]: n }))
                    }
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      "flex h-11 cursor-pointer items-center justify-center rounded-md border text-[0.9375rem] font-medium tabular-nums transition-colors duration-120 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                      checked
                        ? "border-text bg-text text-canvas"
                        : "border-line bg-canvas/40 text-text-muted hover:border-line-strong hover:text-text",
                    )}
                  >
                    {n}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      <Button
        size="lg"
        className="w-full"
        disabled={!complete || pending}
        onClick={save}
      >
        {pending ? "Sparar …" : "Checka in"}
      </Button>
      {error && (
        <p role="alert" className="text-[0.8125rem] text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
