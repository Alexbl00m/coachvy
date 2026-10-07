import Link from "next/link";

import { SportIcon, TestIcon } from "@/components/calendar/calendar-items";
import { SeasonSummary } from "@/components/season/season-summary";
import { ConsentToggle } from "@/components/settings/settings-forms";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { WorkoutStrip } from "@/components/workouts/workout-strip";
import { listScheduledWorkouts } from "@/lib/calendar/queries";
import { countUnread } from "@/lib/messages/queries";
import { routes } from "@/lib/routes";
import { listBlocks, listRaces } from "@/lib/season/queries";
import { addDays, longDate, mondayOf, weekdayName } from "@/lib/season/season";
import type { Sport } from "@/lib/calculators/lactate";
import { sessionHeadline } from "@/lib/tests/headline";
import { protocolByKey } from "@/lib/tests/protocols";
import { listSessions } from "@/lib/tests/session-queries";
import {
  READINESS_MAX,
  readReadiness,
  readinessScore,
} from "@/lib/training/load";
import { listCheckins, toCheckin } from "@/lib/training/queries";
import type { Adept } from "@/lib/types/database";

/**
 * Adeptens översikt: var i säsongen hen är, dagens incheckning och passen
 * som ligger framför.
 */
export async function AdeptOverview({
  userId,
  adept,
  today,
  consentGiven,
}: {
  userId: string;
  adept: Adept;
  today: string;
  /** Samtycket till hälsouppgifter. Saknas det frågar översikten först. */
  consentGiven: boolean;
}) {
  const monday = mondayOf(today);
  const [races, blocks, checkins, unread, workouts, sessions] =
    await Promise.all([
      listRaces(adept.id),
      listBlocks(adept.id),
      listCheckins(adept.id, 14),
      countUnread(adept.id, userId),
      listScheduledWorkouts(monday, addDays(monday, 13), adept.id),
      listSessions(adept.id),
    ]);

  const todays = checkins.find((c) => c.performed_on === today) ?? null;
  const readiness = todays ? readinessScore(toCheckin(todays)) : null;
  const upcoming = workouts.filter((w) => w.date >= today);
  const latest = sessions[0] ?? null;
  const own = `${routes.adepts}/${adept.id}`;

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

      <SeasonSummary blocks={blocks} races={races} today={today} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="min-w-0">
          <CardTitle>Dagens incheckning</CardTitle>
          {todays ? (
            <div className="space-y-1 text-sm text-text-muted">
              <p className="text-text">Klar för i dag.</p>
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
                href={`${own}?vy=maende`}
                className="inline-block pt-1 text-[13px] text-accent hover:text-accent-strong"
              >
                Ändra
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-text-muted">
                Hur kändes passet, och hur har du sovit? Två minuter i dag gör
                att din coach ser hur träningen landar.
              </p>
              <ButtonLink
                href={`${own}?vy=maende`}
                size="sm"
                className="font-semibold"
              >
                Checka in
              </ButtonLink>
            </div>
          )}
        </Card>

        <Card className="min-w-0">
          <CardTitle
            action={
              <Link
                href={routes.calendar}
                className="text-[13px] text-accent hover:text-accent-strong"
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
            <ul className="space-y-2.5">
              {upcoming.slice(0, 6).map((w) => (
                <li key={w.id}>
                  <Link
                    href={`${own}/pass/${w.id}`}
                    className="group flex items-start gap-2.5"
                  >
                    <SportIcon
                      sport={w.sport}
                      className="mt-0.5 size-4 shrink-0 text-text-subtle"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-text group-hover:text-accent">
                        {w.title}
                      </span>
                      <span className="block text-[12px] text-text-subtle">
                        {w.date === today
                          ? "I dag"
                          : `${weekdayName(w.date)} ${longDate(w.date, today)}`}
                        {w.duration ? ` · ${w.duration}` : ""}
                      </span>
                      <WorkoutStrip blocks={w.profile} className="mt-1.5 h-6" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="min-w-0">
          <CardTitle>Senaste test</CardTitle>
          {latest ? (
            <Link
              href={`${own}/test/${latest.id}`}
              className="group flex items-start gap-2.5"
            >
              <TestIcon className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm text-text group-hover:text-accent">
                  {protocolByKey(latest.protocol)?.label ?? latest.protocol}
                </span>
                <span className="block text-[12px] text-text-subtle">
                  {longDate(latest.performed_on, today)}
                </span>
                {sessionHeadline(
                  latest.test_metrics,
                  latest.sport as Sport,
                ) && (
                  <span className="mt-1 block text-[13px] text-text-muted">
                    {sessionHeadline(
                      latest.test_metrics,
                      latest.sport as Sport,
                    )}
                  </span>
                )}
              </span>
            </Link>
          ) : (
            <p className="text-sm text-text-muted">
              Inga tester registrerade ännu.
            </p>
          )}
          <div className="mt-4 border-t border-line pt-3">
            <Link
              href={`${own}?vy=meddelanden`}
              className="text-[13px] text-text-muted hover:text-text"
            >
              {unread > 0
                ? `${unread} ${unread === 1 ? "oläst meddelande" : "olästa meddelanden"} från din coach`
                : "Meddelanden"}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
