import Image from "next/image";
import Link from "next/link";

import { site } from "@/lib/site";

/** The business wordmark. The app keeps the Coachvy mark; this is the site. */
export function SiteLogo({ className }: { className?: string }) {
  return (
    <Link href="/" className={className} aria-label={`${site.name} – startsida`}>
      <Image
        src="/brand/lindblom-logotype.png"
        alt={site.name}
        width={1062}
        height={320}
        priority
        className="h-9 w-auto"
      />
    </Link>
  );
}
