import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { lactateCurves, metricTrends } from "@/lib/tests/progression";
import type { FullSession } from "@/lib/tests/session-queries";
import { LactateCompare } from "./lactate-compare";
import { MetricTrends } from "./metric-trends";
import { RecomputeButton } from "./recompute-button";

/**
 * En adepts progression: laktatkurvorna mot varandra överst, sedan varje
 * storhet som en egen tidslinje.
 */
export function ProgressionView({
  adeptId,
  sessions,
  canEdit,
}: {
  adeptId: string;
  sessions: FullSession[];
  canEdit: boolean;
}) {
  const curves = lactateCurves(sessions);
  const trends = metricTrends(sessions, curves);

  if (sessions.length === 0) {
    return (
      <EmptyState
        title="Inga tester ännu"
        description="Progressionen byggs av testtillfällena. Registrera ett test – också ett gammalt, med datumet det gjordes – så börjar kurvorna fyllas."
      />
    );
  }

  return (
    <div className="space-y-6">
      {curves.length > 0 && (
        <Card className="min-w-0">
          <CardTitle>Laktatkurvor</CardTitle>
          <LactateCompare curves={curves} />
        </Card>
      )}

      {trends.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">
            Utveckling per värde
          </h2>
          <MetricTrends trends={trends} />
        </section>
      )}

      {canEdit && (
        <Card>
          <CardTitle>Samma metoder för alla tester</CardTitle>
          <p className="mb-4 max-w-2xl text-sm leading-relaxed text-text-muted">
            Kurvorna ovan räknas alltid om ur rådatan. De sparade värdena i
            testlistan är vad som räknades när testet sparades. Räkna om dem när
            metoderna har ändrats – då använder också äldre tester ModDmax för
            LT2 och får 2 och 4 mmol. Rådatan rörs inte.
          </p>
          <RecomputeButton adeptId={adeptId} />
        </Card>
      )}
    </div>
  );
}
