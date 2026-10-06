"use client";

import { useState } from "react";
import { CornerDownLeft } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { PROMPT_LIBRARY } from "@/lib/ai-coach/prompt-library";

/**
 * Färdiga frågor i kategorier. En vald fråga läggs i rutan – den skickas
 * inte direkt, så att coachen kan skärpa den först.
 */
export function PromptLibrary({
  onPick,
  disabled = false,
}: {
  onPick: (prompt: string) => void;
  disabled?: boolean;
}) {
  const [active, setActive] = useState(PROMPT_LIBRARY[0].id);
  const category =
    PROMPT_LIBRARY.find((c) => c.id === active) ?? PROMPT_LIBRARY[0];

  return (
    <Card className="min-w-0">
      <CardTitle>Frågebibliotek</CardTitle>
      <div
        role="tablist"
        aria-label="Kategorier"
        className="flex flex-wrap gap-1.5"
      >
        {PROMPT_LIBRARY.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === category.id}
            onClick={() => setActive(c.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[13px] transition-colors",
              c.id === category.id
                ? "border-text-subtle bg-surface-3 font-medium text-text"
                : "border-line-strong text-text-muted hover:border-text-subtle hover:text-text",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <ul role="tabpanel" aria-label={category.label} className="mt-3">
        {category.prompts.map((prompt) => (
          <li key={prompt} className="border-t border-line first:border-t-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(prompt)}
              className="group flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left text-sm leading-relaxed text-text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <span className="min-w-0 flex-1">{prompt}</span>
              <CornerDownLeft
                aria-hidden
                className="mt-1 size-3.5 shrink-0 text-text-subtle opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              />
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[12px] text-text-subtle">
        {disabled
          ? "Välj en adept först."
          : "Frågan läggs i rutan ovan så att du kan ändra den innan du skickar. Text inom hakparenteser fyller du i själv."}
      </p>
    </Card>
  );
}
