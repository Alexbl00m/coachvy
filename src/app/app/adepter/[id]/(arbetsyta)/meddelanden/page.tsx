import { MessageThread } from "@/components/messages/message-thread";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { listMessages } from "@/lib/messages/queries";

export const metadata = { title: "Meddelanden" };

export default async function AdeptMessagesPage({
  params,
}: PageProps<"/app/adepter/[id]/meddelanden">) {
  const { adept, user } = await loadWorkspace(params);
  const messages = await listMessages(adept.id);
  return (
    <MessageThread
      adeptId={adept.id}
      messages={messages}
      viewerId={user.id}
      adeptProfileId={adept.profile_id}
      adeptName={adept.full_name}
    />
  );
}
