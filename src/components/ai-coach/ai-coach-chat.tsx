"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Eraser, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/field";
import { ContextSummary } from "@/components/workouts/context-summary";
import { cn } from "@/lib/cn";
import { askCoach, clearConversation } from "@/lib/ai-coach/actions";
import type { AthleteContext } from "@/lib/workouts/context";
import type { AiMessageRow } from "@/lib/types/database";

type AdeptOption = { id: string; full_name: string };

/**
 * Frågor om en adept, med hennes egna tal som underlag.
 *
 * Underlaget byggs om vid varje fråga i stället för att frysas i tråden. Talen
 * rör sig – ett nytt test, en veckas incheckningar – och ett svar som räknar
 * på förra månadens CP är sämre än inget svar.
 */

const EXAMPLES = [
  "Vad säger de senaste testerna om var hon står?",
  "Hon känns tung i benen – vad ser du i belastningen?",
  "Vad bör vi prioritera de närmaste fyra veckorna?",
  "Räcker den anaeroba kapaciteten för ett lopp med mycket backar?",
];

export function AiCoachChat({
  adepts,
  adeptId,
  adeptName,
  context,
  messages,
  configured,
}: {
  adepts: AdeptOption[];
  adeptId: string | null;
  adeptName: string | null;
  context: AthleteContext | null;
  /** Äldst först. */
  messages: AiMessageRow[];
  configured: boolean;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [pending, startAsk] = useTransition();
  const [clearing, startClear] = useTransition();

  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Den senaste frågan, visad direkt så att tråden inte hoppar till. */
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, optimistic]);

  const chooseAdept = (next: string) =>
    startNavigation(() => {
      setError(null);
      setOptimistic(null);
      router.push(next ? `?adept=${next}` : "?");
    });

  const ask = () => {
    if (adeptId === null) return;
    const asked = question.trim();
    if (asked.length === 0) return;

    setOptimistic(asked);
    setQuestion("");
    setError(null);

    startAsk(async () => {
      const result = await askCoach({ adeptId, question: asked });
      if (!result.ok) {
        setError(result.error);
        setQuestion(asked);
      }
      setOptimistic(null);
      router.refresh();
    });
  };

  const clear = () =>
    startClear(async () => {
      if (adeptId === null) return;
      await clearConversation(adeptId);
      setOptimistic(null);
      router.refresh();
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <Card className="min-w-0">
          <CardTitle
            action={
              messages.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clear}
                  disabled={clearing}
                >
                  <Eraser aria-hidden className="size-4" />
                  Töm tråden
                </Button>
              ) : undefined
            }
          >
            {adeptName ? `Om ${adeptName}` : "Välj en adept"}
          </CardTitle>

          {adeptId === null ? (
            <p className="text-sm text-text-muted">
              Välj en adept till höger. Frågorna besvaras utifrån hennes mätta
              värden, inte utifrån allmänna träningsråd.
            </p>
          ) : messages.length === 0 && optimistic === null ? (
            <div className="space-y-4">
              <p className="text-sm text-text-muted">
                Fråga om {adeptName}. Svaret bygger på testtillfällena, den
                rullande modellen, bakgrunden och de senaste incheckningarna –
                allt som står till höger.
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setQuestion(example)}
                    className="rounded-full border border-line-strong px-3 py-1 text-[12px] text-text-muted transition-colors hover:border-accent/60 hover:text-text"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="max-h-[520px] space-y-4 overflow-y-auto pr-1">
              {messages.map((message) => (
                <Bubble
                  key={message.id}
                  role={message.role}
                  content={message.content}
                />
              ))}
              {optimistic !== null && (
                <>
                  <Bubble role="user" content={optimistic} />
                  <li className="flex items-center gap-2 text-[13px] text-text-subtle">
                    <Bot aria-hidden className="size-4 animate-pulse text-accent" />
                    Räknar igenom talen …
                  </li>
                </>
              )}
              <div ref={bottom} />
            </ul>
          )}
        </Card>

        {error && (
          <Card>
            <p className="text-sm text-text">{error}</p>
          </Card>
        )}

        <Card className="min-w-0">
          <Textarea
            aria-label="Fråga om adepten"
            rows={3}
            value={question}
            placeholder={
              adeptId === null ? "Välj en adept först" : "Vad vill du veta?"
            }
            disabled={adeptId === null}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                ask();
              }
            }}
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={ask}
              disabled={
                pending ||
                navigating ||
                adeptId === null ||
                question.trim().length === 0 ||
                !configured
              }
            >
              <Send aria-hidden className="size-4" />
              {pending ? "Frågar …" : "Fråga"}
            </Button>
            <span className="text-[13px] text-text-subtle">
              {configured
                ? "Ctrl + Enter skickar. Adepten ser inte den här tråden."
                : "ANTHROPIC_API_KEY saknas i .env.local."}
            </span>
          </div>
        </Card>
      </div>

      <div className="min-w-0 space-y-4">
        <Card className="min-w-0">
          <CardTitle>Underlag</CardTitle>
          <Field label="Adept" htmlFor="adept">
            <Select
              id="adept"
              value={adeptId ?? ""}
              onChange={(e) => chooseAdept(e.target.value)}
            >
              <option value="">Välj adept</option>
              {adepts.map((adept) => (
                <option key={adept.id} value={adept.id}>
                  {adept.full_name}
                </option>
              ))}
            </Select>
          </Field>

          {context && (
            <div className="mt-4">
              <ContextSummary context={context} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const mine = role === "user";
  return (
    <li className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] rounded-lg border px-3.5 py-2.5",
          mine ? "border-accent/40 bg-accent-soft" : "border-line bg-surface-2",
        )}
      >
        <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-subtle">
          {mine ? "Du" : "AI Coach"}
        </p>
        <p className="whitespace-pre-line text-sm leading-relaxed text-text">
          {content}
        </p>
      </div>
    </li>
  );
}
