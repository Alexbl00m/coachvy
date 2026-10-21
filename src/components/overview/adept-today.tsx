import Link from "next/link";
import { Flag, MessageSquare } from "lucide-react";

import { SportIcon, TestIcon } from "@/components/calendar/calendar-items";
import { SeasonSummary } from "@/components/season/season-summary";
import { ConsentToggle } from "@/components/settings/settings-forms";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { WorkoutStrip } from "@/components/workouts/workout-strip";
import { listScheduledWorkouts } from "@/lib/calendar/queries";
import { countUnread, listMessages } from "@/lib/messages/queries";
import { adeptHref, routes } from "@/lib/routes";
import { listBlocks, listRaces } from "@/lib/season/queries";
import { addDays, longDate, mondayOf, weekdayName } from "@/lib/season/season";
import { sessionHeadline } from "@/lib/tests/headline";
import { protocolByKey } from "@/lib/tests/protocols";
import { listStrengthSessions } from "@/lib/strength/queries";
import { entryText } from "@/lib/strength/strength";
import { listSessions } from "@/lib/tests/session-queries";
import {
  READINESS_MAX,
  readReadiness,
  readinessScore,
} from "@/lib/training/load";
import { listCheckins, toCheckin } from "@/lib/training/queries";
import type { Adept } from "@/lib/types/database";

/**
 * Adeptens Idag: det adepten öppnar appen för står först – dagens pass och
 * incheckningen – sedan det coachen skrivit, och därefter veckan som kommer,
 * säsongen, styrkan och senaste testet.
 *
 * Incheckningen är sidans enda primära knapp: den är det enda här som väntar
 * på adepten.
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
  const [
    races,
    blocks,
    checkins,
    unread,
    workouts,
    sessions,
    strength,
    thread,
  ] = await Promise.all([
    listRaces(adept.id),
    listBlocks(adept.id),
    listCheckins(adept.id, 14),
    countUnread(adept.id, userId),
    listScheduledWorkouts(today, addDays(today, 13), adept.id),
    listSessions(adept.id),
    listStrengthSessions(adept.id),
    listMessages(adept.id, 20),
  ]);

  const todays = checkins.find((c) => c.performed_on === today) ?? null;
  const readiness = todays ? readinessScore(toCheckin(todays)) : null;
  const passToday = workouts.filter((w) => w.date === today);
  const upcoming = workouts.filter((w) => w.date > today);
  const raceToday = races.filter((r) => r.race_date === today);
  const latest = sessions[0] ?? null;
  const lastStrength = strength[0] ?? null;
  const strengthThisWeek = strength.filter(
    (s) => s.performed_on >= monday && s.performed_on <= today,
  ).length;
  // Det senaste coachen skrivit; adeptens egna svar står i tråden.
  const fromCoach =
    [...thread].reverse().find((m) => m.sender_id !== userId) ?? null;
  const own = `${routes.adepts}/${adept.id}`;
  const dayText = (date: string) =>
    `${weekdayName(date)} ${longDate(date, today)}`;

  return (
    <div className="space-y-6">
      {!consentGiven && (
        <Card className="min-w-0 border-accent/50">
          <CardTitle>Samtycke till hälsouppgifter</CardTitle>
          <div className="space-y-4">
            <p className="max-w-3xl text-sm leading-relaxed text-text-muted">
              Laktat, puls, syreupptag, kroppssammansättning, sömn och skador är
              hälsouppgifter. För att din coach ska få följa dem i appen behöver
              du samtycka till det. Samtycket kan tas tillbaka när som helst
              under Inställningar.
            </p>
            <ConsentToggle given={false} />
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section
          aria-labelledby="dagens-pass"
          className="min-w-0 rounded-lg border border-line-strong bg-surface-2 p-5 sm:p-6 lg:col-span-2"
        >
          <h2
            id="dagens-pass"
            className="text-[13px] font-medium text-text-muted"
          >
            {raceToday.length > 0 ? "Tävlingsdag" : "Dagens pass"}
          </h2>
          {raceToday.map((r) => (
            <p
              key={r.id}
              className="mt-2 flex items-center gap-2 text-lg font-semibold text-text"
            >
              <Flag aria-hidden className="size-5 text-text" />
              {r.name}
            </p>
          ))}
          {passToday.length > 0 ? (
            <ul className="mt-3 space-y-4">
              {passToday.map((w) => (
                <li key={w.id} className="min-w-0">
                  <p className="flex items-start gap-2 text-lg font-semibold leading-snug text-text">
                    <SportIcon
                      sport={w.sport}
                      className="mt-1 size-5 shrink-0 text-text-muted"
                    />
                    {w.title}
                  </p>
                  {(w.duration || w.summary) && (
                    <p className="mt-1 text-sm text-text-muted">
                      {[w.duration, w.summary].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <WorkoutStrip blocks={w.profile} className="mt-3 h-8" />
                  <ButtonLink
                    href={w.href ?? `${own}/pass/${w.id}`}
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                  >
                    Visa passet
                  </ButtonLink>
                </li>
              ))}
            </ul>
          ) : raceToday.length === 0 ? (
            <div className="mt-2 space-y-1">
              <p className="text-lg font-semibold text-text">
                Inget pass inlagt i dag
              </p>
              <p className="text-sm text-text-muted">
                {upcoming[0]
                  ? `Nästa: ${upcoming[0].title}, ${dayText(upcoming[0].date)}.`
                  : "Inga pass med datum de närmaste två veckorna."}
              </p>
            </div>
          ) : null}
        </section>

        <Card className="min-w-0">
          <CardTitle>Incheckning</CardTitle>
          {todays ? (
            <div className="space-y-1 text-sm text-text-muted">
              <p className="font-medium text-text">Klar för i dag.</p>
              {todays.session_rpe !== null &&
              todays.duration_minutes !== null ? (
                <p>
                  Pass: RPE {Number(todays.session_rpe)} ·{" "}
                  {Number(todays.duration_minutes)} min
                </p>
              ) : (
                <p>Vilodag</p>
              )}
              {readiness !== null && (
                <p>
                  Återhämtning {readiness} av {READINESS_MAX} ·{" "}
                  {readReadiness(readiness).toLowerCase()}
                </p>
              )}
              <Link
                href={adeptHref(adept.id, "maende")}
                className="inline-block pt-1 text-[13px] font-medium text-text underline decoration-line-strong underline-offset-2 hover:decoration-text"
              >
                Ändra
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-text-muted">
                Hur kändes passet, och hur har du sovit? Två minuter i dag gör
                att din coach ser hur träningen landar.
              </p>
              <ButtonLink
                href={adeptHref(adept.id, "maende")}
                className="w-full font-semibold sm:w-auto"
              >
                Checka in
              </ButtonLink>
            </div>
          )}
        </Card>

        {fromCoach && (
          <Card className="min-w-0">
            <CardTitle
              action={
                unread > 0 ? (
                  <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[12px] font-medium text-text tabular-nums">
                    {unread} {unread === 1 ? "oläst" : "olästa"}
                  </span>
                ) : undefined
              }
            >
              Från din coach
            </CardTitle>
            <Link
              href={adeptHref(adept.id, "meddelanden")}
              className="group block"
            >
              <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-text group-hover:text-text">
                {fromCoach.body}
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-[13px] text-text-muted group-hover:text-text">
                <MessageSquare aria-hidden className="size-3.5" />
                {longDate(fromCoach.created_at.slice(0, 10), today)} · Svara
              </p>
            </Link>
          </Card>
        )}

        <Card
          className={
            fromCoach ? "min-w-0 lg:col-span-2" : "min-w-0 lg:col-span-3"
          }
        >
          <CardTitle
            action={
              <Link
                href={routes.calendar}
                className="text-[13px] text-text-muted hover:text-text"
              >
                Kalender
              </Link>
            }
          >
            Kommande pass
          </CardTitle>
          {upcoming.length === 0 ? (
            <p className="text-sm text-text-muted">
              Inga pass med datum de närmaste två veckorna.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.slice(0, 6).map((w) => (
                <li key={w.id}>
                  <Link
                    href={w.href ?? `${own}/pass/${w.id}`}
                    className="group flex items-center gap-3 py-2.5"
                  >
                    <span className="w-24 shrink-0 text-[13px] text-text-muted">
                      {weekdayName(w.date)}{" "}
                      <span className="tabular-nums text-text-subtle">
                        {Number(w.date.slice(8))}/{Number(w.date.slice(5, 7))}
                      </span>
                    </span>
                    <SportIcon
                      sport={w.sport}
                      className="size-4 shrink-0 text-text-subtle"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-text group-hover:underline">
                        {w.title}
                      </span>
                      <WorkoutStrip
                        blocks={w.profile}
                        className="mt-1 h-4 max-w-sm"
                      />
                    </span>
                    {w.duration && (
                      <span className="shrink-0 text-[13px] text-text-muted tabular-nums">
                        {w.duration}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <SeasonSummary blocks={blocks} races={races} today={today} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="min-w-0">
          <CardTitle
            action={
              <Link
                href={routes.strength}
                className="text-[13px] text-text-muted hover:text-text"
              >
                Progressionen
              </Link>
            }
          >
            Styrka
          </CardTitle>
          <div className="space-y-3">
            {lastStrength ? (
              <div className="space-y-1 text-sm text-text-muted">
                <p className="text-text">
                  {lastStrength.title || "Styrkepass"}
                  <span className="ml-1.5 text-[13px] text-text-muted">
                    {longDate(lastStrength.performed_on, today)}
                  </span>
                </p>
                <p className="text-[13px]">
                  {lastStrength.exercises
                    .filter((e) => e.weightKg !== null)
                    .slice(0, 3)
                    .map((e) => `${e.name} ${entryText(e)}`)
                    .join(" · ") ||
                    lastStrength.exercises
                      .slice(0, 4)
                      .map((e) => e.name)
                      .join(", ")}
                </p>
                <p className="text-[13px]">
                  {strengthThisWeek === 0
                    ? "Inget styrkepass den här veckan."
                    : `${strengthThisWeek} pass den här veckan.`}
                </p>
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                Logga styrkepassen här i stället för som en kommentar, så ser du
                och din coach progressionen per övning.
              </p>
            )}
            <ButtonLink href={routes.strength} size="sm" variant="secondary">
              Logga styrkepass
            </ButtonLink>
          </div>
        </Card>

        <Card className="min-w-0">
          <CardTitle
            action={
              <Link
                href={routes.progression}
                className="text-[13px] text-text-muted hover:text-text"
              >
                Utveckling
              </Link>
            }
          >
            Senaste test
          </CardTitle>
          {latest ? (
            <Link
              href={`${own}/test/${latest.id}`}
              className="group flex items-start gap-2.5"
            >
              <TestIcon className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm text-text group-hover:underline">
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
        </Card>
      </div>
    </div>
  );
}
