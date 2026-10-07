import Link from "next/link";
import { Download } from "lucide-react";

import { ReferenceLevelsEditor } from "@/components/benchmarks/reference-levels-editor";
import { PageHeader } from "@/components/page-header";
import {
  ConsentToggle,
  NameForm,
  PasswordForm,
} from "@/components/settings/settings-forms";
import { buttonClass } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { isMember } from "@/lib/auth/membership";
import { requireSessionUser } from "@/lib/auth/session";
import { referenceLevelsFor } from "@/lib/benchmarks/queries";
import { routes } from "@/lib/routes";
import { longDate } from "@/lib/season/season";
import { site } from "@/lib/site";

export const metadata = { title: "Inställningar" };

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
      <dt className="text-[13px] text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{children}</dd>
    </div>
  );
}

export default async function InstallningarPage() {
  const user = await requireSessionUser();
  const isCoach = user.profile?.role === "coach";
  const consentAt = user.profile?.health_consent_at ?? null;
  const termsAt = user.profile?.accepted_terms_at ?? null;
  const levels = isCoach ? await referenceLevelsFor(user.id) : null;

  return (
    <>
      <PageHeader
        title="Inställningar"
        description="Ditt konto, ditt samtycke och dina uppgifter."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardTitle>Konto</CardTitle>
          <dl className="mb-5 divide-y divide-line">
            <Row label="E-post">{user.email}</Row>
            <Row label="Kontotyp">{isCoach ? "Coach" : "Adept"}</Row>
            <Row label="Medlemskap">
              {user.isAdmin ? "Admin" : isMember(user) ? "Medlem" : "Bas"}
            </Row>
            <Row label="Villkoren godkända">
              {termsAt ? longDate(termsAt.slice(0, 10)) : "–"}
            </Row>
          </dl>
          <NameForm name={user.profile?.full_name ?? ""} />
        </Card>

        <Card className="min-w-0">
          <CardTitle>Lösenord</CardTitle>
          <PasswordForm />
        </Card>

        <Card className="min-w-0">
          <CardTitle>Hälsouppgifter och samtycke</CardTitle>
          {isCoach ? (
            <div className="space-y-2 text-sm leading-relaxed text-text-muted">
              <p>
                Laktat, puls, syreupptag, kroppssammansättning, skador och sömn
                är hälsouppgifter. Dem får du registrera om dina adepter när de
                har samtyckt till det.
              </p>
              <p>
                En adept med konto ger sitt samtycke i appen, och på adeptsidan
                ser du om det saknas. För en adept utan konto ansvarar du själv
                för att samtycket finns.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-text-muted">
                {consentAt ? (
                  <>
                    Du samtyckte{" "}
                    <span className="text-text">
                      {longDate(consentAt.slice(0, 10))}
                    </span>{" "}
                    till att dina hälsouppgifter – laktat, puls, syreupptag,
                    kroppssammansättning, sömn och skador – behandlas för att
                    följa och planera din träning.
                  </>
                ) : (
                  <>
                    Du har inte samtyckt till att dina hälsouppgifter behandlas.
                    Utan samtycket kan din coach inte följa dina tester och ditt
                    mående i appen.
                  </>
                )}
              </p>
              <ConsentToggle given={consentAt !== null} />
            </div>
          )}
        </Card>

        <Card className="min-w-0">
          <CardTitle>Mina uppgifter</CardTitle>
          <div className="space-y-4 text-sm leading-relaxed text-text-muted">
            <p>
              Ladda ned allt appen har om dig som en fil – profil, tester,
              incheckningar, pass, tävlingar och meddelanden.
            </p>
            <a
              href={`${routes.settings}/export`}
              download
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              <Download aria-hidden className="size-4" />
              Ladda ned mina uppgifter
            </a>
            <p>
              Vill du att kontot och uppgifterna raderas, skriv till{" "}
              <a
                href={`mailto:${site.email}`}
                className="text-accent hover:text-accent-strong"
              >
                {site.email}
              </a>
              . Mer om hur uppgifterna behandlas står i{" "}
              <Link
                href={routes.privacy}
                className="text-accent hover:text-accent-strong"
              >
                integritetspolicyn
              </Link>
              .
            </p>
          </div>
        </Card>

        {levels && (
          <section id="referensnivaer" className="min-w-0 lg:col-span-2">
            <Card className="min-w-0">
              <CardTitle>Referensnivåer</CardTitle>
              <p className="mb-4 max-w-3xl text-sm leading-relaxed text-text-muted">
                Grupperna adepternas tester jämförs mot under Progression → Mål
                och referens, och som målnivå i gap-analysen. De står från lägst
                till högst nivå. Byt värdena mot dina egna, döp om dem eller
                lägg till en grupp – till exempel svensk elit ur dina labbdata.
                {levels.isDefault &&
                  " Nu gäller Coachvys utgångsnivåer, satta ur de spann som brukar anges för uthållighetsinriktade cyklister."}
              </p>
              <ReferenceLevelsEditor
                groups={levels.groups}
                isDefault={levels.isDefault}
              />
            </Card>
          </section>
        )}
      </div>
    </>
  );
}
