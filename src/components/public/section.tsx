import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Shared rhythm for the marketing sections. */
export function Section({
  id,
  tone = "canvas",
  children,
  className,
}: {
  id?: string;
  tone?: "canvas" | "sand";
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-20 px-5 py-20 sm:px-8 sm:py-24",
        tone === "sand" ? "bg-surface-2" : "bg-canvas",
        className,
      )}
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  accent,
  description,
}: {
  eyebrow?: string;
  title: string;
  /** Rendered in the accent colour after the title. */
  accent?: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && (
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">
        {title}
        {accent && <span className="text-accent"> {accent}</span>}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-relaxed text-text-muted">
          {description}
        </p>
      )}
    </div>
  );
}
