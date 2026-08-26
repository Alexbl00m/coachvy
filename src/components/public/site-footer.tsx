import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

import { InstagramIcon } from "@/components/public/instagram-icon";
import { SiteLogo } from "@/components/public/site-logo";
import { routes } from "@/lib/routes";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface-2">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <SiteLogo className="inline-block rounded-md" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-text-muted">
              Individuell coaching och skräddarsydda träningsplaner för
              uthållighetsidrott, med testning som underlag.
            </p>
            <a
              href={site.instagram}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Instagram"
              className="mt-5 inline-flex size-9 items-center justify-center rounded-md border border-line-strong text-text-muted transition-colors hover:border-accent hover:text-accent"
            >
              <InstagramIcon className="size-4" />
            </a>
          </div>

          <div>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-text">
              Tjänster
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm text-text-muted">
              <li>
                <a href="#coaching" className="hover:text-accent">
                  Individuell coaching
                </a>
              </li>
              <li>
                <a href="#coaching" className="hover:text-accent">
                  Träningsplan
                </a>
              </li>
              <li>
                <a href="#testning" className="hover:text-accent">
                  Laktattest cykel
                </a>
              </li>
              <li>
                <a href="#testning" className="hover:text-accent">
                  Laktattest löpning
                </a>
              </li>
              <li>
                <a href="#testning" className="hover:text-accent">
                  VLamax-test
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-text">
              Kontakt
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-text-muted">
              <li>
                <a
                  href={`mailto:${site.email}`}
                  className="flex items-center gap-2.5 hover:text-accent"
                >
                  <Mail aria-hidden className="size-4 shrink-0 text-accent" />
                  {site.email}
                </a>
              </li>
              <li>
                <a
                  href={`tel:${site.phone}`}
                  className="flex items-center gap-2.5 hover:text-accent"
                >
                  <Phone aria-hidden className="size-4 shrink-0 text-accent" />
                  {site.phoneLabel}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <MapPin aria-hidden className="size-4 shrink-0 text-accent" />
                {site.location}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-[13px] text-text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.name}
          </p>
          <div className="flex gap-5">
            <Link href={routes.privacy} className="hover:text-accent">
              Integritetspolicy & villkor
            </Link>
            <Link href={routes.signIn} className="hover:text-accent">
              Logga in
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
