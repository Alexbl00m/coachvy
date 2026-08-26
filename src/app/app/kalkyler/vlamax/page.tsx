import { PageHeader } from "@/components/page-header";
import { ReferenceData } from "@/components/vlamax/reference-data";
import { VlamaxCalculator } from "@/components/vlamax/vlamax-calculator";
import { listAdepts } from "@/lib/adepts/queries";
import { requireCoach } from "@/lib/auth/session";
import { listVlamaxSamples } from "@/lib/vlamax/queries";

export const metadata = { title: "VLamax-kalkyl" };

export default async function VlamaxPage() {
  await requireCoach();

  const [samples, adepts] = await Promise.all([
    listVlamaxSamples(),
    listAdepts(),
  ]);

  return (
    <>
      <PageHeader
        title="VLamax-kalkyl"
        description="Skattar VLamax utifrån ett sprinttest, tränad på atleter där värdet mätts med INSCYD."
      />

      <VlamaxCalculator samples={samples} adepts={adepts} />
      <ReferenceData samples={samples} />
    </>
  );
}
