import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { NewSessionForm } from "@/components/tests/new-session-form";
import { PageHeader } from "@/components/page-header";
import { getAdept } from "@/lib/adepts/queries";
import { isMember } from "@/lib/auth/membership";
import { requireSessionUser } from "@/lib/auth/session";
import { formatDuration } from "@/lib/calculators/time";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { listSeasonBlocks } from "@/lib/season/queries";
import { getSession } from "@/lib/tests/session-queries";

export const metadata = { title: "Ändra test" };

/** Ett tal som formuläret skriver det: decimalkomma, tomt när värdet saknas. */
const sv = (value: number | string | null | undefined) =>
  value === null || value === undefined ? "" : String(value).replace(".", ",");

export default async function EditSessionPage({
  params,
}: PageProps<"/app/adepter/[id]/test/[sessionId]/andra">) {
  const user = await requireSessionUser();
  const { id, sessionId } = await params;
  const sessionHref = `${routes.adepts}/${id}/test/${sessionId}`;

  const [adept, session, season] = await Promise.all([
    getAdept(id),
    getSession(sessionId),
    listSeasonBlocks(id),
  ]);
  if (!adept || !session || session.adept_id !== adept.id) notFound();
  // Bara adeptens egen coach ändrar testet.
  if (user.profile?.role !== "coach" || adept.coach_id !== user.id) redirect(sessionHref);

  return (
    <>
      <Link
        href={sessionHref}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-subtle hover:text-text"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Tillbaka till testet
      </Link>

      <PageHeader
        title="Ändra test"
        description={`${adept.full_name} · ${formatDate(session.performed_on)}. Värdena räknas om ur rådatan när du sparar.`}
      />

      <NewSessionForm
        adeptId={adept.id}
        adeptSport={session.sport}
        adeptWeight={session.weight_kg === null ? null : Number(session.weight_kg)}
        adeptBodyFat={session.body_fat_pct == null ? null : Number(session.body_fat_pct)}
        adeptSex={session.sex ?? null}
        member={isMember(user)}
        season={season}
        edit={{
          sessionId: session.id,
          protocol: session.protocol,
          unit: session.intensity_unit,
          performedOn: session.performed_on,
          trainingPhase: session.training_phase ?? "",
          notes: session.notes ?? "",
          finish: {
            peak: sv(session.peak_intensity),
            vo2max: sv(session.vo2max),
            peakLactate: sv(session.peak_lactate),
            peakHeartRate: sv(session.peak_heart_rate),
          },
          rows: session.test_efforts.map((e) => ({
            intensity: sv(e.intensity),
            duration: e.duration_seconds ? formatDuration(e.duration_seconds) : "",
            distance: sv(e.distance_m),
            lactate: sv(e.lactate),
            heartRate: sv(e.heart_rate),
            heartRateMax: sv(e.heart_rate_max),
            date: e.performed_on ?? "",
            comment: e.comment ?? "",
            rpe: sv(e.rpe),
          })),
        }}
      />
    </>
  );
}
