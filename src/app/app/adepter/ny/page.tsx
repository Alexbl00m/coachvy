import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdeptForm } from "@/components/adepts/adept-form";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { createAdept } from "@/lib/adepts/actions";
import { requireCoach } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export const metadata = { title: "Lägg till adept" };

export default async function NyAdeptPage() {
  await requireCoach();

  return (
    <>
      <Link
        href={routes.adepts}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Adepter
      </Link>

      <PageHeader
        title="Lägg till adept"
        description="Adepten läggs upp under dig. Ett eget konto behövs inte — det kan kopplas på senare."
      />

      <Card className="max-w-xl">
        <AdeptForm action={createAdept} submitLabel="Spara adept" />
      </Card>
    </>
  );
}
