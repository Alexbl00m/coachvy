import { CoachvyMark } from "@/components/logo";
import { SERIES } from "@/lib/calculators/chart-colors";
import { cn } from "@/lib/cn";

/**
 * En stillbild av ett laktattest som det ser ut i Coachvy, med påhittade
 * värden. Den visar vad en adept får ut av ett test – trösklar, kurva och
 * zoner – i stället för att påstå något i siffror om verksamheten.
 *
 * Ritad som SVG här i stället för med appens diagramkomponent: en bild på
 * startsidan ska inte ladda ett diagrambibliotek.
 */

// Effekt (W) mot laktat (mmol/l). Påhittat, men i rimliga proportioner.
const POINTS: [number, number][] = [
  [100, 1.0],
  [140, 1.0],
  [180, 1.1],
  [220, 1.4],
  [250, 1.9],
  [280, 2.9],
  [310, 4.6],
  [340, 7.4],
];
const LT1 = 225;
const LT2 = 296;

const ZONES = [
  { name: "Z1", label: "Återhämtning", watt: "–170", hr: "–128" },
  { name: "Z2", label: "Grund", watt: "170–225", hr: "128–145" },
  { name: "Z3", label: "Tempo", watt: "225–265", hr: "146–158" },
  { name: "Z4", label: "Tröskel", watt: "265–300", hr: "159–170" },
  { name: "Z5", label: "VO2max", watt: "300–", hr: "171–" },
];

const W = 640;
const H = 248;
const PAD = { left: 36, right: 16, top: 16, bottom: 30 };
const X0 = 100;
const X1 = 350;
const Y1 = 8;
const x = (w: number) =>
  PAD.left + ((w - X0) / (X1 - X0)) * (W - PAD.left - PAD.right);
const y = (mmol: number) =>
  H - PAD.bottom - (mmol / Y1) * (H - PAD.top - PAD.bottom);

/** Catmull–Rom genom punkterna, som kubiska bézier – en mjuk kurva. */
function curve(points: [number, number][]) {
  const p = points.map(([w, l]) => [x(w), y(l)] as const);
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i];
    const b = p[i];
    const c = p[i + 1];
    const e = p[i + 2] ?? c;
    const c1 = [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6];
    const c2 = [c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${c[0].toFixed(1)},${c[1].toFixed(1)}`;
  }
  return d;
}
const PATH = curve(POINTS);

function LactateChart() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="presentation"
    >
      {[0, 2, 4, 6, 8].map((mmol) => (
        <g key={mmol}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(mmol)}
            y2={y(mmol)}
            stroke="var(--chart-grid)"
          />
          <text
            x={PAD.left - 10}
            y={y(mmol) + 4}
            textAnchor="end"
            fontSize="11"
            fill="var(--chart-axis-text)"
            className="font-mono"
          >
            {mmol}
          </text>
        </g>
      ))}
      {[150, 200, 250, 300].map((w) => (
        <text
          key={w}
          x={x(w)}
          y={H - 8}
          textAnchor="middle"
          fontSize="11"
          fill="var(--chart-axis-text)"
          className="font-mono"
        >
          {w} W
        </text>
      ))}
      {[
        [LT1, "LT1"],
        [LT2, "LT2"],
      ].map(([w, label]) => (
        <g key={label}>
          <line
            x1={x(w as number)}
            x2={x(w as number)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="var(--text-subtle)"
            strokeDasharray="3 4"
          />
          <text
            x={x(w as number) + 6}
            y={PAD.top + 10}
            fontSize="11"
            fill="var(--text-muted)"
            className="font-mono"
          >
            {label} {w} W
          </text>
        </g>
      ))}
      <path d={PATH} fill="none" stroke={SERIES.primary} strokeWidth="2.25" />
      {POINTS.map(([w, l]) => (
        <circle
          key={w}
          cx={x(w)}
          cy={y(l)}
          r="3.5"
          fill="var(--surface)"
          stroke={SERIES.primary}
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

const NAV = ["Översikt", "Adepter", "Planer", "Kalender", "Progression"];

export function TestPreview({ className }: { className?: string }) {
  return (
    <figure className={cn("w-full", className)}>
      {/* Bilden är en illustration, inte ett gränssnitt: allt i den döljs för
          skärmläsare och beskrivs i bildtexten. */}
      <div
        aria-hidden
        className="lift overflow-hidden rounded-xl border border-line-strong bg-surface select-none"
      >
        <div className="flex h-11 items-center justify-between border-b border-line px-4 text-[13px]">
          <span className="truncate text-text-subtle">
            <span className="hidden sm:inline">
              Adepter <span className="px-1.5">/</span>
            </span>
            Exempeladept <span className="px-1.5">/</span>
            <span className="text-text-muted">Laktattest cykel</span>
          </span>
          <span className="rounded-[6px] border border-line-strong px-1.5 py-0.5 font-mono text-[11px] text-text-subtle">
            Exempel
          </span>
        </div>

        <div className="grid md:grid-cols-[176px_minmax(0,1fr)]">
          <div className="hidden border-r border-line p-3 md:block">
            {/* Som sidomenyns huvud i appen, i mindre storlek. */}
            <p className="flex items-center gap-2 px-2 pt-0.5 pb-3 text-[13px] font-semibold tracking-tight text-text">
              <CoachvyMark weight="bold" className="size-5" />
              Coachvy
            </p>
            {NAV.map((item) => (
              <div
                key={item}
                className={cn(
                  "rounded-md px-2 py-1.5 text-[13px]",
                  item === "Adepter"
                    ? "bg-surface-3 text-text"
                    : "text-text-muted",
                )}
              >
                {item}
              </div>
            ))}
          </div>

          <div className="min-w-0 p-4 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[18px] font-semibold tracking-[-0.012em] text-text">
                Laktattest · cykel
              </p>
              <p className="font-mono text-[12px] text-text-subtle">
                8 steg · 4 min per steg
              </p>
            </div>

            <dl className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
              {[
                ["Aerob tröskel", "225 W", "puls 145"],
                ["Anaerob tröskel", "296 W", "puls 170"],
                ["VO2max, uppskattad", "58", "ml/kg/min"],
              ].map(([label, value, note]) => (
                <div key={label} className="bg-surface px-3 py-3 sm:px-4">
                  <dt className="truncate text-[12px] text-text-muted">
                    {label}
                  </dt>
                  <dd className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-text tabular-nums sm:text-[24px]">
                    {value}
                  </dd>
                  <dd className="font-mono text-[11px] text-text-subtle">
                    {note}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_236px]">
              <div className="min-w-0">
                <p className="mb-2 text-[12px] text-text-muted">
                  Laktat, mmol/l
                </p>
                <LactateChart />
              </div>
              <div className="hidden lg:block">
                <p className="mb-2 text-[12px] text-text-muted">Zoner</p>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-text-subtle">
                      <th className="pb-2 font-medium">Zon</th>
                      <th className="pb-2 text-right font-medium">Watt</th>
                      <th className="pb-2 text-right font-medium">Puls</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {ZONES.map((zone) => (
                      <tr key={zone.name} className="border-t border-line">
                        <td className="py-2 font-sans text-text">
                          {zone.name}{" "}
                          <span className="text-text-subtle">{zone.label}</span>
                        </td>
                        <td className="py-2 text-right text-text-muted">
                          {zone.watt}
                        </td>
                        <td className="py-2 text-right text-text-muted">
                          {zone.hr}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-[13px] text-text-subtle">
        Så ser ett laktattest ut i Coachvy: trösklarna, kurvan och zonerna du
        tränar efter. Värdena är ett exempel.
      </figcaption>
    </figure>
  );
}
