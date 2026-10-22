import type { Sport } from "@/lib/calculators/lactate";
import { digitsForMetric } from "@/lib/format";
import { monthName } from "@/lib/season/season";
import { displayValue } from "@/lib/tests/pace";
import type { Trend } from "@/lib/tests/progression";

/** Seriernas färg och streck: tröskeln i textens färg, LT1 blå, CP/CS guld. */
const STYLE: Record<string, { color: string; dashed?: boolean; name: string }> =
  {
    LT2: { color: "var(--text)", name: "LT2" },
    LT1: { color: "var(--zone-2-text)", name: "LT1" },
    CP: { color: "var(--zone-4)", dashed: true, name: "Critical power" },
    FTP: { color: "var(--zone-4)", dashed: true, name: "FTP" },
    CS: { color: "var(--zone-4)", dashed: true, name: "Critical speed" },
  };

const KEYS: Record<Sport, string[]> = {
  cykling: ["LT2", "LT1", "CP"],
  löpning: ["LT2", "LT1", "CS"],
  simning: ["CS", "LT2", "LT1"],
};

const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;
const shortMonth = (iso: string) =>
  `${monthName(Number(iso.slice(5, 7)) - 1).slice(0, 3)} ${iso.slice(2, 4)}`;

/** Runda steg för y-axeln: 1, 2 eller 5 gånger en tiopotens. */
function niceStep(span: number, count: number) {
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const nice =
    unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return nice * power;
}

/**
 * Trösklarna över tid i ett diagram: en linje per tröskel, första och
 * senaste värdet utskrivna vid punkterna. Linjerna ritas i en SVG som
 * sträcks till bredden; punkter och text ligger ovanpå i HTML, så att de inte
 * dras ut. Farter i löpning och simning ritas som fart – uppåt är snabbare –
 * och skrivs som tempo.
 */
export function ThresholdChart({
  trends,
  sport,
}: {
  trends: Trend[];
  sport: Sport;
}) {
  const series = KEYS[sport]
    .map((key) => trends.find((t) => t.key === key && t.points.length > 0))
    .filter((t): t is Trend => Boolean(t));
  if (series.length === 0) return null;
  // Farter och watt blandas inte i samma diagram.
  const unit = series[0].unit;
  const shown = series.filter((t) => t.unit === unit);

  const all = shown.flatMap((t) => t.points);
  const days = all.map((p) => dayNumber(p.performedOn));
  const first = Math.min(...days);
  const last = Math.max(...days);
  const xSpan = Math.max(30, last - first);
  const x = (iso: string) => 4 + ((dayNumber(iso) - first) / xSpan) * 92;

  const values = all.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.18, hi * 0.03);
  const yMin = lo - pad;
  const yMax = hi + pad;
  const step = niceStep(yMax - yMin, 4);
  const y = (v: number) => 92 - ((v - yMin) / (yMax - yMin)) * 84;
  const ticks: number[] = [];
  for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step)
    ticks.push(v);

  // Etiketterna: den lägsta serien skriver sina tal under punkterna, de
  // andra ovanför, så att tal i samma lodlinje inte hamnar på varandra.
  const mean = (t: Trend) =>
    t.points.reduce((sum, p) => sum + p.value, 0) / t.points.length;
  const lowest =
    shown.length > 1
      ? shown.reduce((a, b) => (mean(b) < mean(a) ? b : a))
      : null;

  const label = (trend: Trend, value: number) =>
    displayValue(
      value,
      trend.unit,
      sport,
      digitsForMetric(trend.key, trend.unit),
    ).value;

  // Månader på x-axeln: ungefär fem, jämnt fördelade.
  const months: string[] = [];
  const monthStep = Math.max(1, Math.round(xSpan / 30.4 / 5));
  const start = new Date(first * 86_400_000);
  for (let i = 0; ; i += monthStep) {
    const d = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1),
    );
    const iso = d.toISOString().slice(0, 10);
    if (dayNumber(iso) > last) break;
    if (dayNumber(iso) >= first) months.push(iso);
  }

  return (
    <figure className="min-w-0">
      <div className="relative h-64 sm:h-80">
        {/* Rutnätet och y-axelns tal. */}
        {ticks.map((v) => (
          <div
            key={v}
            className="absolute inset-x-0 flex items-center gap-3"
            style={{ top: `${y(v)}%` }}
            aria-hidden
          >
            <span className="w-10 -translate-y-1/2 font-mono text-[0.6875rem] text-[var(--chart-axis-text)] tabular-nums">
              {label(shown[0], v)}
            </span>
            <span className="h-px flex-1 -translate-y-1/2 border-t border-dashed border-[var(--chart-grid)]" />
          </div>
        ))}
        <div className="absolute inset-y-0 left-12 right-0">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
            aria-hidden
          >
            {months.map((iso) => (
              <line
                key={iso}
                x1={x(iso)}
                x2={x(iso)}
                y1={4}
                y2={96}
                stroke="var(--chart-grid)"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {shown.map((t) => (
              <polyline
                key={t.id}
                points={t.points
                  .map((p) => `${x(p.performedOn)},${y(p.value)}`)
                  .join(" ")}
                fill="none"
                stroke={STYLE[t.key]?.color ?? "var(--text-muted)"}
                strokeWidth={2}
                strokeDasharray={STYLE[t.key]?.dashed ? "6 5" : undefined}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {shown.map((t) =>
            t.points.map((p, i) => {
              const edge = i === 0 || i === t.points.length - 1;
              const lastPoint = i === t.points.length - 1;
              const color = STYLE[t.key]?.color ?? "var(--text-muted)";
              return (
                <div
                  key={`${t.id}-${p.sessionId}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${x(p.performedOn)}%`,
                    top: `${y(p.value)}%`,
                  }}
                >
                  <span
                    className="block size-3 rounded-full border-2"
                    style={{
                      borderColor: color,
                      background: lastPoint ? color : "var(--chart-surface)",
                    }}
                  />
                  {edge && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[0.8125rem] font-semibold tabular-nums"
                      style={{
                        color,
                        ...(t === lowest
                          ? { top: "1.1rem" }
                          : { bottom: "1.1rem" }),
                      }}
                    >
                      {label(t, p.value)}
                    </span>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </div>
      <div
        className="relative ml-12 mt-3 h-4 font-mono text-[0.6875rem] text-text-subtle"
        aria-hidden
      >
        {months.map((iso) => (
          <span
            key={iso}
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${x(iso)}%` }}
          >
            {shortMonth(iso)}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        {shown
          .map(
            (t) =>
              `${t.label}: ${t.points.map((p) => `${label(t, p.value)} ${p.performedOn}`).join(", ")}`,
          )
          .join(". ")}
      </figcaption>
    </figure>
  );
}

/** Förklaringen till diagrammet, för kortets rubrikrad. */
export function ThresholdLegend({
  trends,
  sport,
}: {
  trends: Trend[];
  sport: Sport;
}) {
  const keys = KEYS[sport].filter((key) =>
    trends.some((t) => t.key === key && t.points.length > 0),
  );
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem] text-text-muted">
      {keys.map((key) => (
        <li key={key} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="w-4 border-t-2"
            style={{
              borderColor: STYLE[key].color,
              borderStyle: STYLE[key].dashed ? "dashed" : "solid",
            }}
          />
          {STYLE[key].name}
        </li>
      ))}
    </ul>
  );
}
