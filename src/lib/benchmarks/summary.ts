/**
 * Gap-analysen och effektprofilen som text, för AI-coachens underlag. Samma
 * tal och samma meningar som coachen ser under Progression → Mål och
 * referens.
 *
 * Modulen är ren.
 */

import {
  cogganCategory,
  DURATION_LABEL,
  readPowerProfile,
  type Sex,
} from "./coggan";
import type { Goals } from "./goals";
import { profileCaveats, THIN_SUPPORT, type ProfileRow } from "./power-profile";

const sv = (v: number, digits = 0) =>
  v.toFixed(digits).replace(".", ",").replace("-", "−");

export function benchmarkSummary(input: {
  goals: Goals;
  levelsAreDefault: boolean;
  power: {
    rows: ProfileRow[];
    sex: Sex;
    sexKnown: boolean;
    weightKg: number;
    period: string;
  } | null;
}): string | null {
  const { goals, power } = input;
  const lines: string[] = [];

  if (goals.target) {
    lines.push(
      `Målnivå: ${goals.target.name} (${input.levelsAreDefault ? "Coachvys utgångsnivåer" : "coachens egna nivåer"}, ${goals.sex === "man" ? "män" : "kvinnor"}).`,
    );
    if (goals.gaps.length > 0) {
      lines.push(
        `Avstånd per mått: ${goals.gaps
          .map(
            (g) =>
              `${g.label} ${sv(g.value, g.digits)} mot ${sv(g.target, g.digits)} ${g.unit} (${g.gapPct >= 0 ? "+" : ""}${sv(g.gapPct)} %)`,
          )
          .join("; ")}.`,
      );
      lines.push(...goals.reading);
    }
  }

  if (power && power.rows.length > 0) {
    lines.push(
      `Effektprofil mot Allen & Coggans tabell (${power.period} ur träningen, ${power.sex === "man" ? "män" : "kvinnor"}${power.sexKnown ? "" : " – kön saknas"}, ${sv(power.weightKg, 1)} kg): ${power.rows
        .map((r) => {
          const c = cogganCategory(r.position);
          return `${DURATION_LABEL[r.duration]} ${sv(r.wattsPerKg, 2)} W/kg (${c.name.toLowerCase()}${c.outside ? `, ${c.outside} tabellen` : ""}${r.duration === "ft" ? `, ${r.source}` : ""}${r.support < THIN_SUPPORT ? ", tunt underlag" : ""})`;
        })
        .join("; ")}.`,
    );
    const caveats = profileCaveats(power.rows);
    lines.push(...caveats.lines);
    if (caveats.readable) lines.push(...readPowerProfile(power.rows));
  }

  if (goals.races.length > 0) {
    lines.push("Tävlingsmål:");
    for (const line of goals.races) {
      lines.push(
        `- ${line.race.name} (${line.race.priority}-lopp, ${line.race.race_date}${line.weeks > 0 ? `, ${line.weeks} veckor kvar` : ""}) ${[line.race.distance, line.race.target].filter(Boolean).join(", ")}: ${line.reading}`,
      );
    }
  }

  return lines.length > 0
    ? [
        "Mot referens och mål (samma som under Progression → Mål och referens):",
        ...lines,
      ].join("\n")
    : null;
}
