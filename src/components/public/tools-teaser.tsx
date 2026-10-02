import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Section, SectionHeading } from "@/components/public/section";
import { tools } from "@/components/public/tools";

export function ToolsTeaser() {
  return (
    <Section id="verktyg">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          label="Verktyg"
          title="Räkna själv."
          continuation="Samma modeller som i coachingen, fria att använda."
        />
        <Link
          href="/verktyg"
          className="text-[14px] text-accent-text transition-colors hover:text-accent-hover"
        >
          Alla verktyg
        </Link>
      </div>

      <ul className="mt-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <li key={tool.href} className="bg-canvas">
              <Link
                href={tool.href}
                className="group flex h-full flex-col p-6 transition-colors duration-120 hover:bg-surface"
              >
                <span className="flex items-center justify-between">
                  <Icon aria-hidden className="size-5 text-text-muted" />
                  <ArrowUpRight
                    aria-hidden
                    className="size-4 text-text-subtle transition-colors group-hover:text-text"
                  />
                </span>
                <span className="mt-6 text-[15px] font-semibold text-text">
                  {tool.title}
                </span>
                <span className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-text-muted">
                  {tool.description}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
