import { WorkoutPanel } from "@/components/workouts/workout-panel";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { listWorkouts } from "@/lib/workouts/queries";

export const metadata = { title: "Pass" };

/** Passen som byggts åt adepten, med datum eller i reserv. */
export default async function AdeptWorkoutsPage({
  params,
}: PageProps<"/app/adepter/[id]/plan/pass">) {
  const { user, adept, canEdit, selfMember } = await loadWorkspace(params);
  const workouts = await listWorkouts(adept.id);
  return (
    <WorkoutPanel
      adeptId={adept.id}
      workouts={workouts}
      canEdit={canEdit}
      selfBuilderId={selfMember ? user.id : null}
    />
  );
}
