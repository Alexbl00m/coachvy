import Link from "next/link";
import {
  ArrowRight,
  BatteryLow,
  CalendarClock,
  Flag,
  MessageSquare,
  MoonStar,
  TrendingUp,
} from "lucide-react";

import {
  SportIcon,
  TestIcon,
  firstName,
} from "@/components/calendar/calendar-items";
import { PHASE_SHORT, phaseFill } from "@/components/season/phase-style";
import { PriorityBadge } from "@/components/season/priority-badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { listAdepts } from "@/lib/adepts/queries";
import {
  listScheduledWorkouts,
  listSessionsBetween,
} from "@/lib/calendar/queries";
import {
  attentionFor,
  type Attention,
  type AttentionKind,
} from "@/lib/overview/attention";
import { listCheckinsSince, unreadByAdept } from "@/lib/overview/queries";
import { routes } from "@/lib/routes";
import { listBlocksBetween, listRacesBetween } from "@/lib/season/queries";
import {
  addDays,
  blockOn,
  countdownText,
  daysBetween,
  isoWeek,
  longDate,
  mondayOf,
  weekdayName,
} from "@/lib/season/season";
import { toCheckin } from "@/lib/training/queries";
import { StatTile } from "./stat-tile";

const ICONS: Record<AttentionKind, typeof ArrowRight> = {
  återhämtning: BatteryLow,
  belastning: TrendingUp,
  meddelanden: MessageSquare,
  tystnad: MoonStar,
  toppning: CalendarClock,
  tävling: Flag,
};

function targetHref(adeptId: string, target: Attention["target"]) {
  if (target === "plan") return `${routes.plans}?adept=${adeptId}`;
  return `${routes.adepts}/${adeptId}?vy=${target}`;
}

/**
 * Coachens översikt: läget hos alla adepter på en sida.
 *
 * Det viktiga står först – vem som är värd en titt och varför – och sedan
 * det som ligger framför: tävlingarna, veckans pass och de senaste testerna.
 */
export async function CoachOverview({
  coachId,
  today,
}: {
  coachId: string;
  today: string;
}) {
  const adepts = (await listAdepts()).filter((a) => a.coach_id === coachId);

  if (adepts.length === 0) {
    return (
      <EmptyState
        title="Inga adepter ännu"
        description="När du lagt till adepter samlas läget här: vem som är värd en titt, kommande tävlingar, veckans pass och de senaste testerna."
        action={
          <ButtonLink href={routes.newAdept} className="font-semibold">
            Lägg till adept
          </ButtonLink>
        }
      />
    );
  }

  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const [checkins, unread, races, blocks, workouts, tests] = await Promise.all([
    listCheckinsSince(addDays(today, -60)),
    unreadByAdept(coachId),
    listRacesBetween(today, addDays(today, 60)),
    listBlocksBetween(today, addDays(today, 60)),
    listScheduledWorkouts(monday, sunday, null),
    listSessionsBetween(addDays(today, -90), today, null),
  ]);

  const own = new Set(adepts.map((a) => a.id));
  const ownRaces = races.filter((r) => own.has(r.adept_id));

  const rows = adepts
    .map((adept) => {
      const items = attentionFor({
        checkins: checkins
          .filter((c) => c.adept_id === adept.id)
          .map(toCheckin),
        unread: unread.get(adept.id) ?? 0,
        races: ownRaces.filter((r) => r.adept_id === adept.id),
        blocks: blocks.filter((b) => b.adept_id === adept.id),
        today,
      });
      const phase = blockOn(
        blocks.filter((b) => b.adept_id === adept.id),
        today,
      );
      return { adept, items, phase };
    })
    .filter((row) => row.items.length > 0)
    .sort(
      (a, b) =>
        b.items[0].weight - a.items[0].weight ||
        b.items.length - a.items.length ||
        a.adept.full_name.localeCompare(b.adept.full_name, "sv"),
    );

  const checkedInThisWeek = new Set(
    checkins
      .filter((c) => c.performed_on >= addDays(today, -6))
      .map((c) => c.adept_id),
  );
  const racesSoon = ownRaces.filter(
    (r) => daysBetween(today, r.race_date) <= 30,
  );
  const unreadTotal = [...unread.entries()]
    .filter(([id]) => own.has(id))
    .reduce((sum, [, n]) => sum + n, 0);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const recent = [...tests]
    .filter((t) => own.has(t.adeptId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <section
        aria-label="Nyckeltal"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatTile
          label="Adepter"
          value={adepts.length}
          hint={`${checkedInThisWeek.size} incheckade senaste veckan`}
          href={routes.adepts}
        />
        <StatTile
          label="Pass den här veckan"
          value={workouts.length}
          hint={`Vecka ${isoWeek(today)}`}
          href={routes.calendar}
        />
        <StatTile
          label="Tävlingar inom 30 dagar"
          value={racesSoon.length}
          hint={
            racesSoon[0]
              ? `${racesSoon[0].name} ${countdownText(daysBetween(today, racesSoon[0].race_date))}`
              : "Inga inlagda"
          }
          href={routes.plans}
        />
        <StatTile
          label="Olästa meddelanden"
          value={unreadTotal}
          hint={unreadTotal > 0 ? "Från dina adepter" : "Allt är läst"}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="min-w-0">
          <CardTitle>Värt en titt</CardTitle>
          {rows.length === 0 ? (
            <p className="text-sm text-text-muted">
              Inget som sticker ut just nu: ingen återhämtning under sin vanliga
              nivå, ingen stor förändring i belastning och inga olästa
              meddelanden.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map(({ adept, items, phase }) => (
                <li key={adept.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`${routes.adepts}/${adept.id}`}
                      className="text-sm font-medium text-text hover:text-accent"
                    >
                      {adept.full_name}
                    </Link>
                    {phase && (
                      <span className="inline-flex items-center gap-1.5 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-text-muted">
                        <span
                          aria-hidden
                          className="h-2 w-3 rounded-[2px]"
                          style={{ background: phaseFill(phase.phase) }}
                        />
                        {PHASE_SHORT[phase.phase]}
                      </span>
                    )}
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {items.map((item) => {
                      const Icon = ICONS[item.kind];
                      return (
                        <li key={item.kind + item.text}>
                          <Link
                            href={targetHref(adept.id, item.target)}
                            className="group flex items-start gap-2 text-[13px] text-text-muted hover:text-text"
                          >
                            <Icon
                              aria-hidden
                              className={
                                item.weight === 3
                                  ? "mt-0.5 size-3.5 shrink-0 text-accent"
                                  : "mt-0.5 size-3.5 shrink-0 text-text-subtle"
                              }
                            />
                            <span>{item.text}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-text-subtle">
            Återhämtningen jämförs med adeptens eget snitt den senaste månaden,
            belastningen med månaden före. Det som nämns är sådant som skiljer
            sig tydligt – vad det betyder är din bedömning.
          </p>
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
            Kommande tävlingar
          </CardTitle>
          {ownRaces.length === 0 ? (
            <p className="text-sm text-text-muted">
              Inga tävlingar de närmaste två månaderna. De läggs in i
              säsongsplanen.
            </p>
          ) : (
            <ul className="space-y-3">
              {ownRaces.slice(0, 8).map((race) => (
                <li key={race.id}>
                  <Link
                    href={`${routes.plans}?adept=${race.adept_id}`}
                    className="group flex items-start gap-3"
                  >
                    <PriorityBadge priority={race.priority} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-text group-hover:text-accent">
                        {race.name}
                      </span>
                      <span className="block text-[12px] text-text-subtle">
                        {race.adept_name} · {longDate(race.race_date, today)} ·{" "}
                        {countdownText(daysBetween(today, race.race_date))}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardTitle
            action={
              <Link
                href={routes.calendar}
                className="text-[13px] text-accent hover:text-accent-strong"
              >
                Hela veckan
              </Link>
            }
          >
            Den här veckan
          </CardTitle>
          {workouts.length === 0 ? (
            <p className="text-sm text-text-muted">
              Inga pass med datum den här veckan. Ett pass får ett datum när det
              sparas i passbyggaren.
            </p>
          ) : (
            <div className="space-y-3">
              {weekDays
                .filter((d) => workouts.some((w) => w.date === d))
                .map((d) => (
                  <div key={d}>
                    <p
                      className={
                        d === today
                          ? "text-[12px] font-semibold text-accent"
                          : "text-[12px] font-medium text-text-subtle"
                      }
                    >
                      {d === today
                        ? "I dag"
                        : `${weekdayName(d)} ${longDate(d, today)}`}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {workouts
                        .filter((w) => w.date === d)
                        .map((w) => (
                          <li key={w.id}>
                            <Link
                              href={`${routes.adepts}/${w.adeptId}/pass/${w.id}`}
                              className="flex items-center gap-2 text-[13px] text-text-muted hover:text-text"
                            >
                              <SportIcon
                                sport={w.sport}
                                className="size-3.5 shrink-0 text-text-subtle"
                              />
                              <span className="truncate">
                                <span className="text-text">
                                  {firstName(w.adeptName)}
                                </span>{" "}
                                · {w.title}
                                {w.duration ? ` · ${w.duration}` : ""}
                              </span>
                            </Link>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </Card>

        <Card className="min-w-0">
          <CardTitle
            action={
              <Link
                href={routes.progression}
                className="text-[13px] text-accent hover:text-accent-strong"
              >
                Progression
              </Link>
            }
          >
            Senaste tester
          </CardTitle>
          {recent.length === 0 ? (
            <p className="text-sm text-text-muted">
              Inga tester de senaste tre månaderna.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {recent.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`${routes.adepts}/${t.adeptId}/test/${t.id}`}
                    className="group flex items-start gap-2.5"
                  >
                    <TestIcon className="mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-text group-hover:text-accent">
                        {t.adeptName} · {t.label}
                      </span>
                      <span className="block truncate text-[12px] text-text-subtle">
                        {longDate(t.date, today)}
                        {t.headline ? ` · ${t.headline}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
