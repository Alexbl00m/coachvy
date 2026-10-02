import type { ReactNode } from "react";

import { routes } from "@/lib/routes";
import { site } from "@/lib/site";

export const metadata = { title: "Integritetspolicy & villkor" };

const UPDATED = "30 september 2026";

const sections = [
  { id: "ansvarig", title: "Personuppgiftsansvarig" },
  { id: "uppgifter", title: "Vilka uppgifter vi behandlar" },
  { id: "grund", title: "Ändamål och rättslig grund" },
  { id: "mottagare", title: "Vilka som får del av uppgifterna" },
  { id: "lagring", title: "Lagringstid" },
  { id: "rattigheter", title: "Dina rättigheter" },
  { id: "cookies", title: "Cookies och lokal lagring" },
  { id: "villkor", title: "Användarvillkor" },
  { id: "kontakt", title: "Kontakt" },
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-text-muted">
        {children}
      </div>
    </section>
  );
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            aria-hidden
            className="mt-2.5 size-1.5 shrink-0 rounded-full bg-text-subtle"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const Mail = () => (
  <a href={`mailto:${site.email}`} className="text-accent-text hover:underline">
    {site.email}
  </a>
);

/**
 * Integritetspolicy och användarvillkor för Coachvy.
 *
 * Skriven efter vad appen faktiskt gör: vilka tabeller som finns, vad som
 * skickas till AI-tjänsten och vad som sparas i webbläsaren. Ändras något av
 * det ska texten följa med.
 */
export default function IntegritetspolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">
        Integritetspolicy & villkor
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-text-muted">
        Coachvy är en plattform för testning, analys och planering av
        uthållighetsträning, där coacher och adepter arbetar tillsammans. Här
        står vilka uppgifter som behandlas, varför och hur, och vilka villkor
        som gäller för att använda tjänsten.
      </p>
      <p className="mt-2 text-[13px] text-text-subtle">
        Senast uppdaterad {UPDATED}.
      </p>

      <nav
        aria-label="Innehåll"
        className="mt-8 rounded-lg border border-line bg-surface-2 px-5 py-4"
      >
        <ol className="grid gap-1.5 text-[14px] sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-text-muted hover:text-text">
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-12 space-y-10">
        <Section id="ansvarig" title="1. Personuppgiftsansvarig">
          <p>
            {site.name}, {site.location}, är personuppgiftsansvarig för Coachvy.
            Frågor om hur uppgifterna behandlas går till <Mail />.
          </p>
          <p>
            När en coach registrerar uppgifter om sina adepter – tester, pass,
            anteckningar – ansvarar coachen för att ha stöd för det. I praktiken
            betyder det adeptens samtycke; en adept med eget konto ger det i
            appen.
          </p>
        </Section>

        <Section id="uppgifter" title="2. Vilka uppgifter vi behandlar">
          <List
            items={[
              <>
                <strong className="text-text">Konto:</strong> namn, e-post,
                kontotyp (coach eller adept), medlemskap och när villkoren och
                samtycket godkändes.
              </>,
              <>
                <strong className="text-text">Träningsprofil:</strong>{" "}
                födelseår, kön, längd, träningsbakgrund, mål, styrkor och
                svagheter – och om du fyller i det, skador och medicinska
                förhållanden.
              </>,
              <>
                <strong className="text-text">Tester:</strong> effekt, fart,
                laktat, puls, syreupptag, kroppsvikt, kroppsfett och beräkningar
                ur dem, som trösklar och zoner. Importerade träningsfiler läses
                i webbläsaren; bara de uppgifter som sparas i ett test lagras.
              </>,
              <>
                <strong className="text-text">Genomförda pass och lopp:</strong>{" "}
                tid, distans, fart, effekt, puls, kadens och höjd, och var du
                befann dig längs rutten (GPS), ur filer från klockan eller
                cykeldatorn. Filen läses i webbläsaren och sparas inte; det som
                sparas är analysen och en förenklad kurva för kartan och
                graferna.
              </>,
              <>
                <strong className="text-text">Mående och belastning:</strong>{" "}
                dagliga incheckningar med ansträngning (RPE), passlängd, sömn,
                trötthet, muskelömhet och stress.
              </>,
              <>
                <strong className="text-text">Planering:</strong> pass,
                säsongsplan, tävlingar och mål.
              </>,
              <>
                <strong className="text-text">Kommunikation:</strong>{" "}
                meddelanden mellan coach och adept, inlägg och kommentarer i
                communityn, och coachens frågor till AI-coachen.
              </>,
              <>
                <strong className="text-text">Kontaktformuläret</strong> på den
                publika sajten: det du skriver i det.
              </>,
            ]}
          />
          <p>
            Uppgifter om hälsa – som laktat, puls, syreupptag,
            kroppssammansättning, sömn och skador – är känsliga personuppgifter
            och behandlas bara med ditt uttryckliga samtycke.
          </p>
        </Section>

        <Section id="grund" title="3. Ändamål och rättslig grund">
          <List
            items={[
              <>
                <strong className="text-text">Kontot och tjänsten</strong> – att
                du ska kunna logga in, registrera tester och följa din träning –
                bygger på avtalet med dig (dataskyddsförordningen artikel 6.1
                b).
              </>,
              <>
                <strong className="text-text">Hälsouppgifterna</strong>{" "}
                behandlas på ditt uttryckliga samtycke (artikel 9.2 a). Det ges
                separat från villkoren och kan tas tillbaka när som helst under
                Inställningar. Att ta tillbaka det påverkar inte den behandling
                som redan skett.
              </>,
              <>
                <strong className="text-text">Säkerhet och drift</strong> –
                inloggningsloggar och felsökning – bygger på vårt berättigade
                intresse av en säker tjänst (artikel 6.1 f).
              </>,
              <>
                <strong className="text-text">Kontaktformuläret</strong> bygger
                på vårt berättigade intresse av att kunna svara dig.
              </>,
            ]}
          />
          <p>Uppgifterna används inte för reklam och säljs inte till någon.</p>
        </Section>

        <Section id="mottagare" title="4. Vilka som får del av uppgifterna">
          <p>
            Din coach ser det du registrerar, och du ser det din coach
            registrerar om dig. Andra användare ser bara det du själv skriver i
            communityn. Behörigheterna ligger i databasen och gäller oavsett hur
            uppgifterna efterfrågas.
          </p>
          <p>
            Tjänsten drivs med hjälp av personuppgiftsbiträden, som bara
            behandlar uppgifterna för att tillhandahålla sin del av tjänsten:
          </p>
          <List
            items={[
              <>
                <strong className="text-text">Supabase</strong> – databas och
                inloggning.
              </>,
              <>
                <strong className="text-text">Vercel</strong> – drift av
                webbplatsen.
              </>,
              <>
                <strong className="text-text">Resend</strong> – utskick av mejl:
                bekräftelse av konto, återställt lösenord, inbjudningar från din
                coach och svar på kontaktformuläret. Resend får mottagarens
                adress och mejlets innehåll, inga mätvärden.
              </>,
              <>
                <strong className="text-text">Anthropic</strong> – AI-coachen
                och passbyggaren. När en coach ställer en fråga eller bygger ett
                pass skickas adeptens mätta värden, träningsbakgrund och
                belastning med för att svaret ska bygga på dem. Det görs bara
                för adepter som har gett sitt samtycke, och adeptens namn
                skickas inte.
              </>,
            ]}
          />
          <p>
            Kartorna i loppanalysen hämtas från OpenStreetMap. Webbläsaren ber
            då deras servrar om kartbitarna för området kring rutten, och de ser
            din IP-adress och vilket område som visas – men inte rutten, namnet
            eller några mätvärden.
          </p>
          <p>
            Några biträden har verksamhet utanför EU/EES, bland annat i USA.
            Överföringen sker då med de skyddsåtgärder dataskyddsförordningen
            kräver, till exempel EU-kommissionens standardavtalsklausuler.
          </p>
        </Section>

        <Section id="lagring" title="5. Lagringstid">
          <p>
            Uppgifterna sparas så länge kontot finns, eftersom det är historiken
            – tester över flera säsonger – som gör dem användbara. När du
            avslutar kontot raderas dina uppgifter, utom det som måste sparas
            enligt lag. En förfrågan via kontaktformuläret sparas tills ärendet
            är avslutat.
          </p>
        </Section>

        <Section id="rattigheter" title="6. Dina rättigheter">
          <List
            items={[
              <>
                <strong className="text-text">
                  Tillgång och dataportabilitet:
                </strong>{" "}
                ladda ned allt appen har om dig som en fil under{" "}
                <a
                  href={routes.settings}
                  className="text-accent-text hover:underline"
                >
                  Inställningar
                </a>
                .
              </>,
              <>
                <strong className="text-text">Rättelse:</strong> det mesta
                ändrar du själv i appen; annat rättar vi på begäran.
              </>,
              <>
                <strong className="text-text">Radering och begränsning:</strong>{" "}
                be om att kontot och uppgifterna raderas, eller att behandlingen
                begränsas, via <Mail />.
              </>,
              <>
                <strong className="text-text">Återkalla samtycke:</strong> under
                Inställningar, lika enkelt som det gavs.
              </>,
              <>
                <strong className="text-text">Invändning:</strong> mot
                behandling som bygger på berättigat intresse.
              </>,
            ]}
          />
          <p>
            Är du missnöjd med hur uppgifterna hanteras kan du vända dig till
            Integritetsskyddsmyndigheten, IMY (imy.se).
          </p>
        </Section>

        <Section id="cookies" title="7. Cookies och lokal lagring">
          <p>
            Coachvy använder bara de cookies som behövs för att hålla dig
            inloggad. Det finns inga cookies för statistik, spårning eller
            annonser, och därför ingen cookie-banner.
          </p>
          <p>
            Några val sparas i webbläsarens lokala lagring så att de finns kvar
            nästa gång – till exempel cykelposition och vikt i zonkalkylen och
            vilka markörer som visas i utnyttjandegraden. De lämnar aldrig din
            enhet.
          </p>
        </Section>

        <Section id="villkor" title="8. Användarvillkor">
          <p>
            Villkoren gäller mellan dig och {site.name} när du använder Coachvy.
          </p>
          <List
            items={[
              <>
                <strong className="text-text">Kontot</strong> är personligt.
                Uppgifterna ska vara riktiga och lösenordet ska hållas hemligt.
              </>,
              <>
                <strong className="text-text">Som coach</strong> registrerar du
                bara uppgifter om adepter som samtyckt till det, och tar bort
                dem när adepten ber om det.
              </>,
              <>
                <strong className="text-text">
                  Inte medicinsk rådgivning.
                </strong>{" "}
                Trösklar, zoner, prognoser och AI-svar är beräkningar och
                uppskattningar som stöd för träningen, inte en bedömning av din
                hälsa. Vid skada, sjukdom eller symtom vid ansträngning –
                kontakta vården. Träningen sker på eget ansvar.
              </>,
              <>
                <strong className="text-text">AI-coachen</strong> kan ha fel.
                Svaren bygger på de mätta värdena men ersätter inte coachens
                bedömning; beslutet är alltid coachens.
              </>,
              <>
                <strong className="text-text">Medlemskap:</strong> bas ger
                kontot, adepterna och testerna; medlemskapet lägger till
                verktygen, som communityn och passbyggaren för adepter.
              </>,
              <>
                <strong className="text-text">Communityn</strong> är till för
                träning. Skriv respektfullt och dela inte andras
                personuppgifter. Inlägg som bryter mot det kan tas bort.
              </>,
              <>
                <strong className="text-text">Ditt innehåll</strong> är ditt. Vi
                lagrar och visar det bara för att tjänsten ska fungera.
              </>,
              <>
                <strong className="text-text">Avslut:</strong> du kan avsluta
                kontot när som helst. Konton som bryter mot villkoren kan
                stängas.
              </>,
              <>
                <strong className="text-text">Väsentliga ändringar</strong> i
                villkoren meddelas innan de gäller. Svensk lag gäller.
              </>,
            ]}
          />
        </Section>

        <Section id="kontakt" title="9. Kontakt">
          <p>
            {site.name}, {site.location}
            <br />
            <Mail />
          </p>
        </Section>
      </div>
    </div>
  );
}
