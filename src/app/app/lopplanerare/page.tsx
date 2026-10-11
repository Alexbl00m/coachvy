import { redirect } from "next/navigation";

import { MembersOnly } from "@/components/members-only";
import { PageHeader } from "@/components/page-header";
import {
  RunningPlanner,
  type PaceSeed,
} from "@/components/running/running-planner";
import { listAdepts } from "@/lib/adepts/queries";
import { isMember } from "@/lib/auth/membership";
import { requireSessionUser } from "@/lib/auth/session";
import { loadRunningFitness } from "@/lib/plan-library/fitness";
import { raceTimeText } from "@/lib/plan-library/paces";
import { RACES, raceByKey, type RaceKey } from "@/lib/plan-library/races";
import { routes } from "@/lib/routes";
import { distanceByKey, inputFromParams } from "@/lib/running-planner/planner";

export const metadata = { title: "Löpplanerare" };

const DESCRIPTION =
  "Veckovolymen och långpasset vecka för vecka fram till loppet, ur distans, nivå och var löparen står i dag. Grunden är polariserad, sedan kommer tröskeln och sist det specifika – med avlastning var tredje vecka och ett test före den specifika delen.";

/**
 * Löpplaneraren för coacher och medlemmar. Inställningarna står i adressen;
 * zonerna räknas ur en tid i adressen, annars ur löparens formuppskattning –
 * den inskrivna tid som ligger närmast loppet i distans.
 */
export default async function RunningPlannerPage({
  searchParams,
}: PageProps<"/app/lopplanerare">) {
  const user = await requireSessionUser();
  const role = user.profile?.role;
  if (role !== "coach" && role !== "adept") redirect(routes.dashboard);
  const coach = role === "coach";

  if (!coach && !isMember(user)) {
    return (
      <>
        <PageHeader title="Löpplanerare" description={DESCRIPTION} />
        <MembersOnly
          feature="Löpplaneraren"
          description="Som medlem planerar du veckovolym och långpass fram till ditt lopp, med zonerna ur din egen form."
        />
      </>
    );
  }

  const query = await searchParams;
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const input = inputFromParams(query);

  const adepts = coach ? await listAdepts() : [];
  const requested = coach ? (one(query.adept) ?? null) : null;
  const adeptId = coach
    ? adepts.some((a) => a.id === requested)
      ? requested
      : null
    : (user.adept?.id ?? null);

  // Tiden zonerna räknas ur.
  let pace: PaceSeed = null;
  const urlTime = one(query.tid);
  const urlRace = one(query.tidlopp);
  if (urlTime && RACES.some((r) => r.key === urlRace)) {
    pace = { race: urlRace as RaceKey, time: urlTime, source: "" };
  } else if (adeptId) {
    const fitness = await loadRunningFitness(adeptId);
    const estimate = fitness.current;
    if (estimate) {
      const target = distanceByKey(input.distance).race ?? "M";
      const metres = raceByKey(target).metres;
      const given = RACES.filter((r) => !estimate.derived.includes(r.key));
      const closest = (given.length ? given : RACES).reduce((best, r) =>
        Math.abs(Math.log(r.metres / metres)) <
        Math.abs(Math.log(best.metres / metres))
          ? r
          : best,
      );
      const name = coach
        ? adepts.find((a) => a.id === adeptId)?.full_name
        : null;
      pace = {
        race: closest.key,
        time: raceTimeText(estimate.times[closest.key]),
        source: `Ur ${name ? `${name}s` : "din"} formuppskattning: ${closest.name} på ${raceTimeText(estimate.times[closest.key])}${estimate.derived.includes(closest.key) ? " (uträknad)" : ""}. Ändra tiden för att planera mot ett mål.`,
      };
    }
  }

  return (
    <>
      <PageHeader title="Löpplanerare" description={DESCRIPTION} />
      <RunningPlanner
        key={adeptId ?? "ingen"}
        initial={input}
        pace={pace}
        adepts={adepts.map((a) => ({ id: a.id, full_name: a.full_name }))}
        adeptId={coach ? adeptId : null}
      />
    </>
  );
}
