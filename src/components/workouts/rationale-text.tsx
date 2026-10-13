import { cn } from "@/lib/cn";

type Section = { heading: string | null; body: string };

/**
 * Stycken med en kort rubrik på första raden – som förklaringen till ett
 * pass ur passbiblioteket ("Syfte", "Energi" …). Annan text blir ett
 * stycke utan rubrik.
 */
function sectionsOf(text: string): Section[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [first, ...rest] = part.split("\n");
      const heading =
        rest.length > 0 && first.length <= 32 && !/[.!?:,]$/.test(first.trim())
          ? first.trim()
          : null;
      return heading
        ? { heading, body: rest.join("\n").trim() }
        : { heading: null, body: part };
    });
}

/**
 * Ett pass förklaring. `compact` visar första stycket och resten bakom
 * "Läs mer", för listor som planens veckor.
 */
export function RationaleText({
  text,
  compact = false,
  className,
}: {
  text: string;
  compact?: boolean;
  className?: string;
}) {
  const sections = sectionsOf(text);
  if (sections.length === 0) return null;

  const render = (list: Section[]) =>
    list.map((s, i) => (
      <div key={i}>
        {s.heading && (
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-subtle">
            {s.heading}
          </p>
        )}
        <p className="whitespace-pre-line">{s.body}</p>
      </div>
    ));

  if (compact && sections.some((s) => s.heading) && sections.length > 1) {
    const [first, ...rest] = sections;
    return (
      <div className={cn("space-y-1", className)}>
        <p className="whitespace-pre-line">{first.body}</p>
        <details>
          <summary className="cursor-pointer select-none text-[11px] text-text-subtle hover:text-text">
            Läs mer om passet
          </summary>
          <div className="mt-1.5 space-y-2">{render(rest)}</div>
        </details>
      </div>
    );
  }

  return <div className={cn("space-y-3", className)}>{render(sections)}</div>;
}
