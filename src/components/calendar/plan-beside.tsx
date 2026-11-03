import Link from "next/link";
import { GripVertical, X } from "lucide-react";

import { PillLinks } from "@/components/plan-library/pill-links";
import { Card } from "@/components/ui/card";
import type { Sport } from "@/lib/calculators/lactate";
import type { DragPass } from "@/lib/calendar/drag";
import { cn } from "@/lib/cn";
import { focusLabel } from "@/lib/plan-library/focus";
import {
  DAY_SHORT,
  hoursMinutes,
  levelOptionLabel,
  weekKindLabel,
} from "@/lib/plan-library/labels";
import {
  listDisciplines,
  listLibrary,
  loadPublishedBySlug,
} from "@/lib/plan-library/queries";
import { defaultLevel } from "@/lib/plan-library/queue";
import { categoriesForSport } from "@/lib/plan-library/sports";

import { SportIcon } from "./calendar-items";
import { MovePassButton } from "./move-pass-button";

/**
 * En plan ur biblioteket bredvid adeptens kalender, vecka för vecka. Passen
 * dras till en dag i kalendern och läggs in som adeptens egna pass, omräknade
 * mot adeptens trösklar: planen som verktygslåda för en egen plan. Varje pass
 * har också en knapp som lägger in det utan att dra.
 */
export async function PlanBeside({
  adept,
  slug,
  levelId,
  hrefWith,
  closeHref,
  defaultDate,
}: {
  adept: { id: string; full_name: string; sport: string | null };
  /** Planen som visas; null visar planerna att välja bland. */
  slug: string | null;
  levelId: string | null;
  /** Adressen med en annan plan eller nivå bredvid. */
  hrefWith: (params: { bredvid: string; niva?: string }) => string;
  closeHref: string;
  /** Dagen som är vald i kalendern, förvald när ett pass läggs in utan att dras. */
  defaultDate: string;
}) {
  const firstName = adept.full_name.split(" ")[0];
  const content = slug ? await loadPublishedBySlug(slug) : null;

  const header = (title: string, sub: string | null) => (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[0.75rem] font-medium text-text-subtle">
          Plan bredvid
        </p>
        <h2 className="text-base font-semibold text-text">{title}</h2>
        {sub && <p className="mt-1 text-[0.8125rem] text-text-muted">{sub}</p>}
      </div>
      <Link
        href={closeHref}
        aria-label="Stäng planen bredvid"
        className="-mr-2 -mt-1 rounded-full p-2 text-text-subtle hover:bg-surface-2 hover:text-text"
      >
        <X aria-hidden className="size-5" />
      </Link>
    </div>
  );

  // Ingen plan vald: planerna för adeptens gren först.
  if (!content) {
    const library = await listLibrary();
    const categories = categoriesForSport(adept.sport);
    const forSport = (key: string | undefined) =>
      categories !== null && key !== undefined && categories.includes(key);
    const plans = [...library].sort(
      (a, b) =>
        Number(forSport(b.category?.key)) - Number(forSport(a.category?.key)),
    );
    return (
      <Card className="min-w-0">
        {header(
          `Välj en plan att hämta pass ur`,
          `Passen läggs in som ${firstName}s egna pass och räknas om mot ${firstName}s trösklar.`,
        )}
        <ul className="divide-y divide-line">
          {plans.map((e) => (
            <li key={e.version.id}>
              <Link
                href={hrefWith({ bredvid: e.template.slug })}
                className="-mx-2 block rounded-md px-2 py-2.5 hover:bg-surface-2"
              >
                <span className="block text-sm font-medium text-text">
                  {e.version.title}
                </span>
                <span className="block text-[0.75rem] text-text-muted">
                  {[e.category?.name, focusLabel(e.template.focus)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  const disciplines = await listDisciplines();
  const sportOf = (key: string) =>
    (disciplines.find((d) => d.key === key)?.structure_sport ??
      null) as Sport | null;
  const levels = [...content.domain.levels].sort((a, b) => b.rank - a.rank);
  const level =
    levels.find((l) => l.id === levelId) ??
    defaultLevel(levels, null) ??
    levels[0];
  const phaseName = new Map(content.domain.phases.map((p) => [p.id, p.name]));
  const weeks = [...content.domain.weeks].sort(
    (a, b) => a.position - b.position,
  );
  const levelRows = new Map(content.levels.map((l) => [l.id, l]));

  return (
    <Card className="min-w-0">
      {header(
        content.version.title,
        `Dra ett pass till en dag i kalendern. Det läggs in som ${firstName}s eget pass, omräknat mot ${firstName}s trösklar, och följer sedan inte planen.`,
      )}
      <div className="mb-4 space-y-2">
        <PillLinks
          label="Nivå"
          active={level?.id ?? ""}
          items={levels.map((l) => {
            const row = levelRows.get(l.id);
            return {
              key: l.id,
              label: row ? levelOptionLabel(row) : l.key,
              href: hrefWith({ bredvid: content.template.slug, niva: l.id }),
            };
          })}
        />
        <Link
          href={hrefWith({ bredvid: "valj" })}
          className="inline-block text-[0.8125rem] font-medium text-accent-text hover:underline"
        >
          Byt plan
        </Link>
      </div>

      <ol className="space-y-5">
        {weeks.map((week, i) => {
          const sessions = content.domain.sessions
            .filter((s) => s.weekId === week.id)
            .sort(
              (a, b) => (a.day ?? 7) - (b.day ?? 7) || a.position - b.position,
            )
            .flatMap((s) => {
              const variant = s.variants.find((v) => v.levelId === level?.id);
              return variant ? [{ session: s, variant }] : [];
            });
          return (
            <li key={week.id}>
              <p className="mb-1.5 text-[0.75rem] font-medium text-text-subtle">
                Vecka {i + 1} · {phaseName.get(week.phaseId) ?? ""}
                {week.kind !== "normal" ? ` · ${weekKindLabel(week.kind)}` : ""}
              </p>
              <ul className="space-y-1.5">
                {sessions.map(({ session, variant }) => {
                  const sport = sportOf(session.discipline);
                  const movable =
                    sport !== null &&
                    variant.basis !== null &&
                    (variant.blocks?.length ?? 0) > 0;
                  const drag: DragPass | null =
                    movable && level
                      ? {
                          kind: "mall",
                          sessionId: session.id,
                          levelId: level.id,
                          adeptId: adept.id,
                          title: session.title,
                        }
                      : null;
                  const meta = [
                    session.day !== null
                      ? DAY_SHORT[session.day]
                      : "Valfri dag",
                    hoursMinutes(variant.durationS),
                    variant.zone,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li
                      key={session.id}
                      className="flex items-start gap-1 rounded-md border border-line bg-surface"
                    >
                      <div
                        draggable={drag ? true : undefined}
                        data-drag={drag ? JSON.stringify(drag) : undefined}
                        title={
                          drag
                            ? `Dra till en dag för att lägga in ${session.title}`
                            : undefined
                        }
                        className={cn(
                          "flex min-w-0 flex-1 items-start gap-2 rounded-md px-2.5 py-2",
                          drag
                            ? "cursor-grab hover:bg-surface-2 active:cursor-grabbing"
                            : "opacity-60",
                        )}
                      >
                        {drag && (
                          <GripVertical
                            aria-hidden
                            className="mt-0.5 size-4 shrink-0 text-text-subtle"
                          />
                        )}
                        <SportIcon
                          sport={sport ?? "annat"}
                          className="mt-0.5 size-4 shrink-0 text-text-subtle"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-text">
                            {session.title}
                          </span>
                          <span className="block text-[0.75rem] text-text-muted">
                            {drag ? meta : `${meta} · läggs in under Styrka`}
                          </span>
                        </span>
                      </div>
                      {drag && (
                        <MovePassButton pass={drag} date={defaultDate} />
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
