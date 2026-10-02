import Image from "next/image";

import { Section } from "@/components/public/section";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";

const credentials = [
  "Uthållighetsträningsspecialist",
  "Legitimerad personlig tränare, inriktning kondition",
  "Lång erfarenhet av medel- och långdistanstriathlon",
  "Hemma i cykling och triathlon",
];

export function About() {
  const image = site.aboutImage;

  return (
    <Section id="om-mig">
      <div
        className={cn(
          "grid gap-12 lg:gap-16",
          image && "md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]",
        )}
      >
        {image && (
          <div className="md:sticky md:top-24 md:self-start">
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes="(min-width: 768px) 30rem, 100vw"
              className="aspect-[4/5] w-full rounded-xl border border-line bg-surface object-cover object-top"
            />
          </div>
        )}

        <div>
          <p className="mb-5 font-mono text-[12px] text-text-subtle">Om mig</p>
          <h2 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.028em] text-balance text-text sm:text-[44px]">
            Alexander Lindblom.{" "}
            <span className="text-text-muted">
              Coach för uthållighet i {site.location}.
            </span>
          </h2>

          <div className="mt-8 max-w-[62ch] space-y-5 text-[16px] leading-relaxed text-text-muted">
            <p>
              Redan i ung ålder insåg jag att jag brann för att stödja och guida
              andra på deras väg mot målet. Jag började som hockeytränare, och
              där fick jag utveckla inte bara unga spelares färdigheter utan
              även deras mentala och känslomässiga välbefinnande.
            </p>
            <p>
              Kärleken till cykelsporten fick mig att fördjupa mig i träning
              varje dag. Det var början på min resa som coach. År 2022 utbildade
              jag mig till personlig tränare med inriktning på
              konditionsträning, och sedan dess har det handlat om uthållighet:
              cykling, löpning och triathlon.
            </p>
          </div>

          <ul className="mt-10 max-w-xl border-t border-line">
            {credentials.map((item) => (
              <li
                key={item}
                className="border-b border-line py-3.5 text-[15px] text-text"
              >
                {item}
              </li>
            ))}
          </ul>

          <figure className="mt-12 max-w-xl">
            <blockquote className="text-[22px] leading-[1.35] font-medium tracking-[-0.016em] text-balance text-text">
              ”Coaching är inte bara träningsplanering – det handlar om att
              skapa en relation. Träningen är en del av det större pusslet i
              ditt liv, och allt ska samspela.”
            </blockquote>
            <figcaption className="mt-4 text-[14px] text-text-subtle">
              Min filosofi
            </figcaption>
          </figure>
        </div>
      </div>
    </Section>
  );
}
