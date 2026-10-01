import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { AdeptPicker } from "@/components/progression/adept-picker";
import { BlockEditor } from "@/components/season/block-editor";
import { RaceEditor } from "@/components/season/race-editor";
import { SeasonSummary } from "@/components/season/season-summary";
import { SeasonTimeline } from "@/components/season/season-timeline";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { listActivities } from "@/lib/activities/queries";
import { getMyAdeptRow, listAdepts } from "@/lib/adepts/queries";
import { requireSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { listBlocks, listRaces } from "@/lib/season/queries";
import { addDays, monthName, planNotes, todayIso } from "@/lib/season/season";
import type { Sport } from "@/lib/calculators/lactate";
import { sessionHeadline } from "@/lib/tests/headline";
import { protocolByKey } from "@/lib/tests/protocols";
import { listSessions } from "@/lib/tests/session-queries";
import type { Adept, RaceSport } from "@/lib/types/database";

export const metadata = { title: "Säsongsplan" };

/** Månaden `months` bort från YYYY-MM, som YYYY-MM. */
function shiftMonth(month: string, months: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

const monthLabel = (month: string) =>
  `${monthName(Number(month.slice(5, 7)) - 1)} ${month.slice(0, 4)}`;

/** Adeptens gren som tävlingsgren, för att förifylla formuläret. */
function raceSportOf(raw: string | null): RaceSport | "" {
  const value = (raw ?? "").toLowerCase();
  if (value.includes("tri")) return "triathlon";
  if (value.includes("löp") || value.includes("run")) return "löpning";
  if (value.includes("sim") || value.includes("swim")) return "simning";
  if (value.includes("cyk") || value.includes("bike")) return "cykling";
  return "";
}

/**
 * Säsongsplanen: perioderna, tävlingarna och testerna på en tidslinje.
 *
 * Planen är grunden de andra vyerna läser: översikten räknar ned mot
 * A-loppet, kalendern färgar dagarna efter fasen, ett nytt test får fasen
 * förvald, och AI-coachen och passbyggaren får veta var i säsongen atleten
 * är. Fönstret är tolv månader och flyttas ett halvår i taget.
 */
export default async function PlanerPage({
  searchParams,
}: PageProps<"/app/planer">) {
  const user = await requireSessionUser();
  const query = await searchParams;
  const today = todayIso();
  const isCoach = user.profile?.role === "coach";

  let adept: Adept | null = null;
  let picker: React.ReactNode = null;

  if (isCoach) {
    const own = (await listAdepts()).filter((a) => a.coach_id === user.id);
    if (own.length === 0) {
      return (
        <>
          <PageHeader title="Säsongsplan" />
          <EmptyState
            title="Inga adepter ännu"
            description="Säsongsplanen görs per adept. Lägg till en adept först."
            action={
              <ButtonLink href={routes.newAdept} className="font-semibold">
                <Plus aria-hidden className="size-4" />
                Lägg till adept
              </ButtonLink>
            }
          />
        </>
      );
    }
    const wanted = typeof query.adept === "string" ? query.adept : null;
    adept = own.find((a) => a.id === wanted) ?? own[0];
    picker =
      own.length > 1 ? (
        <AdeptPicker
          adepts={own.map((a) => ({ id: a.id, name: a.full_name }))}
          current={adept.id}
          basePath={routes.plans}
        />
      ) : null;
  } else {
    adept = await getMyAdeptRow(user.id);
  }

  if (!adept) {
    return (
      <>
        <PageHeader title="Säsongsplan" />
        <EmptyState
          title="Ingen adeptprofil hittades"
          description="Säsongsplanen hör till en adept. Ditt konto är inte kopplat till någon adeptprofil."
        />
      </>
    );
  }

  const [blocks, races, sessions, activities] = await Promise.all([
    listBlocks(adept.id),
    listRaces(adept.id),
    listSessions(adept.id),
    listActivities(adept.id),
  ]);
  // Senast uppladdade loppet per tävling – listan är nyast först.
  const analyses: Record<string, string> = {};
  for (const a of activities) {
    if (a.race_id && !analyses[a.race_id]) analyses[a.race_id] = a.id;
  }

  // Coachen planerar; en adept utan coach planerar sin egen säsong.
  const canPlan =
    (isCoach && adept.coach_id === user.id) ||
    (adept.profile_id === user.id && adept.coach_id === null);

  const current = today.slice(0, 7);
  const fran =
    typeof query.fran === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(query.fran)
      ? query.fran
      : shiftMonth(current, -2);
  const from = `${fran}-01`;
  const to = addDays(`${shiftMonth(fran, 12)}-01`, -1);

  const link = (month: string) => {
    const params = new URLSearchParams();
    if (isCoach) params.set("adept", adept.id);
    params.set("fran", month);
    return `${routes.plans}?${params.toString()}`;
  };

  const tests = sessions.map((s) => ({
    id: s.id,
    date: s.performed_on,
    label: protocolByKey(s.protocol)?.label ?? s.protocol,
    detail: sessionHeadline(s.test_metrics, s.sport as Sport),
    href: `${routes.adepts}/${adept.id}/test/${s.id}`,
  }));

  const notes = planNotes(blocks, races, today);

  return (
    <>
      <PageHeader
        title="Säsongsplan"
        description={
          isCoach
            ? `${adept.full_name}: perioder, tävlingar och tester på en tidslinje.`
            : "Perioder, tävlingar och tester på en tidslinje."
        }
        action={picker}
      />

      <div className="space-y-6">
        <SeasonSummary blocks={blocks} races={races} today={today} />

        <Card className="min-w-0">
          <CardTitle
            action={
              <nav
                aria-label="Flytta tidslinjen"
                className="flex items-center gap-1"
              >
                <Link
                  href={link(shiftMonth(fran, -6))}
                  aria-label="Ett halvår bakåt"
                  className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
                >
                  <ChevronLeft aria-hidden className="size-4" />
                </Link>
                <span className="min-w-[10rem] text-center text-[12px] text-text-muted tabular-nums">
                  {monthLabel(fran)} – {monthLabel(shiftMonth(fran, 11))}
                </span>
                <Link
                  href={link(shiftMonth(fran, 6))}
                  aria-label="Ett halvår framåt"
                  className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
                >
                  <ChevronRight aria-hidden className="size-4" />
                </Link>
              </nav>
            }
          >
            Säsongen
          </CardTitle>
          <SeasonTimeline
            from={from}
            to={to}
            today={today}
            blocks={blocks}
            races={races}
            tests={tests}
          />
        </Card>

        {notes.length > 0 && (
          <Card>
            <CardTitle>Att se över</CardTitle>
            <ul className="space-y-2 text-sm text-text-muted">
              {notes.map((note) => (
                <li key={note} className="flex gap-2.5">
                  <span
                    aria-hidden
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-accent"
                  />
                  {note}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <BlockEditor
            adeptId={adept.id}
            blocks={blocks}
            today={today}
            canEdit={canPlan}
            openNew={query.ny === "period"}
          />
          <RaceEditor
            adeptId={adept.id}
            races={races}
            today={today}
            defaultSport={raceSportOf(adept.sport)}
            analyses={analyses}
          />
        </div>
      </div>
    </>
  );
}
