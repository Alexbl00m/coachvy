"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { emptyFormState, type FormState } from "@/lib/form-state";
import type { Adept } from "@/lib/types/database";

export const LEVELS = [
  "Nybörjare",
  "Motionär",
  "Erfaren",
  "Tävlingsaktiv",
  "Elit",
];

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * Shared by "Lägg till adept" and the edit form on the detail page — the only
 * difference is which Server Function runs and whether an id is carried along.
 */
export function AdeptForm({
  action,
  adept,
  submitLabel,
  onCancel,
}: {
  action: Action;
  adept?: Adept;
  submitLabel: string;
  onCancel?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, emptyFormState);

  // After a failed submit React resets the form, so fall back to the echoed
  // values before the row's own values.
  const initial = (key: keyof Adept) =>
    state.values?.[key] ?? (adept?.[key] as string | null) ?? "";

  const level = initial("current_level");

  return (
    <form action={formAction} className="space-y-4">
      {adept && <input type="hidden" name="id" value={adept.id} />}

      <FormMessage error={state.error} notice={state.notice} />

      <Field label="Namn" htmlFor="full_name">
        <Input
          id="full_name"
          name="full_name"
          required
          defaultValue={initial("full_name")}
          placeholder="För- och efternamn"
        />
      </Field>

      <Field
        label="E-post"
        htmlFor="email"
        optional
        hint="Används för att bjuda in adepten till ett eget konto längre fram."
      >
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={initial("email")}
          placeholder="adept@exempel.se"
        />
      </Field>

      <Field label="Sport" htmlFor="sport" optional>
        <Input
          id="sport"
          name="sport"
          defaultValue={initial("sport")}
          placeholder="T.ex. triathlon, löpning, cykel"
        />
      </Field>

      <Field label="Mål" htmlFor="goal" optional>
        <Textarea
          id="goal"
          name="goal"
          rows={3}
          defaultValue={initial("goal")}
          placeholder="T.ex. sub 3 på maraton i höst"
        />
      </Field>

      <Field label="Nuvarande nivå" htmlFor="current_level" optional>
        {/* Keyed so the form reset after a failed submit restores the choice:
            a <select> only picks up defaultValue when it mounts. */}
        <Select
          key={`level-${level}`}
          id="current_level"
          name="current_level"
          defaultValue={level}
        >
          <option value="">Ej angiven</option>
          {LEVELS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" disabled={pending} className="font-semibold">
          {pending ? "Sparar…" : submitLabel}
        </Button>
        {onCancel}
      </div>
    </form>
  );
}
