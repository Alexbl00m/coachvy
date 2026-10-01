import { PageHeader } from "@/components/page-header";
import { WorkoutBuilder } from "@/components/workouts/workout-builder";
import { aiBlockedMessage } from "@/lib/adepts/consent-state";
import { getConsentState, listAdepts } from "@/lib/adepts/queries";
import { isMember } from "@/lib/auth/membership";
import { requireSessionUser } from "@/lib/auth/session";
import { MembersOnly } from "@/components/members-only";
import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";
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
  const user = await requireSessionUser();
  const role = user.profile?.role;
  if (role !== "coach" && role !== "adept") redirect(routes.dashboard);

  // En adept bygger bara åt sig själv, och bara som medlem.
  const selfService = role === "adept";
  if (selfService && (!isMember(user) || !user.adept)) {
    return (
      <>
        <PageHeader
          title="Passbyggare"
          description="Beskriv passet i en mening, så byggs det mot dina egna testvärden."
        />
        <MembersOnly
          feature="Passbyggaren"
          description="Som medlem bygger du egna pass mot dina uppmätta trösklar – distans, tröskel, intervaller eller pass som prövas mot din anaeroba reserv – och sparar dem bland dina pass."
        />
      </>
    );
  }

  const query = await searchParams;
  const adeptId = selfService
    ? (user.adept?.id ?? null)
    : typeof query.adept === "string"
      ? query.adept
      : null;
  const workoutId = typeof query.pass === "string" ? query.pass : null;

  const [adepts, context, saved] = await Promise.all([
    selfService
      ? Promise.resolve(user.adept ? [user.adept] : [])
      : listAdepts(),
    adeptId ? contextForAdept(adeptId) : Promise.resolve(null),
    workoutId ? getWorkout(workoutId) : Promise.resolve(null),
  ]);

  // AI-bygget skickar adeptens hälsouppgifter till Anthropic: bara med
  // samtycke. Att räkna på ett sparat pass går ändå.
  const adeptRow = adeptId ? adepts.find((a) => a.id === adeptId) : undefined;
  const consent = adeptRow ? await getConsentState(adeptRow) : null;
  const blocked =
    adeptRow && consent && consent.kind !== "godkänt"
      ? aiBlockedMessage(adeptRow.full_name, consent, selfService)
      : null;

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
        description={
          selfService
            ? "Beskriv passet i en mening, så byggs det mot dina egna testvärden."
            : "Beskriv passet i en mening. Det byggs mot adeptens mätta trösklar – och, om du vill, mot den anaeroba reserven med W′bal."
        }
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
        selfService={selfService}
        blocked={blocked}
      />
    </>
  );
}
