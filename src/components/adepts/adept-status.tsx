import Link from "next/link";
import {
  ArrowRight,
  BatteryLow,
  CalendarClock,
  Check,
  Dumbbell,
  Flag,
  HeartPulse,
  MessageSquare,
  MoonStar,
  TrendingUp,
  Video,
  Zap,
} from "lucide-react";

import { SportIcon, TestIcon } from "@/components/calendar/calendar-items";
import { GoalBreakdown } from "@/components/season/distribution-card";
import { blockLabel } from "@/components/season/phase-style";
import { NextRaceCard } from "@/components/season/next-race-card";
import { PhaseNow } from "@/components/season/phase-now";
import { WorkoutStrip } from "@/components/workouts/workout-strip";
import { ZoneSuggestionCard } from "@/components/tests/zone-suggestion-card";
import { listDoneGoals } from "@/lib/activities/intensity-queries";
import { listCallsBetween } from "@/lib/calls/queries";
import { callDate, callTime } from "@/lib/calls/time";
import { Card, CardHeadline, CardLabel, CardTitle } from "@/components/ui/card";
import { Unit } from "@/components/ui/metric";
import { loadTrend } from "@/lib/activities/load";
import { listLoadActivities } from "@/lib/activities/load-queries";
import { listActivities } from "@/lib/activities/queries";
import { listScheduledWorkouts } from "@/lib/calendar/queries";
import { countUnread } from "@/lib/messages/queries";
import {
  attentionFor,
  daysAgo,
  readinessSummary,
  type AttentionKind,
} from "@/lib/overview/attention";
import { adeptHref, routes } from "@/lib/routes";
import {
  blockDistribution,
  doneDistribution,
  phaseTarget,
  raceDemand,
  sessionGoal,
} from "@/lib/season/distribution";
import { listBlocks, listRaces } from "@/lib/season/queries";
import {
  addDays,
  blockOn,
  isoWeek,
  longDate,
  mainRace,
  mondayOf,
  weekdayName,
} from "@/lib/season/season";
import type { Sport } from "@/lib/calculators/lactate";
import { listStrengthSessions } from "@/lib/strength/queries";
import { sessionHeadline } from "@/lib/tests/headline";
import { assessLsct, lsctResult } from "@/lib/tests/lsct";
import {
  lactateCurves,
  latestUtilisation,
  utilisationDiagnosis,
} from "@/lib/tests/progression";
import { protocolByKey } from "@/lib/tests/protocols";
import { listFullSessions } from "@/lib/tests/session-queries";
import { READINESS_MAX } from "@/lib/training/load";
import { listCheckins, toCheckin } from "@/lib/training/queries";
import type { Adept } from "@/lib/types/database";
import { listWorkouts } from "@/lib/workouts/queries";

type Item = {
  key: string;
  weight: 1 | 2 | 3;
  text: string;
  href: string;
  icon: typeof ArrowRight;
};

const ICONS: Record<AttentionKind, typeof ArrowRight> = {
  återhämtning: BatteryLow,
  belastning: TrendingUp,
  meddelanden: MessageSquare,
  tystnad: MoonStar,
  toppning: CalendarClock,
  tävling: Flag,
};

/** Strain som nämns: minst 50 % över snittveckan månaden före. */
const STRAIN_JUMP = 1.5;

/** Ett LSCT säger något om formen den närmaste veckan, inte längre. */
const LSCT_FRESH_DAYS = 10;

const SPORTS: Sport[] = ["cykling", "löpning", "simning"];
const sportOf = (raw: string): Sport | "annat" =>
  SPORTS.includes(raw as Sport) ? (raw as Sport) : "annat";

const hours = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
};

/**
 * Läget hos en adept, för coachen: det som är värt en titt först, sedan var i
 * säsongen adepten är, veckan som den ser ut, periodens fördelning och det
 * senaste testet. Varje del leder vidare till fliken med mer.
 *
 * Det som nämns är konstateranden med sitt tal – återhämtningen mot adeptens
 * eget snitt, LSCT mot den egna normen – och vad det betyder är coachens
 * bedömning.
 */
export async function AdeptStatus({
  adept,
  viewerId,
  today,
  canDecide = false,
}: {
  adept: Adept;
  viewerId: string;
  today: string;
  /** Coachen som får godkänna zonförslag ur träningen. */
  canDecide?: boolean;
}) {
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const [
    blocks,
    races,
    checkinRows,
    unread,
    week,
    activities,
    strength,
    sessions,
    workouts,
    load,
    calls,
  ] = await Promise.all([
    listBlocks(adept.id),
    listRaces(adept.id),
    listCheckins(adept.id, 60),
    countUnread(adept.id, viewerId),
    listScheduledWorkouts(monday, sunday, adept.id),
    listActivities(adept.id),
    listStrengthSessions(adept.id),
    listFullSessions(adept.id),
    listWorkouts(adept.id),
    // Fem veckor: senaste veckan mot de fyra före.
    listLoadActivities(adept.id, addDays(today, -34)),
    // Bokade samtal i dag och i morgon.
    listCallsBetween(
      `${addDays(today, -1)}T00:00:00Z`,
      `${addDays(today, 2)}T23:59:59Z`,
      adept.id,
    ),
  ]);
  const checkins = checkinRows.map(toCheckin);

  // Det som är värt en titt.
  const items: Item[] = attentionFor({
    checkins,
    unread,
    races,
    blocks,
    today,
  }).map((a) => ({
    key: a.kind + a.text,
    weight: a.weight,
    text: a.text,
    icon: ICONS[a.kind],
    href:
      a.target === "plan"
        ? adeptHref(adept.id, "plan")
        : adeptHref(adept.id, a.target),
  }));

  const lsctSessions = sessions.filter((s) => s.protocol === "lsct");
  const lastLsct = lsctSessions[0];
  if (lastLsct && addDays(lastLsct.performed_on, LSCT_FRESH_DAYS) >= today) {
    const assessment = assessLsct(
      lsctResult(lastLsct),
      lsctSessions.map(lsctResult),
    );
    if (assessment.verdict === "vila" || assessment.verdict === "bevaka") {
      items.push({
        key: "lsct",
        weight: assessment.verdict === "vila" ? 3 : 2,
        text: `LSCT ${daysAgo(lastLsct.performed_on, today)}: ${assessment.summary}`,
        icon: HeartPulse,
        href: `${routes.adepts}/${adept.id}/test/${lastLsct.id}`,
      });
    }
  }
  // Strain som stigit tydligt: mer arbete över tröskeln än adepten brukar.
  const trend = loadTrend(load, today);
  if (
    trend.strainRatio !== null &&
    trend.strainRatio >= STRAIN_JUMP &&
    trend.recent.strain >= 1
  ) {
    items.push({
      key: "strain",
      weight: 2,
      text: `Strain ${trend.recent.strain.toFixed(1).replace(".", ",")} W′ senaste sju dagarna – ${Math.round((trend.strainRatio - 1) * 100)} % över snittveckan månaden före${
        trend.volumeRatio !== null && trend.volumeRatio < 1.2
          ? ", med volymen i samma nivå"
          : ""
      }.`,
      icon: Zap,
      href: adeptHref(adept.id, "traning"),
    });
  }
  // Videosamtal i dag eller i morgon, i svensk tid.
  for (const call of calls) {
    const day = callDate(call.starts_at);
    if (day !== today && day !== addDays(today, 1)) continue;
    items.push({
      key: `call-${call.id}`,
      weight: 1,
      text: `Videosamtal ${day === today ? "i dag" : "i morgon"} kl. ${callTime(call.starts_at)}${call.topic ? ` – ${call.topic}` : ""}.`,
      icon: Video,
      href: adeptHref(adept.id, "meddelanden"),
    });
  }
  items.sort((a, b) => b.weight - a.weight);

  // Veckan: det planerade och det gjorda, dag för dag.
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const done = activities.filter(
    (a) => a.performed_on >= monday && a.performed_on <= sunday,
  );
  const lifted = strength.filter(
    (s) => s.performed_on >= monday && s.performed_on <= sunday,
  );
  const raceDays = races.filter(
    (r) => r.race_date >= monday && r.race_date <= sunday,
  );
  const weekStrain = load
    .filter((a) => a.performed_on >= monday && a.performed_on <= sunday)
    .reduce((sum, a) => sum + (a.strain ?? 0), 0);
  const doneSeconds = done.reduce(
    (sum, a) => sum + (a.moving_s ?? a.duration_s ?? 0),
    0,
  );

  // Periodens fördelning, mot fasens riktmärke.
  const block = blockOn(blocks, today);
  const planned = workouts.flatMap((w) =>
    w.scheduled_for
      ? [{ date: w.scheduled_for, goal: sessionGoal(w, w.reference) }]
      : [],
  );
  const counts = block ? blockDistribution(block, planned) : null;
  // Det som faktiskt gjordes i perioden, klassat på samma sätt.
  const doneInBlock = block
    ? doneDistribution(
        block,
        await listDoneGoals(
          adept.id,
          block.starts_on,
          today < block.ends_on ? today : block.ends_on,
        ),
      )
    : null;
  // I den specifika perioden avgör loppet vilken kvalitet som ska växa.
  const race =
    block?.phase === "specifik" ? mainRace(races, block.starts_on) : null;
  const target = block
    ? phaseTarget(block, race ? raceDemand(race) : null)
    : null;

  // Senaste test och var tröskeln begränsas.
  const latest = sessions.find((s) => s.protocol !== "lsct") ?? null;
  const utilisation = latestUtilisation(sessions, lactateCurves(sessions));
  const diagnosis = utilisation ? utilisationDiagnosis(utilisation) : null;

  const readiness = readinessSummary(checkins);
  const lastStrength = strength[0] ?? null;

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="att-titta-pa"
        className="lift rounded-lg border border-line-strong bg-surface-2 p-5 sm:p-7"
      >
        <h2 id="att-titta-pa" className="eyebrow text-text-subtle">
          Värt en titt
        </h2>
        <p className="headline mt-3 text-[clamp(1.75rem,1.4rem+1vw,2.25rem)] leading-[1.05] text-text">
          {items.length === 0
            ? "Inget som sticker ut."
            : items.length === 1
              ? "En sak att titta på."
              : `${items.length} saker att titta på.`}
        </p>
        {items.length === 0 ? (
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-text-muted">
            Inget som sticker ut just nu: återhämtningen ligger kring sitt
            vanliga, belastningen har inte ändrats tydligt och det finns inga
            olästa meddelanden.
          </p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="group flex items-start gap-2.5 text-[15px] text-text hover:underline"
                  >
                    <Icon
                      aria-hidden
                      className={
                        item.weight === 3
                          ? "mt-0.5 size-4 shrink-0 text-bad"
                          : item.weight === 2
                            ? "mt-0.5 size-4 shrink-0 text-warn"
                            : "mt-0.5 size-4 shrink-0 text-text-subtle"
                      }
                    />
                    <span>{item.text}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {canDecide && <ZoneSuggestionCard adeptId={adept.id} today={today} />}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="min-w-0">
          <PhaseNow blocks={blocks} today={today} />
        </Card>
        <NextRaceCard
          races={races}
          today={today}
          href={adeptHref(adept.id, "plan")}
        />
      </div>

      <Card className="min-w-0">
        <CardTitle
          action={
            <Link
              href={routes.calendar}
              className="text-[13px] text-text-muted hover:text-text"
            >
              Kalender →
            </Link>
          }
        >
          Vecka {isoWeek(today)}
        </CardTitle>
        <p className="-mt-3 mb-5 text-sm text-text-muted tabular-nums">
          {week.length} {week.length === 1 ? "pass planerat" : "pass planerade"}{" "}
          · {done.length} {done.length === 1 ? "aktivitet" : "aktiviteter"} ur
          klockan
          {doneSeconds > 0 ? `, ${hours(doneSeconds)}` : ""}
          {weekStrain > 0
            ? ` · strain ${weekStrain.toFixed(1).replace(".", ",")} W′`
            : ""}
          {lifted.length > 0 ? ` · ${lifted.length} styrka` : ""}
        </p>
        <ol className="grid gap-2 sm:grid-cols-7">
          {days.map((day) => {
            const planned = week.filter((w) => w.date === day);
            const did = done.filter((a) => a.performed_on === day);
            const gym = lifted.filter((s) => s.performed_on === day);
            const race = raceDays.filter((r) => r.race_date === day);
            const empty =
              planned.length + did.length + gym.length + race.length === 0;
            return (
              <li
                key={day}
                className={
                  day === today
                    ? "grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] gap-2 rounded-md border border-line-strong bg-surface-2 p-2.5 sm:block sm:min-h-32"
                    : "grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] gap-2 rounded-md border border-line bg-canvas/30 p-2.5 sm:block sm:min-h-32"
                }
              >
                <p
                  className={
                    day === today
                      ? "eyebrow text-accent-text"
                      : "eyebrow text-text-subtle"
                  }
                >
                  {weekdayName(day).slice(0, 3)} {Number(day.slice(8))}
                </p>
                <ul className="space-y-1.5 sm:mt-3">
                  {race.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={adeptHref(adept.id, "plan")}
                        className="flex items-center gap-1.5 rounded bg-surface-3 px-1.5 py-1 text-[12px] font-medium text-text"
                      >
                        <Flag aria-hidden className="size-3 shrink-0" />
                        <span className="line-clamp-2 break-words">
                          {r.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                  {planned.map((w) => (
                    <li key={w.id}>
                      <Link
                        href={
                          w.href ?? `${routes.adepts}/${adept.id}/pass/${w.id}`
                        }
                        title={w.title}
                        className="block rounded px-0.5 py-0.5 text-[12px] leading-snug text-text-muted hover:text-text"
                      >
                        <WorkoutStrip
                          blocks={w.profile}
                          className="mb-1.5 h-4"
                        />
                        <span className="flex items-start gap-1.5">
                          <SportIcon
                            sport={w.sport}
                            className="mt-0.5 size-3 shrink-0 text-text-subtle"
                          />
                          <span className="line-clamp-2 break-words">
                            {w.title}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                  {did.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`${routes.adepts}/${adept.id}/aktivitet/${a.id}`}
                        title={a.name}
                        className="flex items-center gap-1.5 px-1.5 py-0.5 text-[12px] text-text hover:underline"
                      >
                        <Check
                          aria-hidden
                          className="size-3 shrink-0 text-good"
                        />
                        <SportIcon
                          sport={sportOf(a.sport)}
                          className="size-3 shrink-0 text-text-subtle"
                        />
                        <span className="truncate tabular-nums">
                          {(a.moving_s ?? a.duration_s)
                            ? hours(a.moving_s ?? a.duration_s ?? 0)
                            : a.name}
                        </span>
                        <span className="sr-only"> genomfört: {a.name}</span>
                      </Link>
                    </li>
                  ))}
                  {gym.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={adeptHref(adept.id, "styrka")}
                        className="flex items-center gap-1.5 px-1.5 py-0.5 text-[12px] text-text hover:underline"
                      >
                        <Check
                          aria-hidden
                          className="size-3 shrink-0 text-good"
                        />
                        <Dumbbell
                          aria-hidden
                          className="size-3 shrink-0 text-text-subtle"
                        />
                        <span className="truncate">Styrka</span>
                      </Link>
                    </li>
                  ))}
                  {empty && (
                    <li className="px-1.5 text-[12px] text-text-subtle">–</li>
                  )}
                </ul>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="min-w-0">
          <CardTitle
            action={
              <Link
                href={adeptHref(adept.id, "plan")}
                className="text-[13px] text-text-muted hover:text-text"
              >
                Planen
              </Link>
            }
          >
            Fördelning i perioden
          </CardTitle>
          {!block || !counts || !target ? (
            <p className="text-sm text-text-muted">
              Ingen period pågår. Lägg upp säsongens perioder under Plan, så
              räknas de planerade passen mot fasens riktmärke.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-text">
                {blockLabel(block)}
                <span className="ml-1.5 text-[13px] text-text-muted">
                  {target.model}
                </span>
              </p>
              <GoalBreakdown
                label="Planerat"
                counts={counts}
                target={target}
                empty="Inga pass inplanerade i perioden ännu."
              />
              {doneInBlock && (
                <GoalBreakdown
                  label="Genomfört"
                  counts={doneInBlock.counts}
                  target={target}
                  empty="Inga klassade pass ur klockan i perioden ännu."
                />
              )}
            </div>
          )}
        </Card>

        <Card className="min-w-0">
          <CardTitle
            action={
              <Link
                href={adeptHref(adept.id, "tester")}
                className="text-[13px] text-text-muted hover:text-text"
              >
                Alla tester
              </Link>
            }
          >
            Senaste test
          </CardTitle>
          {latest ? (
            <Link
              href={`${routes.adepts}/${adept.id}/test/${latest.id}`}
              className="group flex items-start gap-2.5"
            >
              <TestIcon className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-text group-hover:underline">
                  {protocolByKey(latest.protocol)?.label ?? latest.protocol}
                </span>
                <span className="block text-[13px] text-text-muted">
                  {longDate(latest.performed_on, today)}
                  {sessionHeadline(latest.test_metrics, latest.sport)
                    ? ` · ${sessionHeadline(latest.test_metrics, latest.sport)}`
                    : ""}
                </span>
              </span>
            </Link>
          ) : (
            <p className="text-sm text-text-muted">
              Inga tester registrerade ännu.
            </p>
          )}
          {diagnosis && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-sm font-medium text-text">
                {diagnosis.headline}
              </p>
              <p className="text-[13px] text-text-muted tabular-nums">
                {diagnosis.label} på {Math.round(diagnosis.pct)} % av VO₂max
              </p>
            </div>
          )}
        </Card>

        <Card className="min-w-0">
          <CardLabel
            aside={
              <Link
                href={adeptHref(adept.id, "maende")}
                className="hover:text-text"
              >
                Mående →
              </Link>
            }
          >
            Återhämtning
          </CardLabel>
          {readiness ? (
            <>
              <p className="mt-4 text-[2.75rem] font-light leading-none tracking-[-0.035em] text-text tabular-nums">
                {readiness.score}
                <Unit>av {READINESS_MAX}</Unit>
              </p>
              <p className="mt-3 text-[13px] text-text-muted">
                {daysAgo(readiness.date, today)}
                {readiness.baseline !== null
                  ? ` · brukar ligga runt ${readiness.baseline.toFixed(1).replace(".", ",")}`
                  : " · för få incheckningar för en egen baslinje"}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-text-muted">
              Inga incheckningar de senaste två månaderna.
            </p>
          )}
        </Card>

        <Card className="min-w-0">
          <CardLabel
            aside={
              <Link
                href={adeptHref(adept.id, "styrka")}
                className="hover:text-text"
              >
                Styrkeloggen →
              </Link>
            }
          >
            Styrka
          </CardLabel>
          {lastStrength ? (
            <>
              <CardHeadline>
                {lifted.length === 0
                  ? "Inget pass den här veckan."
                  : `${lifted.length} pass den här veckan.`}
              </CardHeadline>
              <p className="mt-3 text-[13px] text-text-muted">
                Senast {longDate(lastStrength.performed_on, today)}:{" "}
                {lastStrength.title || "styrkepass"}.
              </p>
            </>
          ) : (
            <CardHeadline>Inga pass loggade än.</CardHeadline>
          )}
        </Card>
      </div>
    </div>
  );
}
