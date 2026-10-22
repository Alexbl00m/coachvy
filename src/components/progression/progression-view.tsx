import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardHeadline,
  CardLabel,
  CardTitle,
  EmptyState,
} from "@/components/ui/card";
import { Unit } from "@/components/ui/metric";
import type { Sport } from "@/lib/calculators/lactate";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import { longDate } from "@/lib/season/season";
import {
  lactateCurves,
  latestUtilisation,
  utilisationDiagnosis,
  metricTrends,
  protocolLabel,
  type Trend,
} from "@/lib/tests/progression";
import type { FullSession } from "@/lib/tests/session-queries";
import { metabolicHistory } from "@/lib/tests/metabolic-curve";
import { speedProfile } from "@/lib/tests/speed-profile";
import {
  analysisHeadline,
  latestOf,
  thresholdInsight,
} from "@/lib/tests/threshold-summary";
import { summariseProgress } from "@/lib/tests/trend-analysis";
import { BeforeAfter } from "./before-after";
import { LactateCompare } from "./lactate-compare";
import { MetabolicProgression } from "./metabolic-progression";
import { MetricTrends } from "./metric-trends";
import { RecomputeButton } from "./recompute-button";
import { RunningProfile } from "./running-profile";
import { SessionList } from "./session-list";
import { ThresholdChart, ThresholdLegend } from "./threshold-chart";
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
  | "mal"
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

/** Ett nyckeltal i raden överst: värdet stort, datum och förändring under. */
function Headline({ trend, sport }: { trend: Trend; sport: Sport }) {
  const latest = latestOf(trend, sport);
  const change = latest.change;
  const flat = !change || Math.abs(change.percent) < 0.05;
  const Icon = flat
    ? Minus
    : change.percent > 0
      ? ArrowUpRight
      : ArrowDownRight;

  return (
    <div className="flex min-w-0 flex-col bg-surface p-4 sm:p-6">
      <p className="eyebrow truncate text-text-subtle">
        {headlineLabel(trend, sport).replace(" – ", " · ")}
      </p>
      <p className="mt-4 text-[clamp(2rem,1.6rem+1.8vw,3.25rem)] font-light leading-none tracking-[-0.035em] text-text tabular-nums">
        {latest.shown.value}
        {latest.shown.unit && <Unit>{latest.shown.unit}</Unit>}
      </p>
      <div className="mt-4 flex items-baseline justify-between gap-3 text-[0.75rem] tabular-nums">
        <span className="truncate text-text-subtle">
          {longDate(latest.last.performedOn)}
        </span>
        {change && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 font-medium",
              flat || change.tone === "neutral"
                ? "text-text-muted"
                : change.tone === "good"
                  ? "text-good"
                  : "text-bad",
            )}
          >
            <Icon aria-hidden className="size-3.5" />
            {change.percent > 0 ? "+" : change.percent < 0 ? "−" : ""}
            {Math.abs(change.percent).toFixed(1).replace(".", ",")} %
          </span>
        )}
      </div>
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
          <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
            {g.title}
          </h2>
          <MetricTrends trends={g.trends} sport={sport} />
        </section>
      ))}
      {rest.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
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
          "inline-flex gap-1 rounded-full border border-line bg-surface p-1",
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
                "inline-flex items-center gap-2 whitespace-nowrap rounded-full transition-colors",
                size === "md" ? "h-9 px-4 text-sm" : "h-9 px-3.5 text-[0.8125rem]",
                item.active
                  ? size === "md"
                    ? "bg-text font-medium text-canvas"
                    : "bg-surface-2 font-medium text-text"
                  : "text-text-muted hover:bg-surface-2/60 hover:text-text",
              )}
            >
              {item.label}
              {item.count !== undefined && (
                <span
                  className={cn(
                    "font-mono text-[0.6875rem] tabular-nums",
                    item.active ? "text-canvas/60" : "text-text-subtle",
                  )}
                >
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
  basePath = routes.progression,
  goals = null,
  header,
}: {
  adeptId: string;
  sessions: FullSession[];
  canEdit: boolean;
  sport: Sport | null;
  view: string | undefined;
  /** Övriga parametrar i adressen, t.ex. vilken adept. */
  query?: Record<string, string>;
  /** Adressen vyn ligger på; valen av gren och vy läggs till som parametrar. */
  basePath?: string;
  /**
   * Fliken Mål och referens. Ett element som hämtar sitt eget underlag, och
   * som därför bara renderas – och hämtar – när fliken är vald.
   */
  goals?: React.ReactNode;
  /**
   * Sidans huvud, när vyn är hela sidan: rubriken blir påståendet om
   * tröskeln. Utan står påståendet som en rubrik överst i vyn.
   */
  header?: { eyebrow: string; title: string; description: string };
}) {
  if (sessions.length === 0) {
    return (
      <>
        {header && (
          <PageHeader
            size="lg"
            eyebrow={header.eyebrow}
            title={header.title}
            description={header.description}
          />
        )}
        <EmptyState
          title="Inga tester ännu"
          description="Progressionen byggs av testtillfällena. Registrera ett test – också ett gammalt, med datumet det gjordes – så börjar kurvorna fyllas."
        />
      </>
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
    ...(goals ? [{ key: "mal" as const, label: "Mål och referens" }] : []),
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
    return `${basePath}?${search.toString()}`;
  };

  const analysis = summariseProgress(trends);
  const insight = thresholdInsight(trends, sport);
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
      {header ? (
        <PageHeader
          size="lg"
          eyebrow={`${header.eyebrow} · ${SPORT_LABELS[sport]}`}
          title={insight?.title ?? header.title}
          description={insight?.lead ?? header.description}
        />
      ) : (
        insight && (
          <div className="pb-2">
            <h2 className="headline text-[clamp(2rem,1.5rem+1.8vw,3.25rem)] text-text">
              {insight.title}
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-text-muted">
              {insight.lead}
            </p>
          </div>
        )
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
        <div className="space-y-6">
          {headline.length > 0 ? (
            <div className="lift grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line xl:grid-cols-4">
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

          {trends.some((t) => ["LT2", "LT1", "CP", "CS"].includes(t.key)) && (
            <Card className="min-w-0">
              <CardTitle
                action={<ThresholdLegend trends={trends} sport={sport} />}
              >
                Trösklar över tid
              </CardTitle>
              <ThresholdChart trends={trends} sport={sport} />
              <p className="mt-4 text-[0.8125rem] text-text-muted">
                {thresholdNote(trends, sport)}
              </p>
            </Card>
          )}

          {(analysis.length > 0 || trends.length > 0) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {analysis.length > 0 && (
                <Card className="min-w-0">
                  <CardLabel>Kort analys</CardLabel>
                  <CardHeadline>{analysisHeadline(trends, sport)}</CardHeadline>
                  <div className="mt-4 max-w-2xl space-y-2 text-[0.9375rem] leading-relaxed text-text-muted">
                    {analysis.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                  <p className="mt-4 text-[0.75rem] text-text-subtle">
                    Första mot senaste test i varje serie.
                  </p>
                </Card>
              )}
              <BeforeAfter trends={trends} sport={sport} />
            </div>
          )}

          <Card className="min-w-0">
            <CardTitle
              action={
                <div className="flex flex-wrap gap-2">
                  {curves.length > 1 && (
                    <ButtonLink
                      href={href({ gren: SPORT_SLUGS[sport], vy: "laktat" })}
                      variant="secondary"
                      size="sm"
                    >
                      Jämför laktatkurvor
                    </ButtonLink>
                  )}
                  {canEdit && (
                    <ButtonLink
                      href={`${routes.adepts}/${adeptId}/test/nytt`}
                      size="sm"
                    >
                      Nytt testtillfälle
                    </ButtonLink>
                  )}
                </div>
              }
            >
              Testtillfällen
            </CardTitle>
            <SessionList
              sessions={inSport}
              hrefFor={(s) => `${routes.adepts}/${adeptId}/test/${s.id}`}
            />
          </Card>
        </div>
      )}

      {view === "mal" && goals}

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
          {utilisationNow && (
            <UtilisationCard
              summary={utilisationNow}
              diagnosis={utilisationDiagnosis(utilisationNow)}
            />
          )}
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

/** Raden under tröskeldiagrammet: hur mycket trenden går att lita på. */
function thresholdNote(trends: Trend[], sport: Sport): string {
  const counts = trends
    .filter((t) => ["LT2", "LT1", "CP", "CS"].includes(t.key))
    .map((t) => t.points.length);
  const fewest = Math.min(...counts);
  if (fewest <= 1)
    return "En punkt är ett läge, inte en trend. Nästa test visar riktningen.";
  if (fewest === 2)
    return "Två punkter per tröskel. Ett tredje test gör trenden pålitlig.";
  return `Upp till ${Math.max(...counts)} tester per tröskel${sport === "cykling" ? "" : ", farten ritad uppåt"}.`;
}
