import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { listAdepts } from "@/lib/adepts/queries";
import { getSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Min översikt" };

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-850 p-5">
      <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-ink-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink-50">
        {value}
      </p>
    </div>
  );
}

export default async function OversiktPage() {
  const user = await getSessionUser();
  const isCoach = user?.profile?.role === "coach";
  const adepts = isCoach ? await listAdepts() : [];

  const firstName = user?.profile?.full_name?.split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Hej ${firstName}` : "Min översikt"}
        description={
          isCoach
            ? "Din samlade vy över adepter, planer och testresultat."
            : "Din samlade vy över din träning, dina planer och dina tester."
        }
      />

      {!isSupabaseConfigured() && (
        <div className="mb-6 rounded-lg border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-ink-100">
          Supabase är inte konfigurerat. Kopiera{" "}
          <code className="rounded bg-ink-800 px-1.5 py-0.5 text-[12px]">
            .env.example
          </code>{" "}
          till{" "}
          <code className="rounded bg-ink-800 px-1.5 py-0.5 text-[12px]">
            .env.local
          </code>{" "}
          och fyll i projektets URL och anon-nyckel för att aktivera inloggning.
        </div>
      )}

      <section
        aria-label="Nyckeltal"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          label={isCoach ? "Adepter" : "Aktiva planer"}
          value={isCoach ? String(adepts.length) : "0"}
        />
        <StatCard label="Planer" value="0" />
        <StatCard label="Testresultat" value="0" />
        <StatCard label="Pass denna vecka" value="0" />
      </section>

      <section className="mt-6 rounded-lg border border-dashed border-ink-700 bg-ink-850/50 px-6 py-12 text-center">
        <p className="text-sm font-medium text-ink-100">
          Översikten är tom så länge
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-400">
          {isCoach
            ? "När du lagt till adepter och byggt planer samlas allt här: kommande pass, senaste testresultat och adepter som behöver din uppmärksamhet."
            : "När din coach lagt upp planer och testresultat samlas allt här."}
        </p>
        {isCoach && (
          <Link
            href={routes.adepts}
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-strong"
          >
            Gå till Adepter
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
      </section>
    </>
  );
}
