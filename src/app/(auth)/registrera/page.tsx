import Link from "next/link";

import { SignUpForm } from "@/components/auth/sign-up-form";
import { routes } from "@/lib/routes";

export const metadata = { title: "Skapa konto" };

export default function RegistreraPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-50">
        Skapa konto
      </h1>
      <p className="mt-1.5 mb-7 text-sm text-ink-300">
        Välj om du ska coacha eller bli coachad – resten kan du ändra senare.
      </p>

      <SignUpForm />

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
