"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
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
import type { Sport } from "@/lib/calculators/lactate";
import type { BalanceResult } from "@/lib/workouts/balance";
import {
  formatDuration,
  formatPace,
  type ResolvedStep,
  type TargetBasis,
} from "@/lib/workouts/schema";

/**
 * Passets profil och W′bal under den, i två paneler med samma tidsaxel.
 *
 * De ligger inte i samma diagram med var sin y-axel, hur mycket det än hade
 * liknat förlagan. Två axlar i samma ruta låter läsaren jämföra två storheter
 * som inte är jämförbara, och var kurvorna korsar varandra styrs då av vilken
 * skala någon råkade välja. Under varandra, med samma x-axel och samma
 * marginaler, går dipparna ändå att läsa mot intervallerna – och då betyder
 * avståndet mellan kurvorna ingenting, vilket är sanningen.
 */

/** Samma vänstermarginal i båda panelerna, annars glider tidsaxlarna isär. */
const MARGIN = { top: 12, right: 16, bottom: 4, left: 0 };
const Y_WIDTH = 52;

type ProfilePoint = { t: number; percent: number; target: number };

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

/**
 * Stegen till en trappa.
 *
 * En punkt vid varje stegs början plus en avslutande punkt räcker: `stepAfter`
 * håller värdet tills nästa punkt, vilket är precis vad ett intervall gör.
 */
function toProfile(steps: ResolvedStep[], reference: number): ProfilePoint[] {
  const points: ProfilePoint[] = [];
  let t = 0;

  for (const step of steps) {
    points.push({ t, percent: (step.target / reference) * 100, target: step.target });
    t += step.seconds;
  }

  const last = steps[steps.length - 1];
  points.push({
    t,
    percent: (last.target / reference) * 100,
    target: last.target,
  });

  return points;
}

function ProfileTooltip({
  active,
  payload,
  sport,
  basis,
}: {
  active?: boolean;
  payload?: Array<{ payload: ProfilePoint }>;
  sport: Sport;
  basis: TargetBasis;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-md border border-line bg-canvas px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-text tabular-nums">
        {formatDuration(point.t)}
      </p>
      <p className="mt-1 text-text-muted tabular-nums">
        {Math.round(point.percent)} % av {basis}
      </p>
      <p className="text-text-muted tabular-nums">
        {sport === "cykling"
          ? `${Math.round(point.target)} W`
          : `${sv(point.target, 2)} m/s · ${formatPace(point.target, sport)}`}
      </p>
    </div>
  );
}

function BalanceTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ payload: { t: number; percent: number; balance: number } }>;
  unit: "kJ" | "m";
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-md border border-line bg-canvas px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-text tabular-nums">
        {formatDuration(point.t)}
      </p>
      <p className="mt-1 text-text-muted tabular-nums">
        {Math.round(point.percent)} % kvar ·{" "}
        {unit === "kJ"
          ? `${sv(point.balance / 1000, 1)} kJ`
          : `${Math.round(point.balance)} m`}
      </p>
    </div>
  );
}

const timeTick = (value: number) => formatDuration(value);

/**
 * Jämna tidsmarkeringar i stället för de recharts väljer själv.
 *
 * Automatiken delar tidsaxeln i lika delar, vilket ger "14:10" och "28:20" –
 * tal som inte betyder något för den som läser ett pass. Här väljs i stället
 * ett jämnt steg som ger ungefär ett halvdussin markeringar.
 */
function timeTicks(totalSeconds: number): number[] {
  const step =
    [30, 60, 120, 300, 600, 900, 1800, 3600].find(
      (candidate) => totalSeconds / candidate <= 7,
    ) ?? 3600;

  const ticks: number[] = [];
  for (let t = 0; t <= totalSeconds; t += step) ticks.push(t);

  // Slutet läggs till bara när det inte trängs med föregående markering.
  const last = ticks[ticks.length - 1];
  if (totalSeconds - last > step / 2) ticks.push(totalSeconds);
  return ticks;
}

/**
 * Procentmarkeringar med steget 20, så att 100 % alltid hamnar på en linje.
 * Tröskeln är den enda nivå i grafen som betyder något i sig.
 */
function percentTicks(max: number): { domain: [number, number]; ticks: number[] } {
  const top = Math.ceil((max + 5) / 20) * 20;
  const ticks: number[] = [];
  for (let value = 0; value <= top; value += 20) ticks.push(value);
  return { domain: [0, top], ticks };
}

export function WorkoutChart({
  steps,
  reference,
  basis,
  sport,
  balance,
}: {
  steps: ResolvedStep[];
  reference: number;
  basis: TargetBasis;
  sport: Sport;
  balance: BalanceResult | null;
}) {
  if (steps.length === 0 || !(reference > 0)) return null;

  const profile = toProfile(steps, reference);
  const totalSeconds = profile[profile.length - 1].t;
  const maxPercent = Math.max(...profile.map((p) => p.percent), 100);
  const scale = percentTicks(maxPercent);
  const ticks = timeTicks(totalSeconds);
  const unit = sport === "cykling" ? "kJ" : "m";

  const balanceData =
    balance?.series.map((point) => ({
      t: point.t,
      percent: point.fraction * 100,
      balance: point.balance,
    })) ?? [];

  return (
    <div className="space-y-1">
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={profile} margin={MARGIN}>
            <defs>
              <linearGradient id="profile-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES.primary} stopOpacity={0.55} />
                <stop offset="100%" stopColor={SERIES.primary} stopOpacity={0.08} />
              </linearGradient>
            </defs>

            <CartesianGrid
              stroke={CHART_GRID}
              strokeDasharray="2 4"
              vertical={false}
            />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, totalSeconds]}
              ticks={ticks}
              tickFormatter={timeTick}
              stroke={CHART_GRID}
              // Panelerna delar tidsaxel. Står den skriven två gånger läser
              // man den som två olika axlar.
              tick={
                balance ? false : { fill: CHART_AXIS_TEXT, fontSize: 12 }
              }
              tickLine={false}
              height={balance ? 12 : 30}
            />
            <YAxis
              domain={scale.domain}
              ticks={scale.ticks}
              stroke={CHART_GRID}
              tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }}
              tickLine={false}
              width={Y_WIDTH}
              tickFormatter={(v: number) => `${Math.round(v)} %`}
            />
            <Tooltip
              content={<ProfileTooltip sport={sport} basis={basis} />}
              cursor={{ stroke: CHART_AXIS_TEXT, strokeDasharray: "3 3" }}
            />

            {/* Tröskeln. Allt ovanför den tär på reserven, allt under fyller på. */}
            <ReferenceLine
              y={100}
              stroke={CHART_AXIS_TEXT}
              strokeDasharray="4 4"
              label={{
                value: basis,
                position: "insideTopLeft",
                fill: CHART_AXIS_TEXT,
                fontSize: 11,
              }}
            />

            <Area
              type="stepAfter"
              dataKey="percent"
              stroke={SERIES.primary}
              strokeWidth={2}
              fill="url(#profile-fill)"
              isAnimationActive={false}
              activeDot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {balance && balanceData.length > 1 && (
        <div className="h-[170px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={balanceData} margin={MARGIN}>
              <defs>
                <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={SERIES.secondary}
                    stopOpacity={0.45}
                  />
                  <stop
                    offset="100%"
                    stopColor={SERIES.secondary}
                    stopOpacity={0.06}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                stroke={CHART_GRID}
                strokeDasharray="2 4"
                vertical={false}
              />
              <XAxis
                dataKey="t"
                type="number"
                domain={[0, totalSeconds]}
                ticks={ticks}
                tickFormatter={timeTick}
                stroke={CHART_GRID}
                tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                stroke={CHART_GRID}
                tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }}
                tickLine={false}
                width={Y_WIDTH}
                tickFormatter={(v: number) => `${Math.round(v)} %`}
              />
              <Tooltip
                content={<BalanceTooltip unit={unit} />}
                cursor={{ stroke: CHART_AXIS_TEXT, strokeDasharray: "3 3" }}
              />

              <Area
                type="monotone"
                dataKey="percent"
                stroke={SERIES.secondary}
                strokeWidth={2}
                fill="url(#balance-fill)"
                isAnimationActive={false}
                activeDot={{ r: 4, fill: SERIES.secondary }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="pl-[52px] text-[11px] text-text-subtle">
        Överst: målet som andel av {basis}.
        {balance
          ? ` Nederst: ${sport === "cykling" ? "W′" : "D′"} som är kvar, i procent av full reserv.`
          : ""}
      </p>
    </div>
  );
}
