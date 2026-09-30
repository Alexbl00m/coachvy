import { Plus } from "lucide-react";

import { AdeptTable, type AdeptListRow } from "@/components/adepts/adept-table";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { listAdepts } from "@/lib/adepts/queries";
import { requireCoach } from "@/lib/auth/session";
import { formatLastActive } from "@/lib/format";
import {
  attentionFor,
  daysAgo,
  readinessSummary,
} from "@/lib/overview/attention";
import { listCheckinsSince, unreadByAdept } from "@/lib/overview/queries";
import { routes } from "@/lib/routes";
import { listBlocksBetween, listRacesBetween } from "@/lib/season/queries";
import {
  addDays,
  blockOn,
  countdownText,
  daysBetween,
  mainRace,
  todayIso,
} from "@/lib/season/season";
import { toCheckin } from "@/lib/training/queries";

export const metadata = { title: "Adepter" };

export default async function AdepterPage() {
  // Adept accounts have no business on a coach's roster; they land here only
  // by typing the URL, and are sent back to their own overview.
  const user = await requireCoach();
  const today = todayIso();
  const [adepts, checkins, unread, races, blocks] = await Promise.all([
    listAdepts(),
    listCheckinsSince(addDays(today, -60)),
    unreadByAdept(user.id),
    listRacesBetween(today, addDays(today, 366)),
    listBlocksBetween(today, addDays(today, 60)),
  ]);

  const rows: AdeptListRow[] = adepts.map((adept) => {
    const own = checkins.filter((c) => c.adept_id === adept.id).map(toCheckin);
    const ownRaces = races.filter((r) => r.adept_id === adept.id);
    const ownBlocks = blocks.filter((b) => b.adept_id === adept.id);
    const readiness = readinessSummary(own);
    // Nästa start: närmaste A-lopp, annars närmaste lopp – som nedräkningen.
    const race = mainRace(ownRaces, today);
    return {
      id: adept.id,
      name: adept.full_name,
      email: adept.email,
      sport: adept.sport,
      level: adept.current_level,
      goal: adept.goal,
      lastActive: formatLastActive(adept.last_active_at),
      phase: blockOn(ownBlocks, today)?.phase ?? null,
      readiness:
        readiness && daysBetween(readiness.date, today) <= 7
          ? {
              score: readiness.score,
              baseline: readiness.baseline,
              when: daysAgo(readiness.date, today),
            }
          : null,
      nextRace: race
        ? {
            name: race.name,
            priority: race.priority,
            countdown: countdownText(daysBetween(today, race.race_date)),
          }
        : null,
      unread: unread.get(adept.id) ?? 0,
      attention: attentionFor({
        checkins: own,
        unread: 0, // Olästa visas som en egen bricka i listan.
        races: ownRaces,
        blocks: ownBlocks,
        today,
      }).map((a) => ({ text: a.text, weight: a.weight })),
    };
  });

  return (
    <>
      <PageHeader
        title="Adepter"
        description="Dina adepter, var de är i säsongen och hur de mår."
        action={
          <ButtonLink href={routes.newAdept} className="font-semibold">
            <Plus aria-hidden className="size-4" />
            Lägg till adept
          </ButtonLink>
        }
      />

      {adepts.length === 0 ? (
        <EmptyState
          title="Inga adepter ännu"
          description="Lägg upp din första adept så kan du börja registrera testresultat och följa utvecklingen."
          action={
            <ButtonLink href={routes.newAdept} className="font-semibold">
              <Plus aria-hidden className="size-4" />
              Lägg till adept
            </ButtonLink>
          }
        />
      ) : (
        <AdeptTable rows={rows} />
      )}
    </>
  );
}
