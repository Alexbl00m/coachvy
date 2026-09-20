"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  CHART_AXIS_TEXT,
  CHART_GRID,
  SERIES,
} from "@/lib/calculators/chart-colors";
import {
  READINESS_MAX,
  READINESS_MIN,
  readReadiness,
  type LoadPoint,
} from "@/lib/training/load";

/**
 * Belastning och återhämtning i två paneler med samma tidsaxel.
 *
 * Samma skäl som i passbyggaren: två storheter med olika enheter får inte dela
 * ruta med var sin y-axel. Godtyckliga belastningsenheter och en
 * återhämtningspoäng 4–20 har ingen gemensam skala, och var kurvorna korsar
 * varandra skulle då styras av vilken skala någon råkade välja.
 *
 * Inuti belastningspanelen ligger däremot båda serierna i *samma* enhet.
 * Sjudagarsfönstret redovisas som ett dagsmedel och inte som en veckosumma,
 * just för att det ska gå att lägga rakt ovanpå stapeln för dagen: linjen går
 * då genom staplarna i stället för att sväva tusen enheter ovanför dem.
 *
 * Färgerna är validerade mot båda ytorna. Den gröna återhämtningslinjen ligger
 * precis på gränsen för kontrast mot vitt papper, så tabellen under grafen är
 * inte bara bekvämlighet – den är avlastningen som gör utskriften läsbar.
 */

const MARGIN = { top: 12, right: 16, bottom: 4, left: 0 };
const Y_WIDTH = 56;

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

/** "20 sep". Årtalet hör inte hemma på en åttaveckorsaxel. */
const shortDate = (iso: string) => {
  const months = [
    "jan", "feb", "mar", "apr", "maj", "jun",
    "jul", "aug", "sep", "okt", "nov", "dec",
  ];
  const [, month, day] = iso.split("-");
  return `${Number(day)} ${months[Number(month) - 1]}`;
};

type Row = {
  date: string;
  load: number | null;
  acuteMean: number;
  readiness: number | null;
};

/** En markering per vecka, oavsett hur långt fönstret är. */
function weeklyTicks(rows: Row[]): string[] {
  const step = Math.max(1, Math.round(rows.length / 8));
  return rows.filter((_, index) => index % step === 0).map((r) => r.date);
}

function LoadTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: Row }>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <div className="rounded-md border border-line bg-canvas px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-text">{shortDate(row.date)}</p>
      <p className="mt-1 text-text-muted tabular-nums">
        {row.load === null
          ? "Ingen incheckning"
          : row.load === 0
            ? "Vila"
            : `${Math.round(row.load)} belastningsenheter`}
      </p>
      <p className="text-text-subtle tabular-nums">
        Snitt 7 dagar: {Math.round(row.acuteMean)}
      </p>
    </div>
  );
}

function ReadinessTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: Row }>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row || row.readiness === null) return null;

  return (
    <div className="rounded-md border border-line bg-canvas px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-text">{shortDate(row.date)}</p>
      <p className="mt-1 text-text-muted tabular-nums">
        {row.readiness} av {READINESS_MAX} · {readReadiness(row.readiness)}
      </p>
    </div>
  );
}

/** Förklaringsruta. Två serier i samma panel behöver alltid en. */
function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 pl-[56px] text-[12px] text-text-muted">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function LoadChart({ points }: { points: LoadPoint[] }) {
  if (points.length < 2) return null;

  const rows: Row[] = points.map((point) => ({
    date: point.date,
    load: point.load,
    acuteMean: point.acute / 7,
    readiness: point.readiness,
  }));

  const ticks = weeklyTicks(rows);
  const maxLoad = Math.max(
    ...rows.map((r) => Math.max(r.load ?? 0, r.acuteMean)),
    10,
  );
  const hasReadiness = rows.some((r) => r.readiness !== null);

  return (
    <div className="space-y-2">
      <Legend
        items={[
          { label: "Belastning per dag", color: SERIES.primary },
          { label: "Snitt 7 dagar", color: SERIES.secondary },
        ]}
      />

      <div className="h-[230px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={MARGIN}>
            <CartesianGrid
              stroke={CHART_GRID}
              strokeDasharray="2 4"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              ticks={ticks}
              tickFormatter={shortDate}
              stroke={CHART_GRID}
              tick={hasReadiness ? false : { fill: CHART_AXIS_TEXT, fontSize: 12 }}
              tickLine={false}
              height={hasReadiness ? 12 : 30}
            />
            <YAxis
              domain={[0, Math.ceil((maxLoad * 1.1) / 100) * 100]}
              stroke={CHART_GRID}
              tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }}
              tickLine={false}
              width={Y_WIDTH}
            />
            <Tooltip
              content={<LoadTooltip />}
              cursor={{ fill: CHART_GRID, fillOpacity: 0.25 }}
            />

            <Bar
              dataKey="load"
              fill={SERIES.primary}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
              maxBarSize={14}
            />
            <Line
              type="monotone"
              dataKey="acuteMean"
              stroke={SERIES.secondary}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, fill: SERIES.secondary }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {hasReadiness && (
        <>
          <p className="pl-[56px] text-[12px] text-text-muted">
            Återhämtning, {READINESS_MIN}–{READINESS_MAX}
          </p>
          <div className="h-[150px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={MARGIN}>
                <CartesianGrid
                  stroke={CHART_GRID}
                  strokeDasharray="2 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  ticks={ticks}
                  tickFormatter={shortDate}
                  stroke={CHART_GRID}
                  tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  domain={[READINESS_MIN, READINESS_MAX]}
                  ticks={[4, 8, 12, 16, 20]}
                  stroke={CHART_GRID}
                  tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }}
                  tickLine={false}
                  width={Y_WIDTH}
                />
                <Tooltip
                  content={<ReadinessTooltip />}
                  cursor={{ stroke: CHART_AXIS_TEXT, strokeDasharray: "3 3" }}
                />
                <Line
                  type="monotone"
                  dataKey="readiness"
                  stroke={SERIES.tertiary}
                  strokeWidth={2}
                  dot={false}
                  // Dagar utan incheckning bryter linjen i stället för att
                  // dras rakt igenom. En rak linje över ett hål påstår att
                  // måendet var oförändrat, vilket vi inte vet.
                  connectNulls={false}
                  isAnimationActive={false}
                  activeDot={{ r: 4, fill: SERIES.tertiary }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <p className="pl-[56px] text-[11px] text-text-subtle">
        Belastning är sessions-RPE gånger passets längd i minuter. Enheten är
        godtycklig men jämförbar med sig själv över tid.
      </p>
    </div>
  );
}

export { sv };
