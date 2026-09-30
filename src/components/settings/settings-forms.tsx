"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  changePassword,
  setHealthConsent,
  updateName,
} from "@/lib/settings/actions";

function Status({
  error,
  done,
}: {
  error: string | null;
  done: string | null;
}) {
  if (error)
    return (
      <p role="alert" className="text-sm text-bad">
        {error}
      </p>
    );
  if (done)
    return (
      <p role="status" className="text-sm text-good">
        {done}
      </p>
    );
  return null;
}

export function NameForm({ name }: { name: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          setDone(null);
          const result = await updateName(value);
          if (!result.ok) return setError(result.error);
          setDone("Sparat.");
          router.refresh();
        });
      }}
    >
      <Field label="Namn" htmlFor="settings-name">
        <Input
          id="settings-name"
          value={value}
          maxLength={120}
          autoComplete="name"
          onChange={(e) => setValue(e.target.value)}
        />
      </Field>
      <Status error={error} done={done} />
      <Button
        type="submit"
        size="sm"
        disabled={pending || value.trim() === name}
      >
        {pending ? "Sparar…" : "Spara namn"}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (password !== repeat) {
          setDone(null);
          return setError("Lösenorden är inte likadana.");
        }
        start(async () => {
          setError(null);
          setDone(null);
          const result = await changePassword(password);
          if (!result.ok) return setError(result.error);
          setPassword("");
          setRepeat("");
          setDone("Lösenordet är bytt.");
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Nytt lösenord"
          htmlFor="settings-password"
          hint="Minst 8 tecken."
        >
          <Input
            id="settings-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Samma igen" htmlFor="settings-repeat">
          <Input
            id="settings-repeat"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </Field>
      </div>
      <Status error={error} done={done} />
      <Button type="submit" size="sm" disabled={pending || password.length < 8}>
        {pending ? "Byter…" : "Byt lösenord"}
      </Button>
    </form>
  );
}

/**
 * Samtycket till hälsouppgifter. Lika lätt att ta tillbaka som att ge –
 * det är ett krav för att samtycket ska gälla över huvud taget.
 */
export function ConsentToggle({ given }: { given: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (give: boolean) =>
    start(async () => {
      setError(null);
      const result = await setHealthConsent(give);
      if (!result.ok) return setError(result.error);
      router.refresh();
    });

  return (
    <div className="space-y-3">
      {given ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (
              window.confirm(
                "Ta tillbaka samtycket? Din coach ser att det saknas. Det som redan är registrerat raderas först när du ber om det.",
              )
            ) {
              toggle(false);
            }
          }}
        >
          {pending ? "Sparar…" : "Ta tillbaka samtycket"}
        </Button>
      ) : (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => toggle(true)}
          className="font-semibold"
        >
          {pending ? "Sparar…" : "Ge samtycke"}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
