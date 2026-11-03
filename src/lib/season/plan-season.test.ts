import { describe, expect, it } from "vitest";

import type { TrainingBlockRow } from "@/lib/types/database";

import { clipToRanges, planBlocks, seasonBlocks, type PlanForSeason } from "./plan-season";

const block = (id: string, phase: TrainingBlockRow["phase"], start: string, end: string): TrainingBlockRow => ({
  id,
  adept_id: "kim",
  phase,
  name: null,
  starts_on: start,
  ends_on: end,
  focus: null,
  created_by: null,
  created_at: "",
  updated_at: "",
});

// Halvmaraton i tratten: fyra faser från 26 oktober, 24 veckor.
const plan: PlanForSeason = {
  id: "p1",
  adept_id: "kim",
  title: "Halvmaraton i tratten",
  track: "löpning",
  start_date: "2026-10-26",
  weeks: 24,
  spans: [
    { name: "Generell", seasonPhase: "grund", fromWeek: 1, startsOn: "2026-10-26", endsOn: "2026-12-27" },
    { name: "Stödjande", seasonPhase: "uppbyggnad", fromWeek: 10, startsOn: "2026-12-28", endsOn: "2027-02-07" },
    { name: "Specifik", seasonPhase: "specifik", fromWeek: 16, startsOn: "2027-02-08", endsOn: "2027-03-28" },
    { name: "Taper", seasonPhase: "topp", fromWeek: 23, startsOn: "2027-03-29", endsOn: "2027-04-11" },
  ],
};

describe("säsongen ur planen", () => {
  it("gör planens faser till perioder", () => {
    const blocks = planBlocks(plan);
    expect(blocks.map((b) => [b.phase, b.name, b.starts_on, b.ends_on])).toEqual([
      ["grund", "Generell", "2026-10-26", "2026-12-27"],
      ["uppbyggnad", "Stödjande", "2026-12-28", "2027-02-07"],
      ["specifik", "Specifik", "2027-02-08", "2027-03-28"],
      ["topp", "Taper", "2027-03-29", "2027-04-11"],
    ]);
    expect(blocks[0].plan).toEqual({ instanceId: "p1", title: "Halvmaraton i tratten" });
  });

  it("hoppar över faser utan säsongsfas", () => {
    const blocks = planBlocks({
      ...plan,
      spans: [{ ...plan.spans[0], seasonPhase: null }, plan.spans[1]],
    });
    expect(blocks.map((b) => b.phase)).toEqual(["uppbyggnad"]);
  });

  it("kortar, delar och tar bort perioder som planen täcker", () => {
    const range = [{ start: "2026-10-26", end: "2027-04-11" }];
    expect(clipToRanges(block("a", "grund", "2026-09-01", "2026-11-30"), range)).toEqual([
      block("a", "grund", "2026-09-01", "2026-10-25"),
    ]);
    expect(clipToRanges(block("b", "grund", "2026-11-01", "2026-12-01"), range)).toEqual([]);
    expect(
      clipToRanges(block("c", "vila", "2026-10-01", "2027-05-01"), range).map((b) => [
        b.id,
        b.starts_on,
        b.ends_on,
      ]),
    ).toEqual([
      ["c", "2026-10-01", "2026-10-25"],
      ["c-2", "2027-04-12", "2027-05-01"],
    ]);
  });

  it("låter planen gälla och perioderna för hand fylla resten", () => {
    const manual = [
      block("g", "grund", "2026-10-26", "2026-12-27"),
      block("t", "topp", "2027-03-22", "2027-04-04"),
      block("v", "vila", "2027-04-12", "2027-04-25"),
    ];
    const merged = seasonBlocks(manual, [plan]);
    expect(merged.map((b) => [b.phase, b.starts_on, b.plan ? "plan" : "hand"])).toEqual([
      ["grund", "2026-10-26", "plan"],
      ["uppbyggnad", "2026-12-28", "plan"],
      ["specifik", "2027-02-08", "plan"],
      ["topp", "2027-03-29", "plan"],
      ["vila", "2027-04-12", "hand"],
    ]);
  });

  it("lämnar perioderna orörda utan plan", () => {
    const manual = [block("g", "grund", "2026-10-26", "2026-12-27")];
    expect(seasonBlocks(manual, [])).toEqual(manual);
  });

  it("låter den första planen sätta fasen när två planer går samtidigt", () => {
    // En cykelplan som börjar två veckor senare och slutar efter löpplanen.
    const bike: PlanForSeason = {
      id: "p2",
      adept_id: "kim",
      title: "Boosta VO2max",
      track: "cykling",
      start_date: "2026-11-09",
      weeks: 26,
      spans: [
        { name: "Grund", seasonPhase: "grund", fromWeek: 1, startsOn: "2026-11-09", endsOn: "2027-01-03" },
        { name: "VO2max", seasonPhase: "uppbyggnad", fromWeek: 9, startsOn: "2027-01-04", endsOn: "2027-05-09" },
      ],
    };
    const merged = seasonBlocks([], [bike, plan]);
    const days = (b: { starts_on: string; ends_on: string }) => [b.starts_on, b.ends_on];
    // Löpplanen började först och sätter fasen hela sin tid; cykelplanen fyller resten.
    expect(merged.map((b) => [b.plan?.title, ...days(b)])).toEqual([
      ["Halvmaraton i tratten", "2026-10-26", "2026-12-27"],
      ["Halvmaraton i tratten", "2026-12-28", "2027-02-07"],
      ["Halvmaraton i tratten", "2027-02-08", "2027-03-28"],
      ["Halvmaraton i tratten", "2027-03-29", "2027-04-11"],
      ["Boosta VO2max", "2027-04-12", "2027-05-09"],
    ]);
  });
});
