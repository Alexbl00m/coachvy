import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/ui/button";
import { PrintButton } from "@/components/workouts/print-button";
import { Card, CardTitle } from "@/components/ui/card";
import { WorkoutView } from "@/components/workouts/workout-view";
import { getAdept } from "@/lib/adepts/queries";
import { requireSessionUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getWorkout } from "@/lib/workouts/queries";
import { sportOf } from "@/lib/tests/protocols";
import { toWorkout } from "@/lib/workouts/schema";

export const metadata = { title: "Pass" };

/**
 * Ett sparat pass.
 *
 * Det räknas om mot den referens det byggdes med, inte mot adeptens nuvarande
 * tröskel. En föreskrift från i våras ska stå kvar som den skrevs – vad som
 * hänt med FTP sedan dess hör hemma i progressionen, inte här.
 */
export default async function WorkoutPage({
  params,
}: PageProps<"/app/adepter/[id]/pass/[workoutId]">) {
  await requireSessionUser();
  const { id, workoutId } = await params;

  const [adept, saved] = await Promise.all([getAdept(id), getWorkout(workoutId)]);
  if (!adept || !saved || saved.adept_id !== adept.id) notFound();

  const model =
    saved.critical !== null && saved.reserve !== null
      ? { critical: saved.critical, reserve: saved.reserve }
      : null;

  return (
    <>
      <Link
        href={`${routes.adepts}/${adept.id}?vy=pass`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {adept.full_name}
      </Link>

      <PageHeader
        title={saved.title}
        description={[saved.summary, formatDate(saved.created_at)]
          .filter(Boolean)
          .join(" · ")}
        action={
          <div className="flex flex-wrap gap-2 print:hidden">
            <PrintButton />
            {/* Byggaren räknar mot adeptens gren. Stämmer den inte med
                passets skulle procenten landa mot fel storhet, så då
                erbjuds inte länken. */}
            {saved.sport === sportOf(adept.sport) && (
              <Link
                href={`${routes.workoutBuilder}?adept=${adept.id}&pass=${saved.id}`}
                className={buttonClass({ variant: "secondary" })}
              >
                <Pencil aria-hidden className="size-4" />
                Öppna i passbyggaren
              </Link>
            )}
          </div>
        }
      />

      <WorkoutView
        workout={toWorkout(saved)}
        reference={saved.reference}
        model={model}
      />

      {saved.prompt && (
        <Card className="mt-6">
          <CardTitle>Passet byggdes ur</CardTitle>
          <p className="text-sm leading-relaxed text-text-muted">
            {saved.prompt}
          </p>
        </Card>
      )}
    </>
  );
}
