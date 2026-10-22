import Link from "next/link";
import { Download } from "lucide-react";

import { ReferenceLevelsEditor } from "@/components/benchmarks/reference-levels-editor";
import { MeetingRoomForm } from "@/components/settings/meeting-room-form";
import { PhilosophyEditor } from "@/components/settings/philosophy-editor";
import { PageHeader } from "@/components/page-header";
import {
  ConsentToggle,
  NameForm,
  PasswordForm,
} from "@/components/settings/settings-forms";
import { buttonClass } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { FOUNDATION_TEXT } from "@/lib/ai-coach/philosophy";
import { isMember } from "@/lib/auth/membership";
import { requireSessionUser } from "@/lib/auth/session";
import { referenceLevelsFor } from "@/lib/benchmarks/queries";
import { routes } from "@/lib/routes";
import { longDate, todayIso } from "@/lib/season/season";
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
      <dt className="text-[0.8125rem] text-text-muted">{label}</dt>
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
                className="text-text underline decoration-line-strong underline-offset-2 hover:decoration-text"
              >
                {site.email}
              </a>
              . Mer om hur uppgifterna behandlas står i{" "}
              <Link
                href={routes.privacy}
                className="text-text underline decoration-line-strong underline-offset-2 hover:decoration-text"
              >
                integritetspolicyn
              </Link>
              .
            </p>
          </div>
        </Card>

        {isCoach && (
          <section id="videosamtal" className="min-w-0">
            <Card className="min-w-0">
              <CardTitle>Videosamtal</CardTitle>
              <p className="mb-4 text-sm leading-relaxed text-text-muted">
                Samtalen med adepterna går i ditt eget mötesrum. Från en adepts
                meddelanden ringer du direkt eller bokar en tid; adepten får ett
                kort i tråden att gå med från, och bokade samtal syns i
                kalendern och i adeptens Idag.
              </p>
              <MeetingRoomForm url={user.coach?.meeting_url ?? null} />
            </Card>
          </section>
        )}

        {isCoach && (
          <section id="filosofi" className="min-w-0 lg:col-span-2">
            <Card className="min-w-0">
              <CardTitle>Din träningsfilosofi</CardTitle>
              <p className="mb-4 max-w-3xl text-sm leading-relaxed text-text-muted">
                AI-coachen och passbyggaren resonerar utifrån Coachvys
                grundfilosofi: en stor aerob grund, polariserat i grunden och
                mer tröskel och tävlingsfart när loppet närmar sig, fokuserade
                block som byggs på en variabel i taget, och planen som en
                hypotes som responsen prövar. Skriv din egen så svarar de som
                din assistent i stället – i dina frågor, i dina pass och i
                passen dina medlemsadepter bygger åt sig själva.
              </p>
              <PhilosophyEditor
                text={user.coach?.philosophy ?? ""}
                mode={
                  user.coach?.philosophy_mode === "ersatt"
                    ? "ersatt"
                    : "komplettera"
                }
                updatedAt={
                  user.coach?.philosophy_updated_at
                    ? longDate(
                        user.coach.philosophy_updated_at.slice(0, 10),
                        todayIso(),
                      )
                    : null
                }
              />
              <details className="mt-6 border-t border-line pt-4">
                <summary className="cursor-pointer text-[0.8125rem] font-medium text-text">
                  Läs Coachvys grundfilosofi
                </summary>
                <div className="mt-3 max-h-[28rem] overflow-y-auto rounded-md border border-line bg-surface-2 p-4">
                  <p className="max-w-prose whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-text-muted">
                    {FOUNDATION_TEXT}
                  </p>
                </div>
              </details>
            </Card>
          </section>
        )}

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
