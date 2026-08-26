import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/page-header";

/**
 * Shared empty state for the phase 1 skeleton. Each module replaces this with
 * its real content as it is built.
 */
export function ModulePlaceholder({
  title,
  description,
  icon: Icon,
  planned,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  planned: string[];
}) {
  return (
    <>
      <PageHeader title={title} description={description} />

      <div className="rounded-lg border border-dashed border-ink-700 bg-ink-850/50 px-6 py-12">
        <div className="mx-auto max-w-md text-center">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-lg bg-ink-800">
            <Icon aria-hidden className="size-5 text-accent" />
          </span>
          <p className="text-sm font-medium text-ink-100">
            Modulen är inte byggd ännu
          </p>
          <p className="mt-1 text-sm text-ink-400">
            Skelettet och navigationen finns på plats. Innehållet kommer i en
            kommande fas.
          </p>

          {planned.length > 0 && (
            <ul className="mt-6 space-y-2 text-left">
              {planned.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[13px] text-ink-300"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent"
                  />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
