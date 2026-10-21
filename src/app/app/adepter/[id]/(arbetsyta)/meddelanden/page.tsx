import { MessageThread } from "@/components/messages/message-thread";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { listCalls } from "@/lib/calls/queries";
import { listMessages } from "@/lib/messages/queries";
import { todayIso } from "@/lib/season/season";

export const metadata = { title: "Meddelanden" };

export default async function AdeptMessagesPage({
  params,
}: PageProps<"/app/adepter/[id]/meddelanden">) {
  const { adept, user, canEdit } = await loadWorkspace(params);
  const [messages, calls] = await Promise.all([
    listMessages(adept.id),
    listCalls(adept.id),
  ]);
  return (
    <MessageThread
      adeptId={adept.id}
      messages={messages}
      viewerId={user.id}
      adeptProfileId={adept.profile_id}
      adeptName={adept.full_name}
      calls={calls}
      // Serverns tid: samtalets läge ska bli detsamma i webbläsaren.
      // eslint-disable-next-line react-hooks/purity
      now={Date.now()}
      coach={
        canEdit
          ? { meetingUrl: user.coach?.meeting_url ?? null, today: todayIso() }
          : null
      }
    />
  );
}
