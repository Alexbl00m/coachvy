import { describe, expect, it } from "vitest";

import {
  closeGap,
  nextPhaseStart,
  phaseEnd,
  pullForward,
  queueOf,
  type QueuedPhase,
} from "./queue";

const p = (id: string, status: QueuedPhase["status"], start: string, weeks: number): QueuedPhase => ({
  id,
  status,
  start_date: start,
  weeks,
});

describe("faskön", () => {
  it("räknar slutet som dagen efter sista veckan", () => {
    expect(phaseEnd(p("a", "aktiv", "2026-11-02", 4))).toBe("2026-11-30");
  });

  it("lägger nästa fas direkt efter kön, och hoppar över avslutade", () => {
    const phases = [
      p("gammal", "avslutad", "2026-09-01", 8),
      p("a", "aktiv", "2026-11-02", 10),
      p("b", "kommande", "2027-01-11", 6),
    ];
    expect(queueOf(phases).map((x) => x.id)).toEqual(["a", "b"]);
    expect(nextPhaseStart(phases, null, "2026-11-10")).toEqual({ ok: true, start: "2027-02-22" });
  });

  it("använder det valda datumet när kön är tom", () => {
    expect(nextPhaseStart([], "2026-11-16", "2026-11-10")).toEqual({ ok: true, start: "2026-11-16" });
    expect(nextPhaseStart([], null, "2026-11-10").ok).toBe(false);
    expect(nextPhaseStart([], "2026-10-01", "2026-11-10").ok).toBe(false);
  });

  it("flyttar fram faserna efter en borttagen fas", () => {
    const phases = [
      p("a", "aktiv", "2026-11-02", 4),
      p("b", "kommande", "2026-11-30", 6),
      p("c", "kommande", "2027-01-11", 8),
      p("d", "kommande", "2027-03-08", 2),
    ];
    expect(closeGap(phases, "b")).toEqual([
      { id: "c", start_date: "2026-11-30" },
      { id: "d", start_date: "2027-01-25" },
    ]);
    expect(closeGap(phases, "d")).toEqual([]);
  });

  it("flyttar fram kön när den aktiva fasen avslutas, på samma veckodag", () => {
    const phases = [
      p("a", "aktiv", "2026-10-26", 24),
      p("b", "kommande", "2027-04-12", 6),
      p("c", "kommande", "2027-05-24", 2),
    ];
    // Onsdag: nästa måndag.
    expect(pullForward(phases, "a", "2026-10-28")).toEqual([
      { id: "b", start_date: "2026-11-02" },
      { id: "c", start_date: "2026-12-14" },
    ]);
    // Måndag: i dag.
    expect(pullForward(phases, "a", "2026-11-02")[0]).toEqual({
      id: "b",
      start_date: "2026-11-02",
    });
  });

  it("flyttar ingenting utan kö", () => {
    expect(pullForward([p("a", "aktiv", "2026-10-26", 8)], "a", "2026-10-28")).toEqual([]);
  });
});
