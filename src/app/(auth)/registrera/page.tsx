import Link from "next/link";

import { SignUpForm } from "@/components/auth/sign-up-form";
import { routes } from "@/lib/routes";

export const metadata = { title: "Skapa konto" };

export default async function RegistreraPage({
  searchParams,
}: PageProps<"/registrera">) {
  // Coachens inbjudningslänk: /registrera?inbjudan=adept&namn=…&epost=…
  const query = await searchParams;
  const text = (value: unknown, max: number) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";
  const invite =
    query.inbjudan === "adept"
      ? { name: text(query.namn, 120), email: text(query.epost, 200) }
      : null;

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

      <SignUpForm invite={invite} />

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
