import { Card, CardTitle } from "@/components/ui/card";
import { paceOf } from "@/lib/activities/analysis";
import {
  durabilityProfile,
  durabilityReading,
  type DurabilityAxis,
  type DurabilityProfile,
  type DurabilitySource,
} from "@/lib/activities/durability";
import type { DurabilitySources } from "@/lib/activities/durability-queries";
import { SERIES } from "@/lib/calculators/chart-colors";
import { addDays } from "@/lib/season/season";

const sv = (v: number, digits = 0) => v.toFixed(digits).replace(".", ",");

/** Längderna i diagrammet, med färg; 1 min står bara i tabellen. */
const LINES: { span: number; label: string; color: string }[] = [
  { span: 300, label: "5 min", color: SERIES.secondary },
  { span: 1200, label: "20 min", color: SERIES.primary },
];

/** Andel av utvilad per nivå, som linjer. Nivåer utan pass hoppas över. */
function DropChart({ profile }: { profile: DurabilityProfile }) {
  const W = 320;
  const H = 150;
  const pad = { l: 34, r: 44, t: 10, b: 24 };
  const n = profile.levels.length;
  const x = (i: number) =>
    pad.l + (i / Math.max(n - 1, 1)) * (W - pad.l - pad.r);
  const series = LINES.map((line) => {
    const fresh = profile.levels[0]?.best[line.span]?.value;
    const pts = profile.levels
      .map((l, i) => {
        const v = l.best[line.span]?.value;
        return fresh && v ? { i, pct: (v / fresh) * 100 } : null;
      })
      .filter((p): p is { i: number; pct: number } => p !== null);
    return { ...line, pts };
  }).filter((s) => s.pts.length >= 2);
  if (series.length === 0) return null;

  const lowest = Math.min(...series.flatMap((s) => s.pts.map((p) => p.pct)));
  const yMin = Math.min(90, Math.floor((lowest - 2) / 5) * 5);
  const y = (pct: number) =>
    pad.t + ((100 - pct) / (100 - yMin)) * (H - pad.t - pad.b);
  const grid = Array.from(
    { length: Math.floor((100 - yMin) / 5) + 1 },
    (_, k) => 100 - k * 5,
  ).filter((g, k, all) => all.length <= 5 || g % 10 === 0);

  // Etiketterna vid linjernas slut glider isär när linjerna slutar nära.
  const labelY = series.map((s) => y(s.pts[s.pts.length - 1].pct));
  if (labelY.length === 2 && Math.abs(labelY[0] - labelY[1]) < 11) {
    const mid = (labelY[0] + labelY[1]) / 2;
    const up = labelY[0] <= labelY[1] ? 0 : 1;
    labelY[up] = mid - 5.5;
    labelY[1 - up] = mid + 5.5;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full max-w-md"
      role="img"
      aria-label={`Bästa 5 och 20 minuter som andel av utvilad, efter ${profile.unit}`}
    >
      {grid.map((g) => (
        <g key={g}>
          <line
            x1={pad.l}
            x2={W - pad.r}
            y1={y(g)}
            y2={y(g)}
            stroke="var(--line)"
            strokeWidth={1}
          />
          <text
            x={pad.l - 6}
            y={y(g) + 3.5}
            textAnchor="end"
            className="fill-text-subtle text-[0.625rem] tabular-nums"
          >
            {g} %
          </text>
        </g>
      ))}
      {profile.levels.map((l, i) => (
        <text
          key={l.level}
          x={x(i)}
          y={H - 6}
          textAnchor="middle"
          className="fill-text-subtle text-[0.625rem] tabular-nums"
        >
          {l.level}
          {i === n - 1 ? ` ${profile.unit}` : ""}
        </text>
      ))}
      {series.map((s, k) => {
        const last = s.pts[s.pts.length - 1];
        return (
          <g key={s.span}>
            <polyline
              points={s.pts.map((p) => `${x(p.i)},${y(p.pct)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {s.pts.map((p) => (
              <circle
                key={p.i}
                cx={x(p.i)}
                cy={y(p.pct)}
                r={p === last ? 3.5 : 2.5}
                fill={s.color}
              />
            ))}
            <text
              x={x(last.i) + 7}
              y={labelY[k] + 3.5}
              className="text-[0.625rem] font-medium"
              fill={s.color}
            >
              {s.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Section({
  title,
  axis,
  now,
  before,
  weightKg,
}: {
  title: string;
  axis: DurabilityAxis;
  now: DurabilitySource[];
  before: DurabilitySource[];
  weightKg: number | null;
}) {
  const profile = durabilityProfile(now, axis, weightKg);
  // Utan en enda nivå efter utvilad finns ingen durability att visa.
  if (!profile.levels.some((l) => l.level > 0 && l.support > 0)) return null;
  const previous = before.length
    ? durabilityProfile(before, axis, weightKg)
    : null;
  const show = (v: number) =>
    axis === "kJ" ? `${sv(v)} W` : `${paceOf(v)} /km`;
  const reading = durabilityReading(profile, previous, show);
  const estimated = now.filter((s) => s.estimated).length;
  const visible = profile.levels.filter((l, i) => i === 0 || l.support > 0);

  return (
    <section aria-labelledby={`durability-${axis}`} className="min-w-0">
      <h3 id={`durability-${axis}`} className="text-sm font-medium text-text">
        {title}
        <span className="ml-2 font-normal text-text-muted">
          efter {profile.unit}
        </span>
      </h3>

      <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <DropChart profile={{ ...profile, levels: visible }} />
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[20rem] text-[0.8125rem] tabular-nums">
            <caption className="sr-only">
              Bästa per längd efter utfört arbete, {title.toLowerCase()}
            </caption>
            <thead>
              <tr className="text-left text-text-muted">
                <th scope="col" className="py-1 pr-3 font-normal">
                  Efter, {profile.unit}
                </th>
                {visible.map((l) => (
                  <th
                    key={l.level}
                    scope="col"
                    className="py-1 pr-3 text-right font-normal"
                  >
                    {l.level === 0 ? "Utvilad" : l.level}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[60, 300, 1200].map((span) => {
                const fresh = profile.levels[0]?.best[span]?.value;
                return (
                  <tr key={span} className="border-t border-line">
                    <th
                      scope="row"
                      className="py-1.5 pr-3 text-left font-normal text-text-muted"
                    >
                      {span === 60
                        ? "1 min"
                        : span === 300
                          ? "5 min"
                          : "20 min"}
                    </th>
                    {visible.map((l) => {
                      const v = l.best[span]?.value;
                      return (
                        <td
                          key={l.level}
                          className="whitespace-nowrap py-1.5 pr-3 text-right"
                        >
                          {v ? (
                            <>
                              <span className="text-text">{show(v)}</span>
                              {fresh && l.level > 0 && (
                                <span className="block text-[0.75rem] text-text-subtle">
                                  {sv((v / fresh) * 100)} %
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-text-subtle">–</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr className="border-t border-line text-text-subtle">
                <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                  Pass
                </th>
                {visible.map((l) => (
                  <td
                    key={l.level}
                    className="whitespace-nowrap py-1.5 pr-3 text-right"
                  >
                    {l.support}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {reading.length > 0 && (
        <div className="mt-4 space-y-1 text-sm text-text">
          {reading.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
      {estimated > 0 && (
        <p className="mt-2 text-[0.8125rem] text-text-muted">
          {estimated} äldre pass är räknade ur den sparade serien, som jämnar ut
          korta toppar – där kan tappet se något större ut än det var.
        </p>
      )}
    </section>
  );
}

/**
 * Durability de senaste 90 dagarna: bästa 1, 5 och 20 minuter utvilad och
 * efter utfört arbete, och tappet mellan dem, jämfört med 90 dagar före.
 */
export function DurabilityCard({
  sources,
  today,
  weightKg,
}: {
  sources: DurabilitySources;
  today: string;
  weightKg: number | null;
}) {
  const from = addDays(today, -89);
  const prevFrom = addDays(today, -179);
  const split = (list: DurabilitySource[]) => ({
    now: list.filter((s) => s.performed_on >= from && s.performed_on <= today),
    before: list.filter(
      (s) => s.performed_on >= prevFrom && s.performed_on < from,
    ),
  });
  const cycling = split(sources.kJ);
  const running = split(sources.min);
  const sections = [
    <Section
      key="kJ"
      title="Cykling"
      axis="kJ"
      weightKg={weightKg}
      {...cycling}
    />,
    <Section
      key="min"
      title="Löpning"
      axis="min"
      weightKg={null}
      {...running}
    />,
  ];
  // En sektion utan data renderar null; utan någon alls visas inget kort.
  const hasAny = (["kJ", "min"] as DurabilityAxis[]).some((axis) =>
    durabilityProfile(
      axis === "kJ" ? cycling.now : running.now,
      axis,
      axis === "kJ" ? weightKg : null,
    ).levels.some((l) => l.level > 0 && l.support > 0),
  );
  if (!hasAny) return null;

  return (
    <Card className="min-w-0">
      <CardTitle>Durability: förmågan efter utfört arbete</CardTitle>
      <div className="space-y-8">{sections}</div>
      <p className="mt-5 text-[0.8125rem] leading-relaxed text-text-muted">
        Bästa insatser som börjar efter att arbetet redan gjorts – kJ per kilo
        kroppsvikt på cykeln, minuter i rörelse i löpningen – de senaste 90
        dagarna, som andel av samma längd utvilad. Långa lopp avgörs där, och
        tappet skiljer sig mellan idrottare (Maunder m.fl. 2021). Som
        bästa-kurvan visar den vad adepten minst klarar: värdena blir
        rättvisande först med lopp och långa pass med kvalitet mot slutet, och
        raden Pass säger hur många som bär varje nivå.
        {weightKg === null &&
          " Vikt saknas i testerna, så cyklingen visas i kJ i stället för kJ/kg."}
      </p>
    </Card>
  );
}
