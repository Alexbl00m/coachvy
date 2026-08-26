"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { emptyFormState } from "@/lib/form-state";
import { submitLead } from "@/lib/leads/actions";

export function ContactForm() {
  const [state, formAction, pending] = useActionState(
    submitLead,
    emptyFormState,
  );

  // A successful send clears the form, so the fields are not re-seeded here.
  const sent = Boolean(state.notice);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage error={state.error} notice={state.notice} />

      {/* Honeypot — hidden from people, tempting to bots. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 overflow-hidden">
        <label htmlFor="company">Företag</label>
        <input id="company" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Förnamn" htmlFor="first_name">
          <Input
            id="first_name"
            name="first_name"
            autoComplete="given-name"
            required
            defaultValue={sent ? "" : (state.values?.first_name ?? "")}
          />
        </Field>
        <Field label="Efternamn" htmlFor="last_name" optional>
          <Input
            id="last_name"
            name="last_name"
            autoComplete="family-name"
            defaultValue={sent ? "" : (state.values?.last_name ?? "")}
          />
        </Field>
      </div>

      <Field label="E-post" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={sent ? "" : (state.values?.email ?? "")}
          placeholder="du@exempel.se"
        />
      </Field>

      <Field label="Meddelande" htmlFor="message">
        <Textarea
          id="message"
          name="message"
          rows={5}
          required
          maxLength={5000}
          defaultValue={sent ? "" : (state.values?.message ?? "")}
          placeholder="Berätta kort om din träningsbakgrund och vad du vill uppnå."
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full font-semibold">
        {pending ? "Skickar…" : "Skicka meddelande"}
        {!pending && <Send aria-hidden className="size-4" />}
      </Button>
    </form>
  );
}
