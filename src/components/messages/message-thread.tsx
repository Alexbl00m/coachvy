"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { deleteMessage, markThreadRead, sendMessage } from "@/lib/messages/actions";
import type { CoachMessageRow } from "@/lib/types/database";

/**
 * Samtalet mellan coach och adept.
 *
 * Avsändaren visas relativt läsaren – "Du" eller motpartens namn – i stället
 * för att slås upp i profiltabellen. Det sparar inte bara en fråga: en adept
 * har inte nödvändigtvis läsrätt på sin coachs profilrad, och en tråd som
 * kraschar för ena parten men inte den andra är en obehaglig bugg att hitta.
 */

const timestamp = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return sameDay ? time : `${iso.slice(0, 10)} ${time}`;
};

export function MessageThread({
  adeptId,
  messages,
  viewerId,
  adeptProfileId,
  adeptName,
}: {
  adeptId: string;
  /** Äldst först. */
  messages: CoachMessageRow[];
  viewerId: string;
  /** Adeptens profil-id, för att kunna skilja parterna åt. */
  adeptProfileId: string | null;
  adeptName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const unread = messages.filter(
    (m) => m.sender_id !== viewerId && m.read_at === null,
  ).length;

  // Att öppna tråden är att läsa den. Markeringen sker en gång per öppning.
  useEffect(() => {
    if (unread === 0) return;
    void markThreadRead(adeptId);
    // Avsiktligt bara vid montering: en ommarkering vid varje render skulle
    // trigga en ny serverrunda för varje uppdatering av listan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adeptId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  const send = () =>
    startTransition(async () => {
      setError(null);
      const result = await sendMessage({ adeptId, body });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      router.refresh();
    });

  const remove = (id: string) =>
    startTransition(async () => {
      await deleteMessage(id, adeptId);
      router.refresh();
    });

  const senderName = (message: CoachMessageRow) => {
    if (message.sender_id === viewerId) return "Du";
    if (adeptProfileId && message.sender_id === adeptProfileId) return adeptName;
    return "Coachen";
  };

  return (
    <Card className="min-w-0">
      <CardTitle>Meddelanden</CardTitle>

      {messages.length === 0 ? (
        <p className="text-sm text-text-muted">
          Inga meddelanden ännu. Det som skrivs här hör till den här adepten och
          syns bara för er två.
        </p>
      ) : (
        <ul className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
          {messages.map((message) => {
            const mine = message.sender_id === viewerId;
            return (
              <li
                key={message.id}
                className={cn("flex", mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "group max-w-[85%] rounded-lg border px-3 py-2",
                    mine
                      ? "border-accent/40 bg-accent-soft"
                      : "border-line bg-surface-2",
                  )}
                >
                  <p className="flex items-baseline gap-2 text-[11px] text-text-subtle">
                    <span className="font-medium text-text-muted">
                      {senderName(message)}
                    </span>
                    <span className="tabular-nums">
                      {timestamp(message.created_at)}
                    </span>
                    {!mine && message.read_at === null && (
                      <span className="rounded bg-accent/20 px-1 text-accent">
                        ny
                      </span>
                    )}
                    {mine && (
                      <button
                        type="button"
                        aria-label="Ta bort meddelandet"
                        onClick={() => remove(message.id)}
                        className="ml-auto rounded p-0.5 text-text-subtle opacity-0 transition-opacity hover:text-accent focus:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 aria-hidden className="size-3.5" />
                      </button>
                    )}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-text">
                    {message.body}
                  </p>
                </div>
              </li>
            );
          })}
          <div ref={bottom} />
        </ul>
      )}

      <div className="mt-4 space-y-3 border-t border-line pt-4">
        <Textarea
          aria-label="Nytt meddelande"
          rows={3}
          value={body}
          placeholder="Skriv ett meddelande …"
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl/Cmd + Enter skickar. Enter ensamt ger radbrytning, vilket
            // ett meddelande om ett träningspass oftare behöver.
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && body.trim()) {
              e.preventDefault();
              send();
            }
          }}
        />

        {error && <p className="text-sm text-text">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={send}
            disabled={pending || body.trim().length === 0}
          >
            <Send aria-hidden className="size-4" />
            {pending ? "Skickar …" : "Skicka"}
          </Button>
          <span className="text-[13px] text-text-subtle">
            Ctrl + Enter skickar.
          </span>
        </div>
      </div>
    </Card>
  );
}
