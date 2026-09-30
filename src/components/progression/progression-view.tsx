import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import type { Sport } from "@/lib/calculators/lactate";
import { cn } from "@/lib/cn";
import { digitsForMetric, formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { displayValue } from "@/lib/tests/pace";
import {
  lactateCurves,
  latestUtilisation,
  metricTrends,
  protocolLabel,
  type Trend,
} from "@/lib/tests/progression";
import type { FullSession } from "@/lib/tests/session-queries";
import { metabolicHistory } from "@/lib/tests/metabolic-curve";
import { speedProfile } from "@/lib/tests/speed-profile";
import { summariseProgress } from "@/lib/tests/trend-analysis";
import { LactateCompare } from "./lactate-compare";
import { MetabolicProgression } from "./metabolic-progression";
import { MetricTrends } from "./metric-trends";
import { RecomputeButton } from "./recompute-button";
import { RunningProfile } from "./running-profile";
import { UtilisationCard } from "./utilisation-card";

/** Grenarna i adressen, utan å och ö. */
export const SPORT_SLUGS: Record<Sport, string> = {
  cykling: "cykling",
  löpning: "lopning",
  simning: "simning",
};
const SPORT_LABELS: Record<Sport, string> = {
  cykling: "Cykel",
  löpning: "Löpning",
  simning: "Simning",
};
export const sportFromSlug = (slug: string | undefined): Sport | null =>
  (Object.keys(SPORT_SLUGS) as Sport[]).find((s) => SPORT_SLUGS[s] === slug) ??
  null;

export type ProgressionViewKey =
  | "oversikt"
  | "laktat"
  | "fart"
  | "metabol"
  | "syre"
  | "varden";

/**
 * Tidslinjerna i grupper. Trösklarna först – de är vad de flesta tester finns
 * till för – och sist det som bara vissa tester ger.
 */
const GROUPS: { title: string; keys: string[] }[] = [
  {
    title: "Trösklar",
    keys: ["LT2", "LT1", "I_4mmol", "CP", "FTP", "CS"],
  },
  {
    title: "Kapacitet och toppfart",
    keys: ["W_prime", "D_prime", "Pmax", "VLamax", "FatMax"],
  },
  {
    title: "Syreupptag och utnyttjandegrad",
    keys: [
      "VO2max",
      "VO2max_est",
      "U_LT2",
      "U_LT1",
      "U_CP",
      "LT2_per_kg",
      "CP_per_kg",
    ],
  },
  { title: "Löptester", keys: ["VDOT", "PACE_cv"] },
];

/** Nyckeltalen överst, per gren, i den ordning de är värda att se. */
const HEADLINE: Record<Sport, string[]> = {
  cykling: ["LT2", "CP", "FTP", "VO2max", "VO2max_est", "LT1", "W_prime"],
  löpning: ["CS", "LT2", "VDOT", "D_prime", "LT1", "VO2max", "VO2max_est"],
  simning: ["CS", "D_prime", "LT2", "LT1"],
};

/** CS heter CSS i simningen – det är namnet simtränare känner igen. */
const headlineLabel = (trend: Trend, sport: Sport) =>
  sport === "simning" && trend.key === "CS"
    ? "CSS – critical swim speed"
    : trend.label;

function Headline({ trend, sport }: { trend: Trend; sport: Sport }) {
  const digits = digitsForMetric(trend.key, trend.unit);
  const last = trend.points[trend.points.length - 1];
  // Jämför med ett tidigare test, inte med ett annat protokoll samma dag.
  const previous =
    [...trend.points].reverse().find((p) => p.performedOn < last.performedOn) ??
    null;
  const shown = displayValue(last.value, trend.unit, sport, digits);
  const change =
    previous && previous.value !== 0
      ? ((last.value - previous.value) / previous.value) * 100
      : null;
  const flat = change === null || Math.abs(change) < 0.05;
  const tone =
    flat || trend.higherIsBetter === null
      ? "neutral"
      : (change as number) > 0 === trend.higherIsBetter
        ? "good"
        : "bad";
  const Icon = flat
    ? Minus
    : (change as number) > 0
      ? ArrowUpRight
      : ArrowDownRight;

  return (
    <div className="flex flex-col rounded-lg border border-line bg-surface p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-text-muted">
        {headlineLabel(trend, sport)}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-text tabular-nums">
        {shown.value}
        <span className="ml-1.5 text-sm font-normal text-text-muted">
          {shown.unit}
        </span>
      </p>
      <p className="mt-0.5 text-[12px] text-text-subtle tabular-nums">
        {[shown.speed, formatDate(last.performedOn)]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {change !== null && (
        <p
          className={cn(
            "mt-3 inline-flex items-center gap-1 text-[12px] font-medium tabular-nums",
            tone === "good"
              ? "text-good"
              : tone === "bad"
                ? "text-bad"
                : "text-text-muted",
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          {(change as number) > 0 ? "+" : ""}
          {(change as number).toFixed(1).replace(".", ",")} % sedan{" "}
          {formatDate(previous?.performedOn ?? null)}
        </p>
      )}
    </div>
  );
}

function TrendGroups({
  trends,
  sport,
  only,
}: {
  trends: Trend[];
  sport: Sport;
  /** Bara de här grupperna, i den här ordningen. */
  only?: string[];
}) {
  const groups = GROUPS.filter((g) => !only || only.includes(g.title))
    .map((g) => ({
      ...g,
      trends: trends.filter((t) => g.keys.includes(t.key)),
    }))
    .filter((g) => g.trends.length > 0);
  const grouped = new Set(GROUPS.flatMap((g) => g.keys));
  const rest = only ? [] : trends.filter((t) => !grouped.has(t.key));

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.title} className="space-y-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            {g.title}
          </h2>
          <MetricTrends trends={g.trends} sport={sport} />
        </section>
      ))}
      {rest.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            Övrigt
          </h2>
          <MetricTrends trends={rest} sport={sport} />
        </section>
      )}
    </div>
  );
}

/** En rad länkflikar. Valet ligger i adressen, så varje vy går att länka. */
function Tabs({
  label,
  items,
  size = "md",
}: {
  label: string;
  items: {
    key: string;
    label: string;
    href: string;
    active: boolean;
    count?: number;
  }[];
  size?: "md" | "sm";
}) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto px-1">
      <ul
        className={cn(
          "inline-flex gap-1 rounded-lg border border-line bg-surface p-1",
          size === "sm" && "border-transparent bg-transparent p-0",
        )}
      >
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              scroll={false}
              className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap rounded-md transition-colors",
                size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-[13px]",
                item.active
                  ? "bg-surface-2 font-medium text-text shadow-sm"
                  : "text-text-muted hover:bg-surface-2/60 hover:text-text",
              )}
            >
              {item.label}
              {item.count !== undefined && (
                <span className="rounded bg-canvas/60 px-1.5 text-[11px] text-text-subtle tabular-nums">
                  {item.count}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * En adepts progression, en gren i taget. Överst grenarna, sedan vad som
 * finns att se i den valda: en översikt med nyckeltalen och trösklarna, och
 * bakom var sin flik laktatkurvorna, fartprofilen, syreupptaget och alla
 * värden.
 */
export function ProgressionView({
  adeptId,
  sessions,
  canEdit,
  sport: requestedSport,
  view: requestedView,
  query = {},
}: {
  adeptId: string;
  sessions: FullSession[];
  canEdit: boolean;
  sport: Sport | null;
  view: string | undefined;
  /** Övriga parametrar i adressen, t.ex. vilken adept. */
  query?: Record<string, string>;
}) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        title="Inga tester ännu"
        description="Progressionen byggs av testtillfällena. Registrera ett test – också ett gammalt, med datumet det gjordes – så börjar kurvorna fyllas."
      />
    );
  }

  const counts = new Map<Sport, number>();
  for (const s of sessions) counts.set(s.sport, (counts.get(s.sport) ?? 0) + 1);
  const available = (["cykling", "löpning", "simning"] as Sport[]).filter((s) =>
    counts.has(s),
  );
  // Utan val: grenen i det senaste testet.
  const latest = [...sessions].sort((a, b) =>
    b.performed_on.localeCompare(a.performed_on),
  )[0];
  const sport =
    requestedSport && counts.has(requestedSport)
      ? requestedSport
      : latest.sport;

  const inSport = sessions.filter((s) => s.sport === sport);
  const curves = lactateCurves(inSport);
  const trends = metricTrends(inSport, curves);
  const utilisationNow = latestUtilisation(inSport, curves);
  const running = sport === "löpning" ? speedProfile(inSport) : null;
  const metabolic =
    sport === "cykling"
      ? metabolicHistory(inSport).map((e) => ({
          sessionId: e.sessionId,
          performedOn: e.performedOn,
          protocolLabel: protocolLabel(e.protocol),
          vo2max: e.curve.vo2max,
          vlamax: e.curve.vlamax,
          points: e.curve.points,
          thresholds: e.curve.thresholds,
          band: e.curve.band,
          weightKg: e.curve.weightKg,
        }))
      : [];

  const views: { key: ProgressionViewKey; label: string }[] = [
    { key: "oversikt", label: "Översikt" },
    ...(curves.length > 0
      ? [{ key: "laktat" as const, label: "Laktatkurvor" }]
      : []),
    ...(running
      ? [{ key: "fart" as const, label: "Fartprofil och lopp" }]
      : []),
    ...(metabolic.length > 0
      ? [{ key: "metabol" as const, label: "Metabol profil" }]
      : []),
    ...(utilisationNow || trends.some((t) => GROUPS[2].keys.includes(t.key))
      ? [{ key: "syre" as const, label: "Syreupptag" }]
      : []),
    { key: "varden", label: "Alla värden" },
  ];
  const view =
    views.find((v) => v.key === requestedView)?.key ?? ("oversikt" as const);

  const href = (params: Record<string, string>) => {
    const search = new URLSearchParams({ ...query, ...params });
    return `${routes.progression}?${search.toString()}`;
  };

  const analysis = summariseProgress(trends);
  const headline = HEADLINE[sport]
    .map(
      (key) =>
        // VDOT kan finnas per test; ta den serie som testats senast.
        trends
          .filter((t) => t.key === key)
          .sort((a, b) =>
            b.points[b.points.length - 1].performedOn.localeCompare(
              a.points[a.points.length - 1].performedOn,
            ),
          )[0],
    )
    .filter((t): t is Trend => Boolean(t))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          label="Gren"
          items={available.map((s) => ({
            key: s,
            label: SPORT_LABELS[s],
            count: counts.get(s),
            href: href({ gren: SPORT_SLUGS[s] }),
            active: s === sport,
          }))}
        />
        <p className="text-[13px] text-text-subtle">
          {inSport.length} {inSport.length === 1 ? "test" : "tester"} sedan{" "}
          {formatDate(
            [...inSport].sort((a, b) =>
              a.performed_on.localeCompare(b.performed_on),
            )[0].performed_on,
          )}
        </p>
      </div>

      <div className="border-b border-line pb-2">
        <Tabs
          label="Vy"
          size="sm"
          items={views.map((v) => ({
            key: v.key,
            label: v.label,
            href: href({ gren: SPORT_SLUGS[sport], vy: v.key }),
            active: v.key === view,
          }))}
        />
      </div>

      {view === "oversikt" && (
        <div className="space-y-8">
          {headline.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {headline.map((t) => (
                <Headline key={t.id} trend={t} sport={sport} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Inga nyckeltal ännu"
              description="Testerna i den här grenen har inga värden att följa. Räkna om dem under Alla värden om de registrerades innan metoderna fanns."
            />
          )}
          {analysis.length > 0 && (
            <Card>
              <CardTitle>Kort analys</CardTitle>
              <ul className="max-w-3xl space-y-2 text-sm leading-relaxed text-text-muted">
                {analysis.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="mt-3 text-[12px] text-text-subtle">
                Räknat ur tidslinjerna, första mot senaste test. Streckade
                linjer i graferna är trenden över alla tester.
              </p>
            </Card>
          )}
          <TrendGroups trends={trends} sport={sport} only={["Trösklar"]} />
          {views.length > 2 && (
            <p className="text-[13px] text-text-muted">
              Mer i flikarna ovan:{" "}
              {views
                .filter((v) => v.key !== "oversikt")
                .map((v) => v.label.toLowerCase())
                .join(", ")}
              .
            </p>
          )}
        </div>
      )}

      {view === "laktat" && (
        <Card className="min-w-0">
          <CardTitle>Laktatkurvor</CardTitle>
          <LactateCompare curves={curves} />
        </Card>
      )}

      {view === "fart" && running && <RunningProfile profile={running} />}

      {view === "metabol" && metabolic.length > 0 && (
        <MetabolicProgression entries={metabolic} />
      )}

      {view === "syre" && (
        <div className="space-y-8">
          {utilisationNow && <UtilisationCard summary={utilisationNow} />}
          <TrendGroups
            trends={trends}
            sport={sport}
            only={["Syreupptag och utnyttjandegrad"]}
          />
        </div>
      )}

      {view === "varden" && (
        <div className="space-y-8">
          <TrendGroups trends={trends} sport={sport} />
          {canEdit && (
            <Card>
              <CardTitle>Samma metoder för alla tester</CardTitle>
              <p className="mb-4 max-w-2xl text-sm leading-relaxed text-text-muted">
                Kurvorna räknas alltid om ur rådatan. De sparade värdena i
                testlistan är vad som räknades när testet sparades. Räkna om dem
                när metoderna har ändrats – då använder också äldre tester
                ModDmax för LT2 och får 2 och 4 mmol. Rådatan rörs inte.
              </p>
              <RecomputeButton adeptId={adeptId} />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
