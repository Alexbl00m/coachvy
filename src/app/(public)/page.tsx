import type { Metadata } from "next";

import { About } from "@/components/public/about";
import { Approach } from "@/components/public/approach";
import { Coaching } from "@/components/public/coaching";
import { Contact } from "@/components/public/contact";
import { Hero } from "@/components/public/hero";
import { Testing } from "@/components/public/testing";
import { ToolsTeaser } from "@/components/public/tools-teaser";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  // absolute: the root layout's "%s · Lindblom Coaching" template would
  // otherwise append the business name to a title that already carries it.
  title: { absolute: `${site.name} – ${site.tagline}` },
  description:
    "Individuell coaching och skräddarsydda träningsplaner för uthållighetsidrott. Laktattest, VLamax och tröskeltestning i Norrköping.",
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <Approach />
      <Coaching />
      <Testing />
      <About />
      <ToolsTeaser />
      <Contact />
    </>
  );
}
