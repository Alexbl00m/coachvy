"use client";

import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { saveMeetingUrl } from "@/lib/calls/actions";

/** Länken till coachens mötesrum, som alla videosamtal går i. */
export function MeetingRoomForm({ url }: { url: string | null }) {
  const id = useId();
  const [value, setValue] = useState(url ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await saveMeetingUrl(value);
          setFailed(!result.ok);
          setMessage(
            result.ok
              ? value.trim()
                ? "Sparat. Ring och boka från adeptens meddelanden."
                : "Mötesrummet är borttaget."
              : result.error,
          );
        });
      }}
    >
      <Field
        label="Länk till ditt mötesrum"
        htmlFor={id}
        hint="Ditt personliga rum i Google Meet, Zoom eller Teams – samma länk varje gång."
      >
        <Input
          id={id}
          type="url"
          inputMode="url"
          value={value}
          placeholder="https://meet.google.com/abc-defg-hij"
          onChange={(e) => setValue(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? "Sparar …" : "Spara"}
        </Button>
        {message && (
          <span
            role={failed ? "alert" : "status"}
            className={
              failed ? "text-[0.8125rem] text-bad" : "text-[0.8125rem] text-text-muted"
            }
          >
            {message}
          </span>
        )}
      </div>
    </form>
  );
}
