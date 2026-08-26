import Image from "next/image";
import { ArrowRight } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { site } from "@/lib/site";

export function Hero() {
  return (
    <section className="px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div>
          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-text sm:text-5xl lg:text-6xl">
            There is only
            <br />
            <span className="text-accent">one way.</span>
          </h1>
          <p className="mt-4 text-xl font-light text-text-muted">
            The Alexander Lindblom Way.
          </p>

          <p className="mt-7 max-w-lg text-base leading-relaxed text-text-muted">
            Oavsett om du vill förbättra din 5 km-tid eller ta dig igenom en
            långdistanstriathlon har jag lösningen. Jag erbjuder individuell
            coaching och skräddarsydda träningsplaner som anpassas efter din
            nuvarande status, dina behov och dina mål.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="#coaching" className="font-semibold">
              Upptäck coaching
              <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
            <ButtonLink href="#testning" variant="secondary">
              Se testerna
            </ButtonLink>
          </div>

          <dl className="mt-12 grid max-w-sm grid-cols-2 gap-8">
            <div>
              <dt className="order-2 text-sm text-text-muted">Aktiva adepter</dt>
              <dd className="text-3xl font-bold text-text">
                {site.activeAdepts}
              </dd>
            </div>
            <div>
              <dt className="order-2 text-sm text-text-muted">Lediga platser</dt>
              <dd className="text-3xl font-bold text-text">{site.openSpots}</dd>
            </div>
          </dl>
        </div>

        {/* max-w on the grid item itself: justify-self-end would make the
            column content-sized and collapse a w-full child to zero. */}
        <div className="w-full max-w-md lg:ml-auto">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-surface-2">
            <Image
              src="/brand/alexander-portrait.jpg"
              alt="Alexander Lindblom"
              fill
              priority
              sizes="(min-width: 1024px) 28rem, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
