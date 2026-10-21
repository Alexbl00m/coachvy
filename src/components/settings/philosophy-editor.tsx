"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { savePhilosophy } from "@/lib/ai-coach/philosophy-actions";

/** Samma gräns som i databasen och på servern. */
const MAX = 40000;

type Mode = "komplettera" | "ersatt";

const MODES: { key: Mode; label: string; hint: string }[] = [
  {
    key: "komplettera",
    label: "Komplettera Coachvys grundfilosofi",
    hint: "Grundfilosofin är grunden. Din text går före där ni skiljer er, och grundfilosofin gäller där din är tyst.",
  },
  {
    key: "ersatt",
    label: "Ersätt den helt",
    hint: "Bara din text gäller. Skriv då ut det du vill att AI:n ska resonera utifrån – den har inget annat att luta sig mot.",
  },
];

/** Rubriker och frågor att skriva utifrån, för den som börjar från noll. */
const TEMPLATE = `## Grundsyn
Vad ska träningen åstadkomma, och vad värderar du högst?

## Intensitetsfördelning
Hur fördelar du lugnt, medel och högt i grundperioden, i uppbyggnaden och nära tävling?

## Periodisering och block
Hur långa är dina block, hur många kvalitetsformat har de, och hur byggs de på? Hur lägger du återhämtningen?

## Nyckelpass
Vilka pass återkommer hos dig, och varför just de?

## Testning
Vilka tester använder du, när, och vilka beslut ska de ge?

## Belastning och återhämtning
Vilka signaler får dig att justera planen?

## Tävling och toppning
Hur ser din toppning ut, och hur jobbar du med tävlingsspecifik träning?

## Kommunikation
Hur vill du att råden formuleras – till dig och till dina adepter?
`;

/**
 * Coachens egen träningsfilosofi, till AI-coachen och passbyggaren. Den
 * följer med varje fråga och varje pass – också när en medlemsadept bygger
 * ett pass åt sig själv.
 */
export function PhilosophyEditor({
  text: savedText,
  mode: savedMode,
  updatedAt,
}: {
  text: string;
  mode: Mode;
  updatedAt: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState(savedText);
  const [mode, setMode] = useState<Mode>(savedMode);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const changed = text.trim() !== savedText.trim() || mode !== savedMode;
  const over = text.length > MAX;

  const save = (nextText: string) =>
    start(async () => {
      setError(null);
      setDone(null);
      const result = await savePhilosophy({ text: nextText, mode });
      if (!result.ok) return setError(result.error);
      setDone(
        nextText.trim()
          ? "Sparat. AI-coachen och passbyggaren använder den från nästa fråga."
          : "Borttagen. Grundfilosofin gäller igen.",
      );
      router.refresh();
    });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save(text);
      }}
    >
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-[13px] font-medium text-text">
          Hur den förhåller sig till grundfilosofin
        </legend>
        {MODES.map((m) => (
          <label
            key={m.key}
            className={cn(
              "flex cursor-pointer gap-3 rounded-md border p-3 transition-colors",
              mode === m.key
                ? "border-accent bg-accent-soft"
                : "border-line hover:border-line-strong",
            )}
          >
            <input
              type="radio"
              name="philosophy-mode"
              value={m.key}
              checked={mode === m.key}
              onChange={() => setMode(m.key)}
              className="mt-1 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-medium text-text">
                {m.label}
              </span>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-text-muted">
                {m.hint}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label
            htmlFor="philosophy-text"
            className="text-[13px] font-medium text-text"
          >
            Din filosofi
          </label>
          {!text.trim() && (
            <button
              type="button"
              onClick={() => setText(TEMPLATE)}
              className="text-[13px] font-medium text-text underline decoration-line-strong underline-offset-2 hover:decoration-text"
            >
              Börja från en mall
            </button>
          )}
        </div>
        <Textarea
          id="philosophy-text"
          rows={16}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Skriv som du skulle förklara din metodik för en ny assisterande tränare: vad du prioriterar, hur du fördelar intensiteten, hur du bygger block, testar och toppar – och varför."
          aria-describedby="philosophy-count"
          className="min-h-64 font-mono text-[13px] leading-relaxed"
        />
        <p
          id="philosophy-count"
          className={cn(
            "text-right text-[12px] tabular-nums",
            over ? "text-bad" : "text-text-subtle",
          )}
        >
          {text.length.toLocaleString("sv-SE")} / {MAX.toLocaleString("sv-SE")}{" "}
          tecken
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-sm text-good">
          {done}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="sm"
          className="font-semibold"
          disabled={pending || over || !changed || (!text.trim() && !savedText)}
        >
          {pending ? "Sparar…" : "Spara filosofin"}
        </Button>
        {savedText && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (
                window.confirm(
                  "Ta bort din filosofi? AI:n går tillbaka till grundfilosofin.",
                )
              ) {
                setText("");
                save("");
              }
            }}
          >
            Ta bort
          </Button>
        )}
        {updatedAt && savedText && (
          <span className="text-[12px] text-text-subtle">
            Senast ändrad {updatedAt}
          </span>
        )}
      </div>
    </form>
  );
}
