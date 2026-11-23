"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarPlus, Undo2 } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { StructureText } from "@/components/workouts/structure-text";
import {
  applyPlanDraft,
  discardPlanDraft,
  undoPlanDraft,
} from "@/lib/ai-planning/actions";
import type { DraftWeek } from "@/lib/ai-planning/draft";
import type { DraftView } from "@/lib/ai-planning/queries";
import { routes } from "@/lib/routes";
import type { SessionGoal } from "@/lib/season/distribution";
import { dateRange, shortDate, weekdayName } from "@/lib/season/season";
import { phaseLabel } from "@/lib/tests/phases";
import { hoursText, tssText } from "@/lib/workouts/load";

/** Passets huvudsyfte i filosofins tre domäner, i domänens zonfärg. */
const GOAL: Record<SessionGoal, { word: string; zone: number }> = {
  lugn: { word: "lugnt", zone: 2 },
  medel: { word: "medel", zone: 4 },
  hög: { word: "högt", zone: 5 },
};

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * Ett planförslag ur AI-chatten, att besluta om.
 *
 * Förslaget står som ett vanligt kort (DESIGN.md, Förslag att besluta om):
 * idén och veckorna först, sedan varningarna ur kontrollen mot filosofin,
 * sist knapparna. Inget läggs i kalendern förrän coachen trycker, och det
 * som lades in går att ångra.
 */
export function PlanDraftCard({
  draft,
  adeptId,
}: {
  draft: DraftView;
  adeptId: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [replace, setReplace] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const waiting = draft.status === "förslag";
  const applied = draft.status === "inlagd";
  const blocked =
    draft.errors.length > 0 || (draft.conflicts.length > 0 && !replace);

  const apply = () =>
    start(async () => {
      setMessage(null);
      const result = await applyPlanDraft({
        draftId: draft.id,
        replacePeriods: replace,
      });
      if (!result.ok) {
        setMessage(
          result.conflicts
            ? `${result.error} ${result.conflicts.join(", ")}.`
            : result.error,
        );
      }
      router.refresh();
    });

  const undo = () =>
    start(async () => {
      setMessage(null);
      const result = await undoPlanDraft(draft.id);
      setMessage(
        result.ok
          ? result.kept > 0
            ? `Ångrat. ${result.kept} pass som redan har passerat ligger kvar.`
            : null
          : result.error,
      );
      router.refresh();
    });

  const discard = () =>
    start(async () => {
      setMessage(null);
      const result = await discardPlanDraft(draft.id);
      if (!result.ok) setMessage(result.error);
      router.refresh();
    });

  const calendarHref = draft.firstDate
    ? `${routes.calendar}?adept=${adeptId}&manad=${draft.firstDate.slice(0, 7)}&dag=${draft.firstDate}`
    : `${routes.calendar}?adept=${adeptId}`;

  const sessions = draft.weeks.reduce((n, w) => n + w.sessions.length, 0);

  return (
    <Card className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="eyebrow">
          Planförslag ·{" "}
          {applied
            ? `inlagt ${shortDate(draft.appliedAt ?? "")}`
            : draft.status === "förkastad"
              ? "lagt åt sidan"
              : "väntar på dig"}
        </p>
        <p className="font-mono text-[0.8125rem] tabular-nums text-text-subtle">
          {plural(sessions, "pass", "pass")} ·{" "}
          {plural(draft.weeks.length, "vecka", "veckor")}
          {draft.periods.length > 0 &&
            ` · ${plural(draft.periods.length, "period", "perioder")}`}
        </p>
      </div>
      <h3 className="mt-2 text-[1.0625rem] font-semibold tracking-[-0.01em] text-text">
        {draft.title}
      </h3>
      <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-text-muted">
        {draft.idea}
      </p>

      {draft.periods.length > 0 && (
        <div className="mt-4">
          <p className="eyebrow mb-2">Perioder</p>
          <ul className="divide-y divide-line rounded-md border border-line">
            {draft.periods.map((p) => (
              <li
                key={`${p.starts_on}-${p.name}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-sm"
              >
                <span className="font-medium text-text">{p.name}</span>
                <span className="text-text-muted">{phaseLabel(p.phase)}</span>
                <span className="font-mono text-[0.8125rem] tabular-nums text-text-subtle">
                  {dateRange(p.starts_on, p.ends_on)}
                </span>
                {p.focus && (
                  <span className="basis-full text-[0.8125rem] text-text-muted">
                    {p.focus}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {draft.weeks.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="eyebrow">Veckorna</p>
          {draft.weeks.map((week, i) => (
            <Week key={week.monday} week={week} open={i === 0} />
          ))}
        </div>
      )}

      {draft.warnings.length > 0 && (
        <div className="mt-4">
          <p className="eyebrow mb-2">Att väga innan planen läggs in</p>
          <ul className="space-y-1.5">
            {draft.warnings.map((w) => (
              <li
                key={w}
                className="flex gap-2 text-[0.8125rem] text-text-muted"
              >
                <AlertTriangle
                  aria-label="Varning"
                  className="mt-0.5 size-3.5 shrink-0 text-warn"
                />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {waiting && draft.newSessions.length > 0 && (
        <p className="mt-4 text-[0.8125rem] text-text-muted">
          Nytt i ditt passbibliotek när planen läggs in:{" "}
          <span className="text-text">{draft.newSessions.join(", ")}</span>.
        </p>
      )}

      {waiting && draft.errors.length > 0 && (
        <div className="mt-4 rounded-md border border-line-strong bg-surface-2 px-3 py-2.5 text-[0.8125rem]">
          <p className="font-medium text-bad">
            Går inte att lägga in som det står
          </p>
          <ul className="mt-1 space-y-1 text-text-muted">
            {draft.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p className="mt-1.5 text-text-subtle">
            Be AI:n om ett nytt förslag, så kontrolleras det mot dagens datum
            och bibliotek.
          </p>
        </div>
      )}

      {waiting && draft.conflicts.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[0.8125rem] text-text-muted">
            Perioderna krockar med det som redan ligger i säsongen:{" "}
            <span className="text-text">{draft.conflicts.join(", ")}</span>.
          </p>
          <Switch
            checked={replace}
            onChange={setReplace}
            label="Ersätt perioderna som krockar"
            hint="De gamla perioderna kommer tillbaka om du ångrar."
            disabled={busy}
          />
        </div>
      )}

      {message && (
        <p role="status" className="mt-4 text-[0.8125rem] text-text">
          {message}
        </p>
      )}

      {waiting && (
        <div className="mt-5 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={apply}
              disabled={busy || blocked}
            >
              <CalendarPlus aria-hidden className="size-4" />
              {busy ? "Lägger in …" : "Lägg in i kalendern"}
            </Button>
            <Button variant="ghost" onClick={discard} disabled={busy}>
              Inte nu
            </Button>
          </div>
          <p className="mt-2 text-[0.8125rem] text-text-subtle">
            Passen räknas om mot adeptens trösklar och läggs på sina datum. Inte
            nu lägger förslaget åt sidan utan att något ändras.
          </p>
        </div>
      )}

      {applied && (
        <div className="mt-5 border-t border-line pt-4">
          {draft.applied && (
            <p className="mb-3 text-[0.8125rem] text-text-muted">
              Inlagt: {plural(draft.applied.workouts, "pass", "pass")}
              {draft.applied.periods > 0 &&
                `, ${plural(draft.applied.periods, "period", "perioder")}`}
              {draft.applied.library > 0 &&
                `, ${plural(draft.applied.library, "nytt pass", "nya pass")} i biblioteket`}
              .
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink variant="secondary" href={calendarHref}>
              Visa i kalendern
            </ButtonLink>
            <Button variant="ghost" onClick={undo} disabled={busy}>
              <Undo2 aria-hidden className="size-4" />
              {busy ? "Ångrar …" : "Ångra"}
            </Button>
          </div>
          <p className="mt-2 text-[0.8125rem] text-text-subtle">
            Ångra tar bort passen och perioderna som lades in. Pass som redan
            har passerat och nya pass i biblioteket ligger kvar.
          </p>
        </div>
      )}
    </Card>
  );
}

function Week({ week, open }: { week: DraftWeek; open: boolean }) {
  return (
    <details
      open={open}
      className="group rounded-md border border-line [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2.5 hover:bg-surface-2">
        <span className="text-sm font-medium text-text">Vecka {week.week}</span>
        <span className="font-mono text-[0.8125rem] tabular-nums text-text-muted">
          {hoursText(week.seconds)} · {tssText(week.tss)} TSS
        </span>
        <span className="ml-auto flex gap-2 text-[0.75rem] text-text-subtle">
          {(Object.keys(GOAL) as SessionGoal[]).map((g) =>
            week.goals[g] > 0 ? (
              <span key={g} className="inline-flex items-center gap-1">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: `var(--zone-${GOAL[g].zone})` }}
                />
                {week.goals[g]} {GOAL[g].word}
              </span>
            ) : null,
          )}
        </span>
      </summary>
      <ul className="divide-y divide-line border-t border-line">
        {week.sessions.map((s, i) => (
          <li
            key={`${s.date}-${i}`}
            className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 px-3 py-2.5 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]"
          >
            <span className="font-mono text-[0.8125rem] tabular-nums text-text-subtle">
              {weekdayName(s.date).slice(0, 3)} {shortDate(s.date)}
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-text">
                <span className="font-medium">{s.title}</span>
                {s.level && (
                  <span className="text-[0.75rem] text-text-subtle">
                    nivå {s.level}
                  </span>
                )}
                {s.isNew && (
                  <span className="rounded-[6px] border border-line-strong px-1.5 text-[0.6875rem] text-text-muted">
                    nytt
                  </span>
                )}
                {s.testProtocol && (
                  <span className="rounded-[6px] border border-line-strong px-1.5 text-[0.6875rem] text-text-muted">
                    test
                  </span>
                )}
              </p>
              <div className="mt-0.5 overflow-x-auto">
                <StructureText text={s.structure} basis={s.basis} />
              </div>
              {s.note && (
                <p className="mt-0.5 text-[0.8125rem] text-text-muted">
                  {s.note}
                </p>
              )}
            </div>
            <span className="col-start-2 font-mono text-[0.8125rem] tabular-nums text-text-muted sm:col-start-3 sm:text-right">
              {[
                s.load && hoursText(s.load.seconds),
                s.load?.tss != null && `${tssText(s.load.tss)} TSS`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
