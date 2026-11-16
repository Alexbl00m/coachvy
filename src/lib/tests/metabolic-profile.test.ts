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
