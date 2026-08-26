"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { signUp, type AuthFormState } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import type { AccountRole } from "@/lib/types/database";

const initialState: AuthFormState = {};

const roleOptions: { value: AccountRole; label: string; hint: string }[] = [
  { value: "coach", label: "Coach", hint: "Jag tränar andra" },
  { value: "adept", label: "Adept", hint: "Jag blir tränad" },
];

const levels = ["Nybörjare", "Motionär", "Erfaren", "Tävlingsaktiv", "Elit"];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full font-semibold">
      {pending ? "Skapar konto…" : "Skapa konto"}
    </Button>
  );
}

export function SignUpForm() {
  const [state, formAction] = useActionState(signUp, initialState);
  const [role, setRole] = useState<AccountRole>("coach");

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="role" value={role} />

      <FormMessage error={state.error} notice={state.notice} />

      <fieldset className="space-y-1.5">
        <legend className="pb-1.5 text-[13px] font-medium text-ink-200">
          Kontotyp
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {roleOptions.map((option) => {
            const selected = role === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setRole(option.value)}
                className={cn(
                  "rounded-md border px-3 py-2.5 text-left transition-colors",
                  selected
                    ? "border-accent bg-accent-soft"
                    : "border-ink-600 bg-ink-850 hover:border-ink-500",
                )}
              >
                <span
                  className={cn(
                    "block text-sm font-medium",
                    selected ? "text-ink-50" : "text-ink-200",
                  )}
                >
                  {option.label}
                </span>
                <span className="block text-[11px] text-ink-400">
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label="Namn" htmlFor="full_name">
        <Input
          id="full_name"
          name="full_name"
          autoComplete="name"
          required
          defaultValue={state.values?.full_name ?? ""}
          placeholder="För- och efternamn"
        />
      </Field>

      <Field label="E-post" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email ?? ""}
          placeholder="du@exempel.se"
        />
      </Field>

      <Field label="Lösenord" htmlFor="password" hint="Minst 8 tecken.">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="••••••••"
        />
      </Field>

      {role === "coach" ? (
        <Field label="Företagsnamn" htmlFor="company_name" optional>
          <Input
            id="company_name"
            name="company_name"
            autoComplete="organization"
            defaultValue={state.values?.company_name ?? ""}
            placeholder="T.ex. Lindblom Coaching"
          />
        </Field>
      ) : (
        <>
          <Field label="Sport" htmlFor="sport">
            <Input
              id="sport"
              name="sport"
              defaultValue={state.values?.sport ?? ""}
              placeholder="T.ex. triathlon, löpning, cykel"
            />
          </Field>

          <Field label="Mål" htmlFor="goal">
            <Textarea
              id="goal"
              name="goal"
              rows={3}
              defaultValue={state.values?.goal ?? ""}
              placeholder="T.ex. sub 3 på maraton i höst"
            />
          </Field>

          <Field label="Nuvarande nivå" htmlFor="current_level">
            {/* Remounted on each response: a <select> only picks up a new
                defaultValue at mount, so without the key the form reset that
                follows a failed submit would drop the choice. */}
            <Select
              key={`level-${state.values?.current_level ?? ""}`}
              id="current_level"
              name="current_level"
              defaultValue={state.values?.current_level ?? ""}
            >
              <option value="" disabled>
                Välj nivå
              </option>
              {levels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </Select>
          </Field>
        </>
      )}

      {/* The link stays outside the <label> so clicking it does not toggle the box. */}
      <div className="flex items-start gap-2.5 pt-1 text-[13px] text-ink-300">
        <input
          id="accepted_terms"
          name="accepted_terms"
          type="checkbox"
          required
          defaultChecked={state.values?.accepted_terms ?? false}
          className="mt-0.5 size-4 shrink-0 accent-[#e6754e]"
        />
        <p>
          <label htmlFor="accepted_terms" className="cursor-pointer">
            Jag godkänner{" "}
          </label>
          <Link
            href={routes.privacy}
            className="text-accent underline underline-offset-2 hover:text-accent-strong"
          >
            villkoren och integritetspolicyn
          </Link>
          .
        </p>
      </div>

      <SubmitButton />
    </form>
  );
}
