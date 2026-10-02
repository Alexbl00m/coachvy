import Link from "next/link";

import { InstagramIcon } from "@/components/public/instagram-icon";
import { SiteLogo } from "@/components/public/site-logo";
import { routes } from "@/lib/routes";
import { site } from "@/lib/site";

const columns = [
  {
    title: "Coaching",
    links: [
      ["Individuell coaching", "/#coaching"],
      ["Träningsplan", "/#coaching"],
      ["Om mig", "/#om-mig"],
    ],
  },
  {
    title: "Testning",
    links: [
      ["Laktattest cykel", "/#testning"],
      ["Laktattest löpning", "/#testning"],
      ["VLamax-test", "/#testning"],
    ],
  },
  {
    title: "Verktyg",
    links: [
      ["Testberäkning", "/verktyg/testberakning"],
      ["Loppprognos", "/verktyg/loppprognos"],
      ["Träningszoner", "/verktyg/traningszoner"],
      ["Effekt och fart", "/verktyg/cykeleffekt"],
    ],
  },
  {
    title: "Coachvy",
    links: [
      ["Logga in", routes.signIn],
      ["Skapa konto", routes.signUp],
      ["Integritetspolicy", routes.privacy],
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-line px-5 sm:px-8">
      <div className="mx-auto max-w-[1120px] py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_repeat(4,minmax(0,1fr))]">
          <div>
            <SiteLogo className="inline-block rounded-md" />
            <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-text-muted">
              {site.tagline}. {site.location}.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 lg:col-span-4">
            {columns.map((column) => (
              <div key={column.title}>
                <h2 className="text-[13px] font-medium text-text">
                  {column.title}
                </h2>
                <ul className="mt-4 space-y-2.5 text-[13px]">
                  {column.links.map(([label, href]) => (
                    <li key={label}>
                      <Link
                        href={href}
                        className="text-text-muted transition-colors hover:text-text"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-line pt-6 text-[13px] text-text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.name} ·{" "}
            <a
              href={`mailto:${site.email}`}
              className="transition-colors hover:text-text"
            >
              {site.email}
            </a>{" "}
            ·{" "}
            <a
              href={`tel:${site.phone}`}
              className="transition-colors hover:text-text"
            >
              {site.phoneLabel}
            </a>
          </p>
          <a
            href={site.instagram}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Instagram"
            className="inline-flex size-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <InstagramIcon className="size-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}
