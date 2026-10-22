"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import {
  editActivitySummary,
  shareActivitySummary,
  summariseActivity,
  type SummaryResult,
} from "@/lib/activities/summary-actions";
import type { ActivityAiSummaryRow } from "@/lib/types/database";

const INTENSITY: Record<string, string> = {
  lugnt: "Lugnt",
  medel: "Medel",
  högt: "Högt",
};

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));

/**
 * AI-sammanfattningen av ett pass: vad det betyder mot planen, perioden,
 * veckan och de senaste passen av samma slag.
 *
 * Coachen ber om den, läser, rättar vid behov och väljer om adepten ska se
 * den. Adepten ser bara en delad sammanfattning.
 */
export function ActivitySummary({
  activityId,
  initial,
  canManage,
}: {
  activityId: string;
  initial: ActivityAiSummaryRow | null;
  /** Adeptens coach: får skriva, rätta och dela. */
  canManage: boolean;
}) {
  const [summary, setSummary] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [headline, setHeadline] = useState(initial?.headline ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [doing, setDoing] = useState<"write" | "save" | "share" | null>(null);

  const run = (
    kind: "write" | "save" | "share",
    action: () => Promise<SummaryResult>,
  ) => {
    setError(null);
    setDoing(kind);
    start(async () => {
      const result = await action();
      if (result.ok) {
        setSummary(result.summary);
        setHeadline(result.summary.headline);
        setBody(result.summary.body);
        setEditing(false);
      } else {
        setError(result.error);
      }
      setDoing(null);
    });
  };

  const write = () => {
    if (
      summary?.edited &&
      !window.confirm("Din rättade text ersätts av en ny sammanfattning.")
    ) {
      return;
    }
    run("write", () => summariseActivity(activityId));
  };

  const errorLine = error && (
    <p role="alert" className="mt-3 text-[0.8125rem] text-bad">
      {error}
    </p>
  );

  if (!summary) {
    if (!canManage) return null;
    return (
      <Card>
        <CardTitle>Sammanfattning</CardTitle>
        <p className="max-w-2xl text-sm text-text-muted">
          AI:n läser passet mot det som var planerat, perioden i säsongsplanen,
          veckans belastning, incheckningen och de senaste passen av samma slag,
          och skriver vad det betyder. Du läser först och väljer sedan om
          adepten ska se den.
        </p>
        <div className="mt-4" aria-live="polite">
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={write}
          >
            {doing === "write" ? "Läser passet …" : "Sammanfatta passet"}
          </Button>
        </div>
        {errorLine}
      </Card>
    );
  }

  const meta = [
    canManage ? "AI-sammanfattning" : "Från din coach",
    canManage && summary.edited ? "rättad av dig" : null,
    canManage
      ? summary.shared_at
        ? `delad med adepten ${shortDate(summary.shared_at)}`
        : "adepten ser den inte"
      : null,
  ].filter(Boolean);

  return (
    <Card level="lead">
      <CardTitle>Sammanfattning</CardTitle>

      {editing ? (
        <form
          className="max-w-3xl space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run("save", () =>
              editActivitySummary({ activityId, headline, body }),
            );
          }}
        >
          <Field label="Rubrik" htmlFor="sammanfattning-rubrik">
            <Input
              id="sammanfattning-rubrik"
              value={headline}
              maxLength={300}
              onChange={(e) => setHeadline(e.target.value)}
            />
          </Field>
          <Field
            label="Text"
            htmlFor="sammanfattning-text"
            hint="En tom rad mellan styckena."
          >
            <Textarea
              id="sammanfattning-text"
              value={body}
              rows={9}
              maxLength={4000}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={pending}
            >
              {doing === "save" ? "Sparar …" : "Spara texten"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                setHeadline(summary.headline);
                setBody(summary.body);
                setEditing(false);
              }}
            >
              Avbryt
            </Button>
          </div>
        </form>
      ) : (
        <div className="max-w-3xl">
          <p className="text-[1.0625rem] font-semibold leading-snug text-text">
            {summary.headline}
          </p>
          {(summary.purpose || summary.intensity) && (
            <p className="mt-2 flex flex-wrap gap-2 text-[0.8125rem]">
              {summary.purpose && (
                <span className="rounded-full border border-line px-2.5 py-0.5 text-text-muted">
                  {summary.purpose}
                </span>
              )}
              {summary.intensity && (
                <span className="rounded-full border border-line px-2.5 py-0.5 text-text-muted">
                  Intensitet: {INTENSITY[summary.intensity]}
                </span>
              )}
            </p>
          )}
          <div className="mt-4 space-y-3 text-[0.9375rem] leading-relaxed text-text">
            {summary.body.split(/\n\s*\n/).map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-[0.8125rem] text-text-muted">{meta.join(" · ")}</p>

      {canManage && !editing && (
        <div className="mt-3 flex flex-wrap gap-2" aria-live="polite">
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              run("share", () =>
                shareActivitySummary({
                  activityId,
                  share: !summary.shared_at,
                }),
              )
            }
          >
            {doing === "share"
              ? "Sparar …"
              : summary.shared_at
                ? "Sluta dela"
                : "Dela med adepten"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setEditing(true)}
          >
            Rätta texten
          </Button>
          <Button variant="ghost" size="sm" disabled={pending} onClick={write}>
            {doing === "write" ? "Läser passet …" : "Skriv om"}
          </Button>
        </div>
      )}
      {errorLine}
    </Card>
  );
}
