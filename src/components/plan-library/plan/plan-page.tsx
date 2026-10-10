import Link from "next/link";
import { ChevronLeft, ChevronRight, Flag, Gauge } from "lucide-react";

import { PhaseLadder } from "@/components/plan-library/phase-ladder";
import { PillLinks } from "@/components/plan-library/pill-links";
import { SessionCard } from "@/components/plan-library/session-card";
import { StatusChip } from "@/components/plan-library/status-chip";
import { PrintButton } from "@/components/workouts/print-button";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import {
  DAY_LONG,
  hoursMinutes,
  KIND_LABEL,
  REASON_LABEL,
  SOURCE_LABEL,
  weekKindLabel,
} from "@/lib/plan-library/labels";
import type { RunningFitness } from "@/lib/plan-library/fitness";
import { levelTimeline } from "@/lib/plan-library/levels";
import {
  completeEstimate,
  pacedBlocks,
  referenceSpeeds,
  RUNNING_BASES,
  sessionAmount,
  type ReferenceSpeeds,
} from "@/lib/plan-library/paces";
import type { PlanView } from "@/lib/plan-library/plan-view";
import {
  summarizeWeek,
  weekByDay,
  type ScheduledSession,
  type ScheduleWeek,
} from "@/lib/plan-library/schedule";
import { raceByKey, raceByMetres } from "@/lib/plan-library/races";
import { formatStructure } from "@/lib/plan-library/structure";
import type { Variant } from "@/lib/plan-library/types";
import { usedZones } from "@/lib/plan-library/zones";
import { summarizeVolume, volumeText } from "@/lib/plan-library/volume";
import { daysBetween, weekdayIndex } from "@/lib/season/season";
import { BASIS_LABEL } from "@/lib/workouts/schema";

import { FitnessCard } from "./fitness-card";
import { PaceSource } from "./pace-source";
import { LevelPanel } from "./level-panel";
import { LevelTimeline } from "./level-timeline";
import {
  EndPlanButtons,
  RestartCard,
  RevokeButton,
  SuggestionButtons,
} from "./plan-controls";
import { SessionActions } from "./session-actions";

const dayMonth = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
const longDate = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));

const numOrUndefined = (v: number | null) =>
  v === null ? undefined : Number(v);

const isRunningBasis = (basis: Variant["basis"]) =>
  basis !== null && RUNNING_BASES.includes(basis);

/** Passets struktur som text, med löparens tempon där de finns. */
function structureText(variant: Variant, refs: ReferenceSpeeds): string {
  if (!variant.blocks) return "";
  if (!isRunningBasis(variant.basis)) {
    return `${formatStructure(variant.blocks)}${variant.basis ? ` av ${BASIS_LABEL[variant.basis]}` : ""}`;
  }
  return pacedBlocks(variant.blocks, refs[variant.basis!], variant.basis)
    .map((b) => {
      const steps = b.steps
        .map(
          (st) =>
            `${st.amount} ${st.zone ? `@${st.zone} ` : ""}${st.pace ?? st.percent}`,
        )
        .join(" + ");
      return b.times > 1 ? `${b.times} × (${steps})` : steps;
    })
    .join("; ");
}

/** Passets steg med tempo, och procenten bredvid. */
function PacedStructure({
  variant,
  refs,
}: {
  variant: Variant;
  refs: ReferenceSpeeds;
}) {
  if (!variant.blocks) return null;
  if (!isRunningBasis(variant.basis)) {
    return (
      <p className="mt-1 font-mono text-[11px] leading-snug text-text-subtle">
        {structureText(variant, refs)}
      </p>
    );
  }
  const ref = refs[variant.basis!];
  const blocks = pacedBlocks(variant.blocks, ref, variant.basis);
  // Zonerna förklaras i tempokortet; bara procent behöver sin bas.
  const percents = blocks
    .flatMap((b) => b.steps.filter((st) => !st.zone).map((st) => st.percent))
    .filter((v, i, all) => all.indexOf(v) === i);
  return (
    <div className="mt-1.5 text-[12px] leading-snug tabular-nums">
      <ul className="space-y-0.5">
        {blocks.map((b, i) => (
          <li key={i} className="text-text-muted">
            {b.times > 1 && <span>{b.times} × (</span>}
            {b.steps.map((st, j) => (
              <span key={j}>
                {j > 0 && " + "}
                {st.amount}{" "}
                {st.zone && (
                  <span className="mr-1 rounded-sm bg-surface-3 px-1 text-[11px] font-medium text-text">
                    {st.zone}
                  </span>
                )}
                <span className="text-text">{st.pace ?? st.percent}</span>
                {st.label && (
                  <span className="text-text-subtle"> {st.label}</span>
                )}
              </span>
            ))}
            {b.times > 1 && <span>)</span>}
          </li>
        ))}
      </ul>
      {!ref ? (
        <p className="mt-0.5 text-[11px] text-text-subtle">
          Procent av {BASIS_LABEL[variant.basis!]} – tempona visas när det finns
          en formuppskattning.
        </p>
      ) : (
        percents.length > 0 && (
          <p className="mt-0.5 text-[11px] text-text-subtle">
            {percents.join(", ")} av {BASIS_LABEL[variant.basis!]}
          </p>
        )
      )}
    </div>
  );
}

/**
 * Planen som medlemmen – eller coachen – ser den: veckan, hela planen,
 * nivån och historiken. Samma vy på Min plan och på adeptens sida.
 */
export function PlanPage({
  view,
  basePath,
  weekParam,
  mode,
  canEdit,
  workouts,
  today,
  fitness,
  userId,
}: {
  view: PlanView;
  /** Sidan vyn ligger på, för länkarna mellan veckorna. */
  basePath: string;
  weekParam: number | null;
  mode: "vecka" | "hela";
  canEdit: boolean;
  workouts: { id: string; title: string }[];
  today: string;
  /** Löparens formuppskattning och farterna procenten räknas mot. */
  fitness: RunningFitness;
  userId: string;
}) {
  const { instance, schedule, levels, spans, history, content } = view;
  // Planens lopp: måltiden gäller det, och zonerna räknas ur farten på det.
  const raceMetres =
    content.template.race_distance_m === null
      ? null
      : Number(content.template.race_distance_m);
  const race = raceByMetres(raceMetres) ?? raceByKey("M");
  // Med en måltid räknas loppfarterna ur den; CS och LT2 ligger kvar ur
  // testerna.
  const goalEstimate =
    instance.pace_mode === "mål" && instance.goal_seconds
      ? completeEstimate({
          times: { [race.key]: Number(instance.goal_seconds) },
          source: "manuell",
          date: instance.start_date,
        })
      : null;
  const refs: ReferenceSpeeds = goalEstimate
    ? referenceSpeeds(goalEstimate, fitness.measured, raceMetres)
    : referenceSpeeds(fitness.current, fitness.measured, raceMetres);
  const zonesUsed = usedZones(
    content.domain.sessions.flatMap((s) =>
      s.variants
        .filter((v) => v.basis === "MP" && v.blocks)
        .map((v) =>
          v.blocks!.flatMap((b) => (b.type === "steg" ? [b.step] : b.steps)),
        ),
    ),
  );
  const multi = view.rounds.length > 1;
  const usesPaces = content.domain.sessions.some((s) =>
    s.variants.some((v) => isRunningBasis(v.basis)),
  );
  const unit = content.domain.volumeUnit;
  const secondsOf = (s: ScheduledSession) =>
    sessionAmount(s.variant, refs).seconds;
  const hasVolumes = schedule.some((w) => w.volume);
  const isRunning = (key: string) =>
    view.disciplines.find((d) => d.key === key)?.structure_sport === "löpning";
  const volumeOf = (w: ScheduleWeek) =>
    w.volume
      ? summarizeVolume({
          target: w.volume,
          unit,
          sessions: w.sessions
            .filter(
              (s) =>
                s.state !== "struken" &&
                (unit === "h" || isRunning(s.session.discipline)),
            )
            .map((s) =>
              s.state === "ersatt"
                ? { metres: null, seconds: null }
                : sessionAmount(s.variant, refs),
            ),
        })
      : null;
  const active = instance.status === "aktiv";
  const editable = canEdit && active;
  const paused = active && !canEdit;
  const weekNo = Math.min(
    instance.weeks,
    Math.max(1, weekParam ?? view.currentWeek),
  );
  const week = schedule[weekNo - 1];
  const levelOf = (id: string) => levels.find((l) => l.id === id);
  const current = levelOf(view.currentLevelId);
  const span = spans.find((s) => weekNo >= s.fromWeek && weekNo <= s.toWeek);
  const phaseRow = (id: string) => content.phases.find((p) => p.id === id);
  const disciplineName = (key: string) =>
    view.disciplines.find((d) => d.key === key)?.name ?? key;
  const timeline = levelTimeline(
    instance.start_level_id,
    history,
    instance.weeks,
  );
  const raceIn = instance.race_date
    ? daysBetween(today, instance.race_date)
    : null;
  const end = schedule.at(-1)!.endsOn;
  const link = (params: Record<string, string | number>) =>
    `${basePath}${basePath.includes("?") ? "&" : "?"}${new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    )}`;

  // Tillbaka efter en paus i medlemskapet: hur länge var planen pausad?
  const lastPause = [...view.events].reverse().find((e) => e.kind === "pausad");
  const resumed = [...view.events]
    .reverse()
    .find((e) => e.kind === "återupptagen");
  const pausedDays =
    lastPause && resumed && resumed.created_at > lastPause.created_at
      ? Math.round(
          (Date.parse(resumed.created_at) - Date.parse(lastPause.created_at)) /
            86_400_000,
        )
      : 0;
  const recentlyResumed =
    resumed &&
    pausedDays >= 7 &&
    daysBetween(resumed.created_at.slice(0, 10), today) < 21;

  const others = (s: ScheduledSession) =>
    week.sessions
      .filter((o) => o.key !== s.key && o.date && o.state !== "struken")
      .map((o) => ({
        sessionId: o.session.id,
        week: o.week,
        title: o.session.title,
        date: o.date!,
      }));

  const sessionItem = (s: ScheduledSession) => {
    const replaced =
      s.state === "ersatt"
        ? workouts.find((w) => w.id === s.override?.workoutId)
        : null;
    const instruction = s.variant.description || s.session.description;
    return (
      <li
        key={s.key}
        className={cn(
          "rounded-md border border-line bg-surface-2 p-3 print:break-inside-avoid",
          s.state === "struken" && "opacity-60",
          s.log?.status === "genomförd" && "border-good/40",
        )}
      >
        <div className={cn(s.state === "struken" && "line-through")}>
          <SessionCard
            session={s.session}
            variant={s.variant}
            disciplineName={disciplineName(s.session.discipline)}
          />
        </div>
        {s.state === "flyttad" && s.plannedDate && (
          <p className="mt-1 text-[11px] text-text-subtle">
            Flyttat från {DAY_LONG[weekdayIndex(s.plannedDate)]}{" "}
            {dayMonth(s.plannedDate)}
          </p>
        )}
        {s.state === "struken" && (
          <p className="mt-1 text-[11px] text-text-subtle">Struket</p>
        )}
        {s.state === "ersatt" && (
          <p className="mt-1 text-[11px] text-text-subtle">
            Ersatt med{" "}
            {replaced ? `eget pass: ${replaced.title}` : "ett eget pass"}
          </p>
        )}
        {instruction && (
          <p className="mt-1.5 text-[12px] leading-snug text-text-muted">
            {instruction}
          </p>
        )}
        <PacedStructure variant={s.variant} refs={refs} />
        {s.log && !editable && (
          <p className="mt-1 text-[11px] text-text-muted">
            {s.log.status === "genomförd"
              ? "Genomfört"
              : s.log.status === "delvis"
                ? "Delvis"
                : "Hoppade över"}
            {s.log.rpe ? ` · RPE ${s.log.rpe}` : ""}
            {s.log.note ? ` · ${s.log.note}` : ""}
          </p>
        )}
        {editable && (
          <div className="print:hidden">
            <SessionActions
              instanceId={instance.id}
              sessionId={s.session.id}
              week={s.week}
              title={s.session.title}
              state={s.state}
              plannedDate={s.plannedDate}
              date={s.date}
              log={
                s.log
                  ? {
                      status: s.log.status,
                      rpe: s.log.rpe ?? null,
                      note: s.log.note ?? null,
                    }
                  : null
              }
              minDate={instance.start_date}
              maxDate={end}
              others={others(s)}
              workouts={workouts}
            />
          </div>
        )}
      </li>
    );
  };

  const summary = summarizeWeek(week, secondsOf);
  const { days, flexible } = weekByDay(week);
  const volume = volumeOf(week);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[12px] text-text-subtle">
              {longDate(instance.start_date)} – {longDate(end)} ·{" "}
              {instance.weeks} veckor
              {!active && ` · ${instance.status}`}
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-text">
              {instance.title}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {view.notStarted
                ? `Börjar ${longDate(instance.start_date)}.`
                : view.finished
                  ? "Planen är slut i tid."
                  : `Vecka ${view.currentWeek} av ${instance.weeks}`}
              {current && ` · Nivå ${current.key} · ${current.name}`}
              {raceIn !== null &&
                raceIn >= 0 &&
                ` · Loppet om ${raceIn} ${raceIn === 1 ? "dag" : "dagar"}`}
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            {content.version.status !== "publicerad" && (
              <StatusChip
                status={content.version.status}
                version={content.version.version}
              />
            )}
            <PrintButton
              label={mode === "hela" ? "Skriv ut planen" : "Skriv ut veckan"}
            />
          </div>
        </div>
        {paused && (
          <p
            role="status"
            className="mt-4 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-text"
          >
            Planen är pausad och skrivskyddad – den ingår i medlemskapet, som
            inte är aktivt just nu. Inget har försvunnit; när medlemskapet är
            tillbaka fortsätter du där du var.
          </p>
        )}
        <div className="mt-5">
          <PhaseLadder
            phases={spans.map((s) => ({
              id: `${s.phaseId}-${s.fromWeek}`,
              name: s.name,
              weeks: s.weeks,
              specificity: phaseRow(s.phaseId)?.specificity ?? null,
            }))}
          />
        </div>
      </Card>

      <div className="print:hidden">
        <PillLinks
          label="Vy"
          active={mode}
          items={[
            { key: "vecka", label: "Veckan", href: link({ vecka: weekNo }) },
            { key: "hela", label: "Hela planen", href: link({ vy: "hela" }) },
          ]}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          {mode === "vecka" ? (
            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-text">
                    Vecka {weekNo}
                    <span className="font-normal text-text-subtle">
                      {" "}
                      · {dayMonth(week.startsOn)} – {dayMonth(week.endsOn)}
                    </span>
                  </p>
                  <p className="text-[13px] text-text-muted">
                    {[
                      multi ? `varv ${week.round}` : null,
                      span?.name,
                      `nivå ${levelOf(week.levelId)?.key ?? "?"}`,
                      week.kind !== "normal"
                        ? weekKindLabel(week.kind).toLowerCase()
                        : null,
                      content.weeks.find((w) => w.id === week.templateWeekId)
                        ?.title,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <nav
                  aria-label="Veckor"
                  className="flex items-center gap-1 print:hidden"
                >
                  <Link
                    aria-label="Föregående vecka"
                    href={link({ vecka: Math.max(1, weekNo - 1) })}
                    className={cn(
                      "rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-text",
                      weekNo === 1 && "pointer-events-none opacity-40",
                    )}
                  >
                    <ChevronLeft aria-hidden className="size-4" />
                  </Link>
                  {weekNo !== view.currentWeek && (
                    <Link
                      href={link({ vecka: view.currentWeek })}
                      className="rounded-md px-2 py-1 text-[13px] text-text-muted hover:bg-surface-2 hover:text-text"
                    >
                      Den här veckan
                    </Link>
                  )}
                  <Link
                    aria-label="Nästa vecka"
                    href={link({ vecka: Math.min(instance.weeks, weekNo + 1) })}
                    className={cn(
                      "rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-text",
                      weekNo === instance.weeks &&
                        "pointer-events-none opacity-40",
                    )}
                  >
                    <ChevronRight aria-hidden className="size-4" />
                  </Link>
                </nav>
              </div>

              <p className="mb-4 text-[13px] text-text-subtle tabular-nums">
                {summary.planned} pass ·{" "}
                {hoursMinutes(summary.plannedSeconds) || "tid saknas"}
                {Object.keys(summary.byDiscipline).length > 1 &&
                  ` (${Object.entries(summary.byDiscipline)
                    .filter(([, s]) => s > 0)
                    .map(
                      ([d, s]) =>
                        `${disciplineName(d).toLowerCase()} ${hoursMinutes(s)}`,
                    )
                    .join(", ")})`}
                {summary.done + summary.partial + summary.skipped > 0 &&
                  ` · ${summary.done} genomförda${summary.partial ? `, ${summary.partial} delvis` : ""}${summary.skipped ? `, ${summary.skipped} hoppade` : ""}`}
              </p>

              {volume && (
                <p className="-mt-2 mb-4 text-[13px] text-text-muted tabular-nums">
                  <span className="text-text">
                    Veckovolym {volumeText(volume.target, unit)}
                  </span>
                  {volume.planned > 0 &&
                    ` · passen ca ${volumeText({ min: volume.planned, max: null }, unit)}`}
                  {volume.unknown > 0 &&
                    ` (${volume.unknown} pass utan ${unit === "km" ? "sträcka" : "tid"})`}
                  {volume.fill
                    ? ` · fyll ut med ${volumeText(volume.fill, unit)} lugn löpning`
                    : " · passen räcker"}
                </p>
              )}

              {(week.roundEnd || week.checkpoint) && (
                <div className="mb-4 space-y-2">
                  {week.roundEnd && (
                    <p className="flex gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] text-text">
                      <Flag
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0 text-accent"
                      />
                      <span>
                        Sista veckan i varv {week.round}: den slutar med ett
                        testlopp i stället för målet. Skriv in tiden efteråt –
                        den blir din nya formuppskattning inför nästa varv.
                      </span>
                    </p>
                  )}
                  {week.checkpoint && (
                    <p className="flex gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] text-text">
                      <Gauge
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0 text-accent"
                      />
                      <span>
                        Avstämning i slutet av veckan: stämmer
                        formuppskattningen? Ett test, ett lopp eller en ny tid
                        ger nya tempon från nästa vecka.
                      </span>
                    </p>
                  )}
                </div>
              )}

              <ol className="divide-y divide-line">
                {days.map((d) => (
                  <li
                    key={d.date}
                    className="grid gap-3 py-3 sm:grid-cols-[7rem_1fr]"
                  >
                    <p
                      className={cn(
                        "text-[13px] text-text-muted",
                        d.date === today && "font-semibold text-text",
                      )}
                    >
                      {DAY_LONG[weekdayIndex(d.date)][0].toUpperCase() +
                        DAY_LONG[weekdayIndex(d.date)].slice(1)}
                      <span className="block text-[12px] font-normal text-text-subtle">
                        {d.date === today ? "I dag" : dayMonth(d.date)}
                      </span>
                    </p>
                    {d.sessions.length === 0 ? (
                      <p className="text-[13px] text-text-subtle">
                        Vila eller fritt
                      </p>
                    ) : (
                      <ul className="grid gap-2 md:grid-cols-2">
                        {d.sessions.map(sessionItem)}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
              {flexible.length > 0 && (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="mb-2 text-[13px] text-text-muted">
                    Valfri dag i veckan
                  </p>
                  <ul className="grid gap-2 md:grid-cols-2">
                    {flexible.map(sessionItem)}
                  </ul>
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <CardTitle>Hela planen</CardTitle>
              <div className="overflow-x-auto print:hidden">
                <table className="w-full border-collapse text-sm whitespace-nowrap tabular-nums">
                  <thead>
                    <tr className="border-b border-line text-left text-[12px] text-text-muted">
                      <th className="py-2 pr-3 font-medium">Vecka</th>
                      {multi && <th className="py-2 pr-3 font-medium">Varv</th>}
                      <th className="py-2 pr-3 font-medium">Datum</th>
                      <th className="py-2 pr-3 font-medium">Fas</th>
                      <th className="py-2 pr-3 font-medium">Nivå</th>
                      <th className="py-2 pr-3 text-right font-medium">Pass</th>
                      <th className="py-2 pr-3 text-right font-medium">Tid</th>
                      {hasVolumes && (
                        <th className="py-2 pr-3 text-right font-medium">
                          Volym
                        </th>
                      )}
                      <th className="py-2 text-right font-medium">Genomfört</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((w) => {
                      const s = summarizeWeek(w, secondsOf);
                      return (
                        <tr
                          key={w.week}
                          className={cn(
                            "border-b border-line last:border-0",
                            w.week === view.currentWeek && "bg-surface-2",
                          )}
                        >
                          <td className="py-2 pr-3">
                            <Link
                              href={link({ vecka: w.week })}
                              className="text-text hover:text-accent"
                            >
                              {w.week}
                            </Link>
                          </td>
                          {multi && (
                            <td className="py-2 pr-3 text-text-muted">
                              {w.round}
                            </td>
                          )}
                          <td className="py-2 pr-3 text-text-muted">
                            {dayMonth(w.startsOn)}
                          </td>
                          <td className="py-2 pr-3 text-text-muted">
                            {
                              spans.find(
                                (x) =>
                                  w.week >= x.fromWeek && w.week <= x.toWeek,
                              )?.name
                            }
                            {w.kind !== "normal" && (
                              <span className="text-text-subtle">
                                {" "}
                                · {weekKindLabel(w.kind).toLowerCase()}
                              </span>
                            )}
                            {w.roundEnd && (
                              <span className="text-text-subtle">
                                {" "}
                                · testlopp
                              </span>
                            )}
                            {w.checkpoint && (
                              <span className="text-text-subtle">
                                {" "}
                                · avstämning
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-text">
                            {levelOf(w.levelId)?.key}
                          </td>
                          <td className="py-2 pr-3 text-right text-text-muted">
                            {s.planned}
                          </td>
                          <td className="py-2 pr-3 text-right text-text-muted">
                            {hoursMinutes(s.plannedSeconds)}
                          </td>
                          {hasVolumes && (
                            <td className="py-2 pr-3 text-right text-text-muted">
                              {w.volume ? volumeText(w.volume, unit) : ""}
                            </td>
                          )}
                          <td className="py-2 text-right text-text-muted">
                            {w.week <= view.currentWeek
                              ? `${s.done}/${s.planned}`
                              : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Utskriften: varje vecka med sina pass. */}
              <div className="hidden space-y-4 print:block">
                {schedule.map((w) => (
                  <section key={w.week} className="break-inside-avoid">
                    <h3 className="text-sm font-semibold">
                      Vecka {w.week} · {dayMonth(w.startsOn)} –{" "}
                      {dayMonth(w.endsOn)} ·{" "}
                      {
                        spans.find(
                          (x) => w.week >= x.fromWeek && w.week <= x.toWeek,
                        )?.name
                      }{" "}
                      · nivå {levelOf(w.levelId)?.key}
                      {w.volume ? ` · ${volumeText(w.volume, unit)}` : ""}
                      {w.roundEnd ? " · testlopp" : ""}
                      {w.checkpoint ? " · avstämning" : ""}
                    </h3>
                    <ul className="mt-1 text-[12px]">
                      {w.sessions
                        .filter((s) => s.state !== "struken")
                        .map((s) => (
                          <li key={s.key}>
                            {s.date
                              ? `${DAY_LONG[weekdayIndex(s.date)]}: `
                              : "Valfri dag: "}
                            {s.session.title}
                            {s.variant.durationS
                              ? `, ${hoursMinutes(s.variant.durationS)}`
                              : ""}
                            {s.variant.zone ? `, ${s.variant.zone}` : ""}
                            {s.variant.blocks
                              ? ` – ${structureText(s.variant, refs)}`
                              : ""}
                          </li>
                        ))}
                    </ul>
                  </section>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6 print:hidden">
          {usesPaces && (
            <Card>
              <CardTitle>Tempo</CardTitle>
              <PaceSource
                key={`${instance.pace_mode}-${instance.goal_seconds}`}
                instanceId={instance.id}
                editable={editable}
                mode={instance.pace_mode}
                goalSeconds={
                  instance.goal_seconds ? Number(instance.goal_seconds) : null
                }
                race={race}
                zoneSpeed={refs.MP ?? null}
                zones={zonesUsed}
                lt2={refs.LT2 ?? null}
              />
              <details
                open={instance.pace_mode === "form"}
                className="mt-5 border-t border-line pt-4"
              >
                <summary className="cursor-pointer text-sm font-medium text-text marker:text-text-subtle">
                  Formuppskattning
                  {instance.pace_mode === "mål" ? " (används inte nu)" : ""}
                </summary>
                <div className="mt-3">
                  <FitnessCard
                    adeptId={instance.adept_id}
                    editable={editable}
                    current={fitness.current}
                    fromTests={fitness.fromTests}
                    measured={fitness.measured}
                    race={raceByMetres(raceMetres)?.key ?? null}
                    entries={fitness.entries.map((e) => ({
                      id: e.id,
                      times: {
                        "5K": numOrUndefined(e.five_k_seconds),
                        "10K": numOrUndefined(e.ten_k_seconds),
                        HM: numOrUndefined(e.half_seconds),
                        M: numOrUndefined(e.marathon_seconds),
                      },
                      note: e.note,
                      createdAt: e.created_at,
                      own: e.created_by === userId,
                    }))}
                  />
                </div>
              </details>
            </Card>
          )}

          <Card>
            <CardTitle>Nivå</CardTitle>
            <LevelTimeline
              timeline={timeline}
              levels={levels}
              currentWeek={view.currentWeek}
              label="Nivån vecka för vecka"
            />
            {editable ? (
              <details className="group mt-4">
                <summary className="cursor-pointer text-sm font-medium text-text marker:text-text-subtle">
                  Byt nivå
                </summary>
                <div className="mt-3">
                  <LevelPanel
                    instanceId={instance.id}
                    levels={levels}
                    startLevelId={instance.start_level_id}
                    history={history}
                    currentWeek={view.currentWeek}
                    totalWeeks={instance.weeks}
                  />
                </div>
              </details>
            ) : null}
          </Card>

          {view.suggestions.length > 0 && (
            <Card>
              <CardTitle>Förslag från AI-coachen</CardTitle>
              <ul className="space-y-4">
                {view.suggestions.map((s) => (
                  <li key={s.id} className="space-y-2">
                    <p className="text-sm leading-relaxed text-text-muted">
                      {s.rationale}
                    </p>
                    {s.status === "föreslagen" && editable ? (
                      <SuggestionButtons
                        instanceId={instance.id}
                        suggestionId={s.id}
                      />
                    ) : (
                      <p className="text-[12px] text-text-subtle">
                        {s.status === "accepterad"
                          ? "Godkänt"
                          : s.status === "avvisad"
                            ? "Avvisat"
                            : s.status === "utgången"
                              ? "Inaktuellt"
                              : "Väntar"}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardTitle>Nivåhistorik</CardTitle>
            {history.length === 0 ? (
              <p className="text-sm text-text-muted">
                Startade på {levelOf(instance.start_level_id)?.key} ·{" "}
                {levelOf(instance.start_level_id)?.name}. Inga byten än.
              </p>
            ) : (
              <ol className="space-y-2.5 text-[13px]">
                <li className="text-text-subtle">
                  Start: {levelOf(instance.start_level_id)?.key} ·{" "}
                  {levelOf(instance.start_level_id)?.name}
                </li>
                {history.map((c) => (
                  <li
                    key={c.id}
                    className={cn(
                      "flex flex-wrap items-baseline gap-x-2",
                      c.revokedAt && "opacity-50",
                    )}
                  >
                    <span
                      className={cn("text-text", c.revokedAt && "line-through")}
                    >
                      Vecka {c.effectiveWeek}: {levelOf(c.fromLevelId)?.key} →{" "}
                      {levelOf(c.toLevelId)?.key}
                    </span>
                    <span className="text-text-subtle">
                      {KIND_LABEL[c.kind]} · {REASON_LABEL[c.reason]} ·{" "}
                      {SOURCE_LABEL[c.source]}
                      {c.revokedAt
                        ? " · ångrat"
                        : c.effectiveWeek > view.currentWeek
                          ? " · planerat"
                          : ""}
                    </span>
                    {editable &&
                      !c.revokedAt &&
                      c.effectiveWeek > view.currentWeek && (
                        <RevokeButton
                          instanceId={instance.id}
                          changeId={c.id}
                        />
                      )}
                    {c.note && (
                      <span className="basis-full text-[12px] text-text-muted">
                        {c.note}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {editable && (
            <Card>
              <CardTitle>Tillbaka efter ett uppehåll</CardTitle>
              {recentlyResumed && (
                <p className="mb-3 text-sm text-text">
                  Välkommen tillbaka – planen var pausad i {pausedDays} dagar.
                  Här är ett förslag på hur du kommer igång igen.
                </p>
              )}
              <details open={Boolean(recentlyResumed)}>
                <summary className="cursor-pointer text-sm font-medium text-text marker:text-text-subtle">
                  Föreslå nivå efter uppehåll
                </summary>
                <div className="mt-3">
                  <RestartCard
                    instanceId={instance.id}
                    levels={levels}
                    levelBeforeId={view.currentLevelId}
                    week={view.currentWeek}
                    totalWeeks={instance.weeks}
                    canShift={instance.goal_mode === "fritt"}
                    initialBreakDays={recentlyResumed ? pausedDays : 0}
                  />
                </div>
              </details>
            </Card>
          )}

          {editable && (
            <Card>
              <CardTitle>Avsluta</CardTitle>
              <EndPlanButtons instanceId={instance.id} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
