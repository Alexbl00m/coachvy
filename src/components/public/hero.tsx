import { ArrowRight } from "lucide-react";

import { TestPreview } from "@/components/public/test-preview";
import { ButtonLink } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="px-5 pt-16 pb-20 sm:px-8 sm:pt-24 sm:pb-28">
      <div className="mx-auto max-w-[1120px]">
        <a
          href="#kontakt"
          className="group inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface py-1 pr-2.5 pl-3 text-[13px] text-text-muted transition-colors hover:border-text-subtle hover:text-text"
        >
          Första samtalet är alltid kostnadsfritt
          <ArrowRight
            aria-hidden
            className="size-3.5 transition-transform duration-150 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </a>

        <h1 className="mt-8 text-[44px] leading-[1.02] font-semibold tracking-[-0.04em] text-balance text-text sm:text-[64px] lg:text-[76px]">
          There is only one way.{" "}
          <span className="block text-text-muted">
            The Alexander Lindblom Way.
          </span>
        </h1>

        <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-text-muted">
          Individuell coaching och träningsplaner för triathlon, cykling och
          löpning – oavsett om målet är en snabbare 5 km eller att ta sig igenom
          en långdistanstriathlon. Upplägget utgår från var du står i dag, vad
          du behöver och vart du vill.
        </p>

        <div className="mt-9 flex flex-wrap gap-3">
          <ButtonLink href="#kontakt">Boka ett samtal</ButtonLink>
          <ButtonLink href="#coaching" variant="ghost">
            Se upplägget
            <ArrowRight aria-hidden className="size-4" />
          </ButtonLink>
        </div>

        <TestPreview className="mt-16 sm:mt-20" />
      </div>
    </section>
  );
}
