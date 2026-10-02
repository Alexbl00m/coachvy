import Link from "next/link";

import { SiteLogo } from "@/components/public/site-logo";
import { MobileNav } from "@/components/public/mobile-nav";
import { ButtonLink } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { sections } from "@/lib/site";

/**
 * Server component on purpose: it reads the session so a signed-in coach sees
 * the way back into the app instead of a login prompt. That shared header is
 * the thing that makes the site and the app read as one product.
 */
export async function SiteHeader() {
  const user = await getSessionUser();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 px-5 backdrop-blur-md sm:px-8">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-6">
        <SiteLogo className="shrink-0 rounded-md" />

        <nav
          aria-label="Sidnavigering"
          className="ml-auto hidden items-center gap-1 md:flex"
        >
          {sections.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-[14px] text-text-muted transition-colors hover:text-text"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {user ? (
            <ButtonLink href={routes.dashboard} size="sm">
              Min översikt
            </ButtonLink>
          ) : (
            <>
              <Link
                href={routes.signIn}
                className="hidden rounded-md px-3 py-1.5 text-[14px] text-text-muted transition-colors hover:text-text sm:block"
              >
                Logga in
              </Link>
              <ButtonLink href={routes.signUp} size="sm">
                Kom igång
              </ButtonLink>
            </>
          )}
          <MobileNav signedIn={Boolean(user)} />
        </div>
      </div>
    </header>
  );
}
