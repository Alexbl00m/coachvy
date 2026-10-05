"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { ConfirmationSent } from "@/components/auth/confirmation-sent";
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

type Invite = { name: string; email: string } | null | undefined;

/**
 * Hela registreringen: rubrik, formulär och länken till inloggningen. När
 * kontot är skapat byts allt mot "Kolla din inkorg". "Börja om" monterar
 * formuläret på nytt, med tomt tillstånd.
 *
 * `invite` fyller i formuläret från coachens inbjudningslänk: adept som
 * kontotyp, och namnet och adressen coachen lagt in – det är adressen som
 * kopplar kontot till rätt adept.
 */
export function SignUp({ invite }: { invite?: Invite }) {
  const [round, setRound] = useState(0);
  return (
    <SignUpForm
      key={round}
      invite={invite}
      onRestart={() => setRound((n) => n + 1)}
    />
  );
}

function SignUpForm({
  invite,
  onRestart,
}: {
  invite?: Invite;
  onRestart: () => void;
}) {
  const [state, formAction] = useActionState(signUp, initialState);
  const [role, setRole] = useState<AccountRole>(invite ? "adept" : "coach");

  if (state.sentTo) {
    return (
      <ConfirmationSent
        email={state.sentTo}
        role={role}
        existing={state.existing}
        onRestart={onRestart}
      />
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-50">
        Skapa konto
      </h1>
      <p className="mt-1.5 mb-7 text-sm text-ink-300">
        {invite
          ? "Din coach har bjudit in dig. Använd adressen som står ifylld – det är den som kopplar kontot till dig."
          : "Välj om du ska coacha eller bli coachad – resten kan du ändra senare."}
      </p>

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
                      ? "border-text-subtle bg-surface-3"
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
            defaultValue={state.values?.full_name ?? invite?.name ?? ""}
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
            defaultValue={state.values?.email ?? invite?.email ?? ""}
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

        {role === "adept" && (
          <div className="flex items-start gap-2.5 pt-1 text-[13px] text-ink-300">
            <input
              id="health_consent"
              name="health_consent"
              type="checkbox"
              required
              defaultChecked={state.values?.health_consent ?? false}
              className="mt-0.5 size-4 shrink-0 accent-[#e6754e]"
            />
            <label htmlFor="health_consent" className="cursor-pointer">
              Jag samtycker till att mina hälsouppgifter – som laktat, puls,
              syreupptag, kroppssammansättning, sömn och skador – behandlas för
              att följa och planera min träning. Samtycket kan tas tillbaka
              under Inställningar.
            </label>
          </div>
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

      <p className="mt-6 text-center text-sm text-ink-400">
        Har du redan ett konto?{" "}
        <Link
          href={routes.signIn}
          className="font-medium text-accent hover:text-accent-strong"
        >
          Logga in
        </Link>
      </p>
    </div>
  );
}
