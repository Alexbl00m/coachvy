import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card, CardHeadline, CardLabel } from "@/components/ui/card";
import type { PlanSuggestion } from "@/lib/plan-library/suggestions";
import { routes } from "@/lib/routes";

/**
 * Planförslagen ur testet och huvudloppet: det första som förslag, de andra
 * som alternativ, med varför och planerna att välja bland.
 */
export function PlanSuggestions({
  suggestions,
  forCoach,
}: {
  suggestions: PlanSuggestion[];
  /** Coachen ser förslaget för en adept; adepten ser det för sig själv. */
  forCoach: boolean;
}) {
  if (suggestions.length === 0) return null;
  const [first, ...rest] = suggestions;

  return (
    <Card level="lead" className="mb-6">
      <CardLabel aside="ur testet och huvudloppet">
        {forCoach ? "Förslag för adepten" : "Föreslagen för dig"}
      </CardLabel>
      <CardHeadline>{first.label}</CardHeadline>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-muted">
        {first.reason}
      </p>
      <PlanLinks suggestion={first} />

      {rest.length > 0 && (
        <ul className="mt-6 grid gap-4 border-t border-line pt-5 md:grid-cols-2">
          {rest.map((s) => (
            <li key={s.focus}>
              <p className="text-sm font-semibold text-text">{s.label}</p>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-text-muted">
                {s.reason}
              </p>
              <PlanLinks suggestion={s} />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-5 text-[0.75rem] text-text-subtle">
        {forCoach
          ? "En hypotes ur testet och loppet. Du väljer planen."
          : "En hypotes ur ditt senaste test och ditt huvudlopp. Fråga din coach om du är osäker."}
      </p>
    </Card>
  );
}

function PlanLinks({ suggestion }: { suggestion: PlanSuggestion }) {
  if (suggestion.plans.length === 0) {
    return (
      <p className="mt-2 text-[0.8125rem] text-text-subtle">
        Ingen plan med det fokuset i biblioteket än.
      </p>
    );
  }
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {suggestion.plans.map(({ template, version }) => (
        <li key={template.id}>
          <Link
            href={`${routes.planLibrary}/${template.slug}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-[0.8125rem] text-text transition-colors hover:border-text-subtle"
          >
            {version.title}
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
