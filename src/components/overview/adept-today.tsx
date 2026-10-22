import Link from "next/link";

import { CallCard } from "@/components/calls/call-card";
import { PageHeader } from "@/components/page-header";
import { NextRaceCard } from "@/components/season/next-race-card";
import { PhaseNow } from "@/components/season/phase-now";
import { ConsentToggle } from "@/components/settings/settings-forms";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Card, CardHeadline, CardLabel, CardTitle } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric";
import { FitButton } from "@/components/workouts/fit-button";
import { StructureText } from "@/components/workouts/structure-text";
import { WorkoutProfileChart } from "@/components/workouts/workout-profile-chart";
import {
  listScheduledWorkouts,
  type CalendarWorkout,
} from "@/lib/calendar/queries";
import type { Sport } from "@/lib/calculators/lactate";
import { listCallsBetween } from "@/lib/calls/queries";
import { callState } from "@/lib/calls/time";
import { countUnread, listMessages } from "@/lib/messages/queries";
import { hoursMinutes } from "@/lib/plan-library/labels";
import { adeptHref, routes } from "@/lib/routes";
import { listBlocks, listRaces } from "@/lib/season/queries";
import {
  addDays,
  isoWeek,
  longDate,
  mondayOf,
  weekdayName,
} from "@/lib/season/season";
import { listStrengthSessions } from "@/lib/strength/queries";
import { entryText } from "@/lib/strength/strength";
import { lactateCurves, metricTrends } from "@/lib/tests/progression";
import { listFullSessions } from "@/lib/tests/session-queries";
import {
  READINESS_MAX,
  readReadiness,
  readinessScore,
} from "@/lib/training/load";
import { listCheckins, toCheckin } from "@/lib/training/queries";
import type { Adept, AdeptCheckinRow } from "@/lib/types/database";
import { ZONE_NAMES } from "@/lib/workouts/intensity";
import { getWorkout } from "@/lib/workouts/queries";
import { BASIS_LABEL, toWorkout, unitForSport } from "@/lib/workouts/schema";
import { formatPace } from "@/lib/tests/pace";
import { profileSeconds } from "@/lib/workouts/summary";
import { QuickCheckin } from "./quick-checkin";
import { ThresholdsCard } from "./thresholds-card";
import { WeekStrip } from "./week-strip";

const SPORT_TEXT: Record<Sport | "annat", string> = {
  löpning: "Löpning",
  cykling: "Cykel",
  simning: "Simning",
  annat: "Pass",
};

/** Passets längd: ur profilen när den finns, annars som den sparades. */
const timeOf = (w: CalendarWorkout) =>
  w.profile.length > 0
    ? hoursMinutes(profileSeconds(w.profile))
    : (w.duration ?? null);

/**
 * Adeptens Idag: dagens pass står överst som sidans rubrik och första kort,
 * bredvid incheckningen – det enda här som väntar på adepten. Sedan veckan
 * dag för dag, och sist läget: trösklarna, nästa tävling och styrkan.
 */
export async function AdeptToday({
  userId,
  adept,
  today,
  consentGiven,
}: {
  userId: string;
  adept: Adept;
  today: string;
  /** Samtycket till hälsouppgifter. Saknas det frågar sidan först. */
  consentGiven: boolean;
}) {
  const monday = mondayOf(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  // Serverns tid, så att samtalens läge blir detsamma i webbläsaren.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const [
    races,
    blocks,
    checkins,
    unread,
    workouts,
    sessions,
    strength,
    thread,
    calls,
  ] = await Promise.all([
    listRaces(adept.id),
    listBlocks(adept.id),
    listCheckins(adept.id, 14),
    countUnread(adept.id, userId),
    listScheduledWorkouts(monday, addDays(today, 13), adept.id),
    listFullSessions(adept.id),
    listStrengthSessions(adept.id),
    listMessages(adept.id, 20),
    // Samtal som pågår eller kommer de närmaste två veckorna.
    listCallsBetween(
      new Date(now - 2 * 3600_000).toISOString(),
      `${addDays(today, 14)}T23:59:59Z`,
      adept.id,
    ),
  ]);
  const nextCalls = calls.filter((c) => {
    const state = callState(c, now);
    return state !== "avslutat" && state !== "avbokat";
  });

  const own = `${routes.adepts}/${adept.id}`;
  const hrefFor = (w: CalendarWorkout) => w.href ?? `${own}/pass/${w.id}`;
  const todays = checkins.find((c) => c.performed_on === today) ?? null;
  const passToday = workouts.filter((w) => w.date === today);
  const upcoming = workouts.filter((w) => w.date > today);
  const raceToday = races.find((r) => r.race_date === today) ?? null;
  const thisWeek = workouts.filter((w) => w.date <= days[6]);
  const quality = thisWeek.filter(
    (w) => w.goal === "medel" || w.goal === "hög",
  ).length;
  const restDays = days.filter(
    (d) => !thisWeek.some((w) => w.date === d),
  ).length;
  const done = new Set(
    checkins.filter((c) => c.session_rpe !== null).map((c) => c.performed_on),
  );

  // Passen i dag som är coachens eller egna: de går till klockan härifrån.
  const saved = await Promise.all(
    passToday.filter((w) => !w.fromPlan).map((w) => getWorkout(w.id)),
  );

  // Trösklarna i grenen adepten senast testade.
  const latestTest = [...sessions].sort((a, b) =>
    b.performed_on.localeCompare(a.performed_on),
  )[0];
  const testSport = latestTest?.sport ?? null;
  const inSport = sessions.filter((s) => s.sport === testSport);
  const trends = testSport ? metricTrends(inSport, lactateCurves(inSport)) : [];

  const lastStrength = strength[0] ?? null;
  const strengthThisWeek = strength.filter(
    (s) => s.performed_on >= monday && s.performed_on <= today,
  ).length;
  const fromCoach =
    [...thread].reverse().find((m) => m.sender_id !== userId) ?? null;
  const main = passToday[0] ?? null;
  const next = upcoming[0] ?? null;

  const title = raceToday
    ? `${raceToday.name} i dag.`
    : main
      ? `${main.title} i dag.`
      : next
        ? "Vila i dag."
        : "Inget pass i dag.";
  const lead = raceToday
    ? raceToday.target
      ? `Målet: ${raceToday.target}.`
      : undefined
    : main
      ? (main.intent ?? main.summary ?? undefined)
      : next
        ? `Nästa pass: ${next.title.toLowerCase()}, ${weekdayName(next.date)}.`
        : "Inga pass med datum de närmaste två veckorna.";

  return (
    <>
      <PageHeader
        size="lg"
        eyebrow={`${weekdayName(today)} ${longDate(today, today)} · vecka ${isoWeek(today)}`}
        title={title}
        description={lead}
      />

      <div className="space-y-6">
        {!consentGiven && (
          <Card className="min-w-0 border-accent/50">
            <CardTitle>Samtycke till hälsouppgifter</CardTitle>
            <div className="space-y-4">
              <p className="max-w-3xl text-sm leading-relaxed text-text-muted">
                Laktat, puls, syreupptag, kroppssammansättning, sömn och skador
                är hälsouppgifter. För att din coach ska få följa dem i appen
                behöver du samtycka till det. Samtycket kan tas tillbaka när som
                helst under Inställningar.
              </p>
              <ConsentToggle given={false} />
            </div>
          </Card>
        )}

        {nextCalls.length > 0 && (
          <Card className="min-w-0">
            <CardLabel
              aside={
                <Link
                  href={adeptHref(adept.id, "meddelanden")}
                  className="hover:text-text"
                >
                  Meddelanden →
                </Link>
              }
            >
              Videosamtal
            </CardLabel>
            <ul className="mt-4 divide-y divide-line">
              {nextCalls.slice(0, 3).map((call) => (
                <li key={call.id} className="py-3 first:pt-0 last:pb-0">
                  <CallCard call={call} now={now} compact />
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
            {main ? (
              passToday.map((w, i) => (
                <TodayWorkout
                  key={w.id}
                  workout={w}
                  href={hrefFor(w)}
                  saved={saved.find((s) => s?.id === w.id) ?? null}
                  ownWorkout={
                    saved.find((s) => s?.id === w.id)?.created_by ===
                    adept.profile_id
                  }
                  primary={i === 0}
                />
              ))
            ) : next ? (
              <TodayWorkout
                workout={next}
                href={hrefFor(next)}
                saved={null}
                upcomingLabel={`Nästa pass · ${weekdayName(next.date)} ${longDate(next.date, today)}`}
              />
            ) : (
              <Card level="lead">
                <CardLabel>Dagens pass</CardLabel>
                <CardHeadline>Inga pass inlagda.</CardHeadline>
                <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-text-muted">
                  När din coach lägger in pass, eller du startar en plan ur
                  planbiblioteket, står dagens pass här.
                </p>
              </Card>
            )}
          </div>

          <div className="min-w-0 space-y-6">
            <Card className="min-w-0">
              <CheckinPanel
                adeptId={adept.id}
                today={today}
                todays={todays}
                trainsToday={passToday.length > 0}
              />
            </Card>
            <Card className="min-w-0">
              <PhaseNow blocks={blocks} today={today} />
            </Card>
          </div>
        </div>

        {fromCoach && (
          <Card className="min-w-0">
            <CardLabel
              aside={
                <span className="flex items-center gap-3">
                  {unread > 0 && (
                    <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[0.75rem] font-medium text-text tabular-nums">
                      {unread} {unread === 1 ? "oläst" : "olästa"}
                    </span>
                  )}
                  {longDate(fromCoach.created_at.slice(0, 10), today)}
                </span>
              }
            >
              Från din coach
            </CardLabel>
            <Link
              href={adeptHref(adept.id, "meddelanden")}
              className="group mt-3 block"
            >
              <p className="line-clamp-3 max-w-3xl whitespace-pre-line text-base leading-relaxed text-text">
                {fromCoach.body}
              </p>
              <p className="mt-2 text-[0.8125rem] text-text-muted group-hover:text-text">
                Svara →
              </p>
            </Link>
          </Card>
        )}

        <Card className="min-w-0">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="flex flex-wrap items-baseline gap-x-3 text-[1.0625rem] font-semibold tracking-[-0.01em] text-text">
              Veckan
              <span className="text-sm font-normal text-text-muted">
                {thisWeek.length} pass · {quality} kvalitet · {restDays}{" "}
                {restDays === 1 ? "vilodag" : "vilodagar"}
              </span>
            </h2>
            <Link
              href={routes.calendar}
              className="text-[0.8125rem] text-text-muted hover:text-text"
            >
              Kalender →
            </Link>
          </div>
          <WeekStrip
            days={days}
            workouts={thisWeek}
            done={done}
            today={today}
            hrefFor={hrefFor}
          />
        </Card>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <ThresholdsCard
            trends={trends}
            sport={testSport}
            today={today}
            href={routes.progression}
          />

          <NextRaceCard races={races} today={today} href={routes.plans} />

          <Card className="flex min-w-0 flex-col md:col-span-2 xl:col-span-1">
            <CardLabel
              aside={
                <Link href={routes.strength} className="hover:text-text">
                  Progressionen →
                </Link>
              }
            >
              Styrka
            </CardLabel>
            <CardHeadline>
              {lastStrength
                ? strengthThisWeek === 0
                  ? "Inget styrkepass än den här veckan."
                  : `${strengthThisWeek} ${strengthThisWeek === 1 ? "pass" : "pass"} den här veckan.`
                : "Logga styrkan här, inte i en kommentar."}
            </CardHeadline>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-text-muted">
              {lastStrength
                ? `Senast ${longDate(lastStrength.performed_on, today)}: ${
                    lastStrength.exercises
                      .filter((e) => e.weightKg !== null)
                      .slice(0, 2)
                      .map((e) => `${e.name.toLowerCase()} ${entryText(e)}`)
                      .join(", ") ||
                    lastStrength.exercises
                      .slice(0, 3)
                      .map((e) => e.name.toLowerCase())
                      .join(", ")
                  }.`
                : "Då ser du och din coach progressionen per övning."}
            </p>
            <div className="mt-auto pt-6">
              <ButtonLink href={routes.strength} variant="secondary">
                Logga styrkepass
              </ButtonLink>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

/** Dagens pass som ledkort: brickor, nyckeltal, profil, struktur, knappar. */
function TodayWorkout({
  workout: w,
  href,
  saved,
  ownWorkout = false,
  primary = true,
  upcomingLabel,
}: {
  workout: CalendarWorkout;
  href: string;
  saved: Awaited<ReturnType<typeof getWorkout>>;
  ownWorkout?: boolean;
  primary?: boolean;
  /** Ett kommande pass i stället för dagens: etiketten säger när. */
  upcomingLabel?: string;
}) {
  const zoneName = w.zone ? ZONE_NAMES[w.zone] : null;
  const typeText =
    w.type ?? (w.goal === "lugn" ? "Lugnt" : w.goal ? "Kvalitet" : null);
  // "Distans" som typ och "Z2 Distans" som zon säger samma sak två gånger.
  const kind =
    typeText && typeText.toLowerCase() !== zoneName?.toLowerCase()
      ? typeText
      : null;
  const target = w.work && w.structure ? workTarget(w.structure) : null;
  const source = w.fromPlan
    ? "Från planen"
    : saved
      ? ownWorkout
        ? "Eget pass"
        : "Från coachen"
      : null;
  const time = timeOf(w);
  const reference =
    saved && saved.reference > 0
      ? unitForSport(saved.sport) === "W"
        ? `${Math.round(saved.reference)} W`
        : `${formatPace(saved.reference, saved.sport)} ${saved.sport === "simning" ? "/100 m" : "/km"}`
      : null;

  return (
    <section
      aria-label={upcomingLabel ?? "Dagens pass"}
      className="lift flex min-w-0 flex-1 flex-col rounded-lg border border-line-strong bg-surface-2 p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip>{SPORT_TEXT[w.sport]}</Chip>
          {kind && <Chip>{kind}</Chip>}
          {w.zone && (
            <Chip zone={w.zone}>
              Z{w.zone} {ZONE_NAMES[w.zone]}
            </Chip>
          )}
        </div>
        {(upcomingLabel || source) && (
          <p className="eyebrow text-text-subtle">{upcomingLabel ?? source}</p>
        )}
      </div>

      {upcomingLabel && (
        <p className="headline mt-5 text-[clamp(1.75rem,1.4rem+1vw,2.25rem)] text-text">
          {w.title}
        </p>
      )}

      <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-6 sm:flex sm:flex-wrap sm:gap-x-10">
        {w.work && (
          <Metric
            label="Arbete"
            value={splitUnit(w.work).value}
            unit={splitUnit(w.work).unit}
            size="xl"
          />
        )}
        {time && (
          <Metric
            label={w.work ? "Totalt" : "Tid"}
            value={splitUnit(time).value}
            unit={splitUnit(time).unit}
            size="xl"
          />
        )}
        {target && (
          <Metric
            label="Mål"
            value={target.replace(/ %$/, "")}
            unit={
              target.endsWith("%")
                ? saved
                  ? `% av ${BASIS_LABEL[saved.basis]}`
                  : "%"
                : undefined
            }
            size="xl"
          />
        )}
      </div>

      <WorkoutProfileChart blocks={w.profile} className="mt-8" />

      {w.structure && (
        <div className="mt-5">
          <StructureText text={w.structure} basis={saved?.basis ?? null} />
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-7">
        {saved && primary && !upcomingLabel && (
          <FitButton workout={toWorkout(saved)} reference={saved.reference} />
        )}
        <ButtonLink href={href} variant="secondary">
          Öppna passet
        </ButtonLink>
        {reference && saved && (
          <p className="ml-auto text-[0.8125rem] text-text-subtle">
            Zonerna räknas mot {BASIS_LABEL[saved.basis]} {reference}
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Talet och enheten isär, så att enheten kan stå liten bredvid:
 * "3×5 min" → "3×5" och "min", "1 h 15 min" → "1 h 15" och "min".
 */
function splitUnit(text: string): { value: string; unit?: string } {
  const match = text.match(/^(.*\S)\s+(min|h|s|m|km)$/);
  return match ? { value: match[1], unit: match[2] } : { value: text };
}

/**
 * Målet för arbetet ur strukturraden: det första målet i repetitionen, som
 * "HM–10K" eller "105 %".
 */
function workTarget(structure: string): string | null {
  const inner = structure.match(/\d+x\(([^)]*)\)/)?.[1];
  const token = inner?.match(
    /@[A-Za-z0-9]+(?:-[A-Za-z0-9]+)?|\d+(?:[.,]\d+)?(?:-\d+(?:[.,]\d+)?)?%/,
  )?.[0];
  if (!token) return null;
  return token.startsWith("@")
    ? token.slice(1).replace("-", "–")
    : token.replace("-", "–").replace("%", " %");
}

/** Incheckningen: frågorna när den inte är gjord, läget när den är det. */
function CheckinPanel({
  adeptId,
  today,
  todays,
  trainsToday,
}: {
  adeptId: string;
  today: string;
  todays: AdeptCheckinRow | null;
  trainsToday: boolean;
}) {
  const readiness = todays ? readinessScore(toCheckin(todays)) : null;
  if (!todays || readiness === null) {
    return (
      <>
        <CardLabel aside="≈ 1 min">Incheckning</CardLabel>
        <CardHeadline>Hur mår du i dag?</CardHeadline>
        <QuickCheckin
          adeptId={adeptId}
          today={today}
          initial={
            todays
              ? {
                  sleep: todays.sleep,
                  fatigue: todays.fatigue,
                  soreness: todays.soreness,
                  stress: todays.stress,
                }
              : undefined
          }
        />
      </>
    );
  }
  const logged = todays.session_rpe !== null;
  return (
    <>
      <CardLabel aside="klar">Incheckning</CardLabel>
      <CardHeadline>
        {readiness} av {READINESS_MAX}.
      </CardHeadline>
      <p className="mt-3 text-[0.9375rem] text-text-muted">
        {readReadiness(readiness)} i dag.
        {logged
          ? ` Passet: RPE ${Number(todays.session_rpe)} i ${Number(todays.duration_minutes)} min.`
          : ""}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {!logged && trainsToday && (
          <ButtonLink
            href={`${adeptHref(adeptId, "maende")}?pass=1#incheckning`}
            variant="secondary"
          >
            Logga passet
          </ButtonLink>
        )}
        <ButtonLink
          href={`${adeptHref(adeptId, "maende")}#incheckning`}
          variant="ghost"
        >
          Ändra
        </ButtonLink>
      </div>
    </>
  );
}
