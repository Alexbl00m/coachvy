import { MembersOnly } from "@/components/members-only";
import { PageHeader } from "@/components/page-header";
import { ReferenceData } from "@/components/vlamax/reference-data";
import { VlamaxCalculator } from "@/components/vlamax/vlamax-calculator";
import { listAdepts } from "@/lib/adepts/queries";
import { isMember } from "@/lib/auth/membership";
import { requireCoach } from "@/lib/auth/session";
import { listVlamaxSamples } from "@/lib/vlamax/queries";

export const metadata = { title: "VLamax-kalkyl" };

export default async function VlamaxPage() {
  const user = await requireCoach();

  // Referensdatan skickas till webbläsaren som props. Utan medlemskap hämtas
  // den inte ens.
  if (!isMember(user)) {
    return (
      <>
        <PageHeader
          title="VLamax-kalkyl"
          description="Skattar VLamax utifrån ett sprinttest, tränad på atleter där VLamax bestämts i en metabol profilering."
        />
        <MembersOnly feature="VLamax-kalkylen" />
      </>
    );
  }

  const [samples, adepts] = await Promise.all([
    listVlamaxSamples(),
    listAdepts(),
  ]);

  return (
    <>
      <PageHeader
        title="VLamax-kalkyl"
        description="Skattar VLamax utifrån ett sprinttest, tränad på atleter där VLamax bestämts i en metabol profilering."
      />

      <VlamaxCalculator samples={samples} adepts={adepts} />
      <ReferenceData samples={samples} />
    </>
  );
}
