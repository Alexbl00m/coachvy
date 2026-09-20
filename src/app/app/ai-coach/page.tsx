import { AiCoachChat } from "@/components/ai-coach/ai-coach-chat";
import { PageHeader } from "@/components/page-header";
import { listAdepts, getAdept } from "@/lib/adepts/queries";
import { getConversation, listAiMessages } from "@/lib/ai-coach/queries";
import { requireCoach } from "@/lib/auth/session";
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

  const conversation = adept ? await getConversation(adept.id, user.id) : null;
  const messages = conversation ? await listAiMessages(conversation.id) : [];

  return (
    <>
      <PageHeader
        title="AI Coach Assistant"
        description="Fråga om en adept och få svar som räknar på hennes egna mätta värden – inte på allmänna träningsråd."
      />

      <AiCoachChat
        adepts={adepts.map((a) => ({ id: a.id, full_name: a.full_name }))}
        adeptId={adept?.id ?? null}
        adeptName={adept?.full_name ?? null}
        context={context}
        messages={messages}
        configured={isAnthropicConfigured()}
      />
    </>
  );
}
