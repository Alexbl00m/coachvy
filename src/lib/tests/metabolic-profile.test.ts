import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { metabolicCurve } from "./metabolic-curve";
import { metabolicProfile, profileVolRel } from "./metabolic-profile";
import type { Effort } from "./analysis";

const effort = (intensity: number, durationSeconds: number) =>
  ({ intensity, durationSeconds }) as Effort;

const value = (metrics: { key: string; value: number }[], key: string) =>
  metrics.find((m) => m.key === key)?.value ?? null;

describe("metabol profil med den kalibrerade modellen", () => {
  // Stark sprint mot tre längre insatser som stämmer med varandra.
  const efforts = [effort(995, 20), effort(465, 180), effort(421, 300), effort(368, 720)];
  const profile = metabolicProfile(efforts, 81.5, 12, "man");

  it("ger nyckeltalen och flaggar sprinten", () => {
    expect(value(profile.metrics, "CP")).toBeCloseTo(334, 0);
    expect(value(profile.metrics, "AT")).toBeGreaterThan(280);
    expect(value(profile.metrics, "AT")).toBeLessThan(296);
    expect(profile.warnings.some((w) => w.startsWith("Sprinten och de längre testerna"))).toBe(true);
  });

  it("ritar kurvan med samma tröskel som nyckeltalet", () => {
    const curve = metabolicCurve(profile.metrics, "W", 81.5, null, profileVolRel("metabol-profil", "man", 12))!;
    expect(curve.points).toHaveLength(100);
    expect(curve.band).toHaveLength(100);
    expect(Math.abs(curve.thresholds.anaerobicThreshold!.power - value(profile.metrics, "AT")!)).toBeLessThan(1);
    expect(curve.thresholds.fatMax!.fatPerHour).toBeGreaterThan(30);
  });

  it("räknar utan en sprint på tio sekunder", () => {
    const short = metabolicProfile([effort(641, 10), ...efforts.slice(1)], 81.5, 12, "man");
    expect(short.warnings.some((w) => w.startsWith("Sprinten är för kort"))).toBe(true);
    expect(value(short.metrics, "AT")).toBeGreaterThan(315);
  });

  it("räknar VLamax ur sprintlaktatet när det finns", () => {
    const sprint = { ...effort(995, 20), lactate: 8.8 } as Effort;
    const withLactate = metabolicProfile([sprint, ...efforts.slice(1)], 81.5, 12, "man");
    const vlamax = withLactate.metrics.find((m) => m.key === "VLamax")!;
    expect(vlamax.method).toContain("sprintlaktat");
    // (8,8 − 1,0) / (20 − 3,5) = 0,47 mot 0,69 ur watten, och då stämmer sprinten med CP
    expect(Math.abs(vlamax.value - 7.8 / 16.5)).toBeLessThan(0.02);
    expect(value(withLactate.metrics, "AT")).toBeGreaterThan(315);
    expect(withLactate.warnings.some((w) => w.startsWith("Sprinten och de längre testerna"))).toBe(false);
    // Ett orimligt laktat stoppar beräkningen i stället för att ge fel tal
    const wrong = metabolicProfile([{ ...sprint, lactate: 45 } as Effort, ...efforts.slice(1)], 81.5, 12, "man");
    expect(value(wrong.metrics, "AT")).toBeNull();
    expect(wrong.warnings.some((w) => w.startsWith("Orimligt sprintlaktat"))).toBe(true);
  });

  it("stoppar när tolv minuter är starkare än sex", () => {
    const wrong = metabolicProfile([effort(667, 20), effort(293, 180), effort(217, 360), effort(234, 720)], 84, 18, "man");
    expect(value(wrong.metrics, "AT")).toBeNull();
    expect(value(wrong.metrics, "CP")).not.toBeNull();
    expect(wrong.warnings.some((w) => w.startsWith("Effekten ökar med tiden"))).toBe(true);
  });

  it("lämnar andra protokoll till den äldre kurvan", () => {
    expect(profileVolRel("laktat-steg", "man", 12)).toBeNull();
  });
});
