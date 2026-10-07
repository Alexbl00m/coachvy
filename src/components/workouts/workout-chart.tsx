"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  PLOT_LEFT,
  PLOT_RIGHT,
  timeTicks,
  WorkoutProfile,
  ZoneLegend,
} from "@/components/workouts/workout-profile";
import {
  CHART_AXIS_TEXT,
  CHART_GRID,
  SERIES,
} from "@/lib/calculators/chart-colors";
import type { Sport } from "@/lib/calculators/lactate";
import type { BalanceResult } from "@/lib/workouts/balance";
import { profileBlocks } from "@/lib/workouts/blocks";
import { ZONES } from "@/lib/workouts/intensity";
import {
  formatDuration,
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

/** Samma marginaler som profilen ovanför, annars glider tidsaxlarna isär. */
const MARGIN = { top: 12, right: PLOT_RIGHT, bottom: 4, left: 0 };

const sv = (value: number, digits: number) =>
  value.toFixed(digits).replace(".", ",");

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
      <p className="text-sm font-semibold text-text tabular-nums">
        {Math.round(point.percent)} % kvar
      </p>
      <p className="mt-0.5 text-text-muted tabular-nums">
        {unit === "kJ"
          ? `${sv(point.balance / 1000, 1)} kJ`
          : `${Math.round(point.balance)} m`}{" "}
        · {formatDuration(point.t)}
      </p>
    </div>
  );
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

  const totalSeconds = steps.reduce((sum, step) => sum + step.seconds, 0);
  const ticks = timeTicks(totalSeconds);
  const unit = sport === "cykling" ? "kJ" : "m";

  const balanceData =
    balance?.series.map((point) => ({
      t: point.t,
      percent: point.fraction * 100,
      balance: point.balance,
    })) ?? [];
  const showBalance = balance !== null && balanceData.length > 1;
  const blocks = profileBlocks(steps, reference, basis);
  const zones = ZONES.filter((zone) => blocks.some((b) => b.zone === zone));

  return (
    <div className="space-y-1">
      <WorkoutProfile
        steps={steps}
        reference={reference}
        basis={basis}
        sport={sport}
        // Panelerna delar tidsaxel. Står den skriven två gånger läser man
        // den som två olika axlar.
        showTimeAxis={!showBalance}
        legend={false}
      />

      {showBalance && (
        <div className="h-[170px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={balanceData} margin={MARGIN}>
              <defs>
                <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={SERIES.primary}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor={SERIES.primary}
                    stopOpacity={0.04}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={[0, totalSeconds]}
                ticks={ticks}
                tickFormatter={(value: number) => formatDuration(value)}
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
                width={PLOT_LEFT}
                tickFormatter={(v: number) => `${Math.round(v)} %`}
              />
              <Tooltip
                content={<BalanceTooltip unit={unit} />}
                cursor={{ stroke: CHART_AXIS_TEXT, strokeWidth: 1 }}
              />

              <Area
                type="monotone"
                dataKey="percent"
                stroke={SERIES.primary}
                strokeWidth={2}
                fill="url(#balance-fill)"
                isAnimationActive={false}
                activeDot={{
                  r: 4,
                  fill: SERIES.primary,
                  stroke: "var(--surface)",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="pt-2">
        <ZoneLegend zones={zones} />
      </div>

      <p className="pl-[52px] text-[11px] text-text-subtle">
        {showBalance ? "Överst" : "Höjden"}: målet som andel av {basis}, färgen
        zonen.
        {showBalance
          ? ` Nederst: ${sport === "cykling" ? "W′" : "D′"} som är kvar, i procent av full reserv.`
          : ""}
      </p>
    </div>
  );
}
