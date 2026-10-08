"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import {
  decideSuggestion,
  endPlan,
  restartAfterBreak,
  revokeChange,
  shiftPlan,
} from "@/lib/plan-library/actions";
import { REASON_LABEL } from "@/lib/plan-library/labels";
import { suggestReentry } from "@/lib/plan-library/reentry";
import type { ChangeReason, Level } from "@/lib/plan-library/types";

import { useAction } from "../use-action";

/** Återkallar ett planerat byte, och de senare i samma grupp. */
export function RevokeButton({
  instanceId,
  changeId,
}: {
  instanceId: string;
  changeId: string;
}) {
  const { pending, error, run } = useAction();
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => run(() => revokeChange({ instanceId, changeId }))}
      >
        Ångra
      </Button>
      {error && (
        <span role="alert" className="text-[12px] text-warn">
          {error}
        </span>
      )}
    </>
  );
}

/** Godkänn eller avvisa ett förslag. Inget ändras förrän någon klickar. */
export function SuggestionButtons({
  instanceId,
  suggestionId,
}: {
  instanceId: string;
  suggestionId: string;
}) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          run(() =>
            decideSuggestion({ instanceId, suggestionId, accept: true }),
          )
        }
      >
        Godkänn
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          run(() =>
            decideSuggestion({ instanceId, suggestionId, accept: false }),
          )
        }
      >
        Avvisa
      </Button>
      {error && (
        <span role="alert" className="text-[12px] text-warn">
          {error}
        </span>
      )}
    </div>
  );
}

const BREAK_REASONS: ChangeReason[] = [
  "uppehåll",
  "sjukdom",
  "skada",
  "resa",
  "arbete",
  "familj",
];

/**
 * Tillbaka efter ett uppehåll: föreslagen nivå och trappa upp, med
 * motivering. Utan lopp kan planen också skjutas framåt.
 */
export function RestartCard({
  instanceId,
  levels,
  levelBeforeId,
  week,
  totalWeeks,
  canShift,
  initialBreakDays,
}: {
  instanceId: string;
  levels: Level[];
  levelBeforeId: string;
  week: number;
  totalWeeks: number;
  canShift: boolean;
  initialBreakDays: number;
}) {
  const [breakDays, setBreakDays] = useState(initialBreakDays || 14);
  const [reason, setReason] = useState<ChangeReason>("uppehåll");
  const [shiftWeeks, setShiftWeeks] = useState(
    Math.max(1, Math.round(initialBreakDays / 7)),
  );
  const { pending, error, run } = useAction();
  const [done, setDone] = useState<string | null>(null);
  const suggestion = useMemo(
    () =>
      suggestReentry({
        levels,
        levelBeforeId,
        breakDays,
        reason,
        week,
        totalWeeks,
      }),
    [levels, levelBeforeId, breakDays, reason, week, totalWeeks],
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Uppehållet, dagar" htmlFor="aterstart-dagar">
          <Input
            id="aterstart-dagar"
            type="number"
            min={0}
            max={365}
            value={breakDays}
            onChange={(e) => setBreakDays(Number(e.target.value))}
          />
        </Field>
        <Field label="Varför" htmlFor="aterstart-orsak">
          <Select
            id="aterstart-orsak"
            value={reason}
            onChange={(e) => setReason(e.target.value as ChangeReason)}
          >
            {BREAK_REASONS.map((r) => (
              <option key={r} value={r}>
                {REASON_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <ul className="space-y-1 text-[13px] leading-relaxed text-text-muted">
        {suggestion.rationale.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={pending || suggestion.changes.length === 0}
          onClick={() =>
            run(
              () => restartAfterBreak({ instanceId, breakDays, reason }),
              () => setDone("Nivåerna är ändrade enligt förslaget."),
            )
          }
        >
          Använd förslaget
        </Button>
      </div>
      {canShift && (
        <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
          <Field
            label="Eller skjut fram planen, veckor"
            htmlFor="aterstart-skjut"
            hint="Planen har inget lopp, så datumen kan flyttas. Pass du redan flyttat följer inte med."
          >
            <Input
              id="aterstart-skjut"
              type="number"
              min={1}
              max={26}
              value={shiftWeeks}
              onChange={(e) => setShiftWeeks(Number(e.target.value))}
              className="w-28"
            />
          </Field>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(
                () => shiftPlan({ instanceId, weeks: shiftWeeks }),
                () => setDone(`Planen är flyttad ${shiftWeeks} veckor framåt.`),
              )
            }
          >
            Skjut fram
          </Button>
        </div>
      )}
      {done && <p className="text-sm text-text-muted">{done}</p>}
      {error && (
        <p role="alert" className="text-sm text-warn">
          {error}
        </p>
      )}
    </div>
  );
}

export function EndPlanButtons({ instanceId }: { instanceId: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          if (
            confirm(
              "Markera planen som genomförd? Den sparas med allt du loggat.",
            )
          ) {
            run(() => endPlan({ instanceId, status: "avslutad" }));
          }
        }}
      >
        Planen är klar
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          if (
            confirm(
              "Avbryt planen? Den sparas, men går inte att fortsätta. Du kan starta en ny.",
            )
          ) {
            run(() => endPlan({ instanceId, status: "avbruten" }));
          }
        }}
      >
        Avbryt planen
      </Button>
      {error && (
        <span role="alert" className="text-[12px] text-warn">
          {error}
        </span>
      )}
    </div>
  );
}
