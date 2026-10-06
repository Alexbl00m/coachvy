import { Card, CardTitle } from "@/components/ui/card";
import type { DevelopmentReading } from "@/lib/activities/development";

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));

/** Utvecklingen ur träningen, som text, i rubricerade stycken. */
export function DevelopmentCard({
  reading,
}: {
  reading: DevelopmentReading | null;
}) {
  if (!reading) return null;
  return (
    <Card>
      <CardTitle>Utveckling ur träningen</CardTitle>
      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
        {reading.sections.map((section) => (
          <section key={section.title}>
            <h3 className="text-[13px] font-medium text-text">
              {section.title}
            </h3>
            <ul className="mt-2 max-w-[62ch] space-y-1.5 text-sm leading-relaxed text-text-muted">
              {section.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-5 border-t border-line pt-3 text-[12px] text-text-subtle">
        Ur {reading.activities} pass, räknat bakåt från{" "}
        {longDate(reading.anchor)}
        {reading.anchoredOnLast
          ? " – det senaste passet, eftersom inget nyare finns"
          : ""}
        . Regelbaserat: varje mening vilar på tal ur passen, och samma data ger
        samma text.
      </p>
    </Card>
  );
}
