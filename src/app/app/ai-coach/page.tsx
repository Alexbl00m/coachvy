import Link from "next/link";

import { AiCoachChat } from "@/components/ai-coach/ai-coach-chat";
import { PageHeader } from "@/components/page-header";
import { aiBlockedMessage } from "@/lib/adepts/consent-state";
import { listAdepts, getAdept, getConsentState } from "@/lib/adepts/queries";
import { getConversation, listAiMessages } from "@/lib/ai-coach/queries";
import { requireCoach } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { isAnthropicConfigured } from "@/lib/workouts/env";
import { contextForAdept } from "@/lib/workouts/generate";

export const metadata = { title: "AI Coach Assistant" };

/**
 * Bollplank om en adept.
 *
 * Adepten ligger i adressen av samma skäl som i passbyggaren: underlaget
 * hämtas då på servern där det redan finns, och länken går att spara.
 */
export default async function AiCoachPage({
  searchParams,
}: PageProps<"/app/ai-coach">) {
  const user = await requireCoach();

  const query = await searchParams;
  const adeptId = typeof query.adept === "string" ? query.adept : null;

  const [adepts, adept, context] = await Promise.all([
    listAdepts(),
    adeptId ? getAdept(adeptId) : Promise.resolve(null),
    adeptId ? contextForAdept(adeptId) : Promise.resolve(null),
  ]);

  const [conversation, consent] = adept
    ? await Promise.all([
        getConversation(adept.id, user.id),
        getConsentState(adept),
      ])
    : [null, null];
  const messages = conversation ? await listAiMessages(conversation.id) : [];

  return (
    <>
      <PageHeader
        title="AI Coach Assistant"
        description="Fråga om en adept och få svar som räknar på adeptens egna mätta värden – inte på allmänna träningsråd."
      />

      <p className="-mt-2 mb-5 text-[0.8125rem] text-text-subtle">
        {user.coach?.philosophy?.trim()
          ? user.coach.philosophy_mode === "ersatt"
            ? "Svarar utifrån din egen träningsfilosofi."
            : "Svarar utifrån Coachvys grundfilosofi med din egen ovanpå."
          : "Svarar utifrån Coachvys grundfilosofi."}{" "}
        <Link
          href={`${routes.settings}#filosofi`}
          className="font-medium text-text underline decoration-line-strong underline-offset-2 hover:decoration-text"
        >
          {user.coach?.philosophy?.trim()
            ? "Ändra din filosofi"
            : "Lägg till din egen"}
        </Link>
      </p>

      <AiCoachChat
        adepts={adepts.map((a) => ({ id: a.id, full_name: a.full_name }))}
        adeptId={adept?.id ?? null}
        adeptName={adept?.full_name ?? null}
        context={context}
        messages={messages}
        configured={isAnthropicConfigured()}
        blocked={
          adept && consent?.kind !== "godkänt" && consent
            ? aiBlockedMessage(adept.full_name, consent)
            : null
        }
      />
    </>
  );
}
