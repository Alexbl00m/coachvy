import Link from "next/link";

import { SiteLogo } from "@/components/public/site-logo";
import { ButtonLink } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export const metadata = { title: "Sidan finns inte" };

export default function NotFound() {
  return (
    <div className="theme-light flex min-h-screen flex-col bg-canvas text-text">
      <header className="border-b border-line px-5 py-5 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <SiteLogo className="inline-block rounded-md" />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-20">
        <div className="text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-accent">
            404
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Sidan finns inte
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-text-muted">
            Länken kan vara gammal, eller så har sidan flyttat. Hör av dig om du
            letar efter något särskilt.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href={routes.home} className="font-semibold">
              Till startsidan
            </ButtonLink>
            <ButtonLink href={routes.contact} variant="secondary">
              Kontakta mig
            </ButtonLink>
          </div>
          <p className="mt-8 text-[13px] text-text-subtle">
            Är du inloggad?{" "}
            <Link href={routes.dashboard} className="text-accent hover:underline">
              Gå till din översikt
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
