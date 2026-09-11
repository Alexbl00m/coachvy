import { PageHeader } from "@/components/page-header";
import { WorkoutBuilder } from "@/components/workouts/workout-builder";
import { listAdepts } from "@/lib/adepts/queries";
import { requireCoach } from "@/lib/auth/session";
import { contextForAdept } from "@/lib/workouts/generate";
import { isAnthropicConfigured } from "@/lib/workouts/env";
import { getWorkout } from "@/lib/workouts/queries";
import { toWorkout } from "@/lib/workouts/schema";

export const metadata = { title: "Passbyggare" };

/**
 * Adepten ligger i adressen i stället för i klientens tillstånd.
 *
 * Underlaget – CP, W′, tröskel – hämtas då på servern där det redan finns, i
 * stället för att klienten ska be om det efter att sidan har ritats. Att
 * länken går att spara och skicka vidare följer på köpet.
 */
export default async function PassPage({
  searchParams,
}: PageProps<"/app/pass">) {
  await requireCoach();

  const query = await searchParams;
  const adeptId = typeof query.adept === "string" ? query.adept : null;
  const workoutId = typeof query.pass === "string" ? query.pass : null;

  const [adepts, context, saved] = await Promise.all([
    listAdepts(),
    adeptId ? contextForAdept(adeptId) : Promise.resolve(null),
    workoutId ? getWorkout(workoutId) : Promise.resolve(null),
  ]);

  /**
   * Ett pass som öppnas för ändring räknas mot adeptens *nuvarande* tröskel,
   * inte den det en gång sparades mot. Det är hela poängen med att målen är
   * procent: samma pass i februari och i juli är samma träning, men inte
   * samma watt. Originalet ligger kvar orört – det som sparas härifrån blir
   * en ny rad.
   */
  const initialWorkout =
    saved &&
    context &&
    adeptId !== null &&
    saved.adept_id === adeptId &&
    // Grenen måste stämma. Ett löppass mot ett wattunderlag skulle räkna om
    // procenten mot fel storhet utan att något syntes vara fel.
    saved.sport === context.sport
      ? toWorkout(saved)
      : null;

  return (
    <>
      <PageHeader
        title="Passbyggare"
        description="Beskriv passet i en mening. Det byggs mot adeptens mätta tröskel och anaeroba reserv, och prövas mot W′bal innan du ser det."
      />

      <WorkoutBuilder
        // Nyckeln tvingar fram en ny montering när ett annat pass öppnas, så
        // att utgångsläget verkligen byts ut.
        key={workoutId ?? "nytt"}
        adepts={adepts.map((a) => ({ id: a.id, full_name: a.full_name }))}
        adeptId={context ? adeptId : null}
        serverContext={context}
        initialWorkout={initialWorkout}
        configured={isAnthropicConfigured()}
      />
    </>
  );
}
