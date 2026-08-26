import Link from "next/link";

import { SignInForm } from "@/components/auth/sign-in-form";
import { routes } from "@/lib/routes";

export const metadata = { title: "Logga in" };

export default async function LoggaInPage({
  searchParams,
}: PageProps<"/logga-in">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink-50">
        Logga in
      </h1>
      <p className="mt-1.5 mb-7 text-sm text-ink-300">
        Välkommen tillbaka till Coachvy.
      </p>

      <SignInForm next={next} />

      <p className="mt-6 text-center text-sm text-ink-400">
        Har du inget konto?{" "}
        <Link
          href={routes.signUp}
          className="font-medium text-accent hover:text-accent-strong"
        >
          Skapa konto
        </Link>
      </p>
    </div>
  );
}
