import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const member = { value: true };
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => ({}) }));
vi.mock("@/lib/auth/membership", () => ({ isMember: () => member.value }));

import { cyclingProfile } from "./metabolic-actions";

const input = { vo2max: 62, vlamax: 0.5, weightKg: 75, bodyFatPct: 13, sex: "man" as const, maxHeartRate: 190 };

describe("kalkylens cykelprofil på servern", () => {
  beforeEach(() => {
    member.value = true;
  });

  it("ger kurvan med tröskel, FatMax och modellens puls", async () => {
    const curve = (await cyclingProfile(input))!;
    expect(curve.thresholds.anaerobicThreshold!.power).toBeGreaterThan(280);
    expect(curve.thresholds.anaerobicThreshold!.power).toBeLessThan(310);
    expect(curve.thresholds.fatMax!.heartRate).toBeGreaterThan(100);
    expect(curve.points.every((p) => p.heartRate !== null && p.heartRate <= 190)).toBe(true);
  });

  it("svarar inte den som saknar medlemskap", async () => {
    member.value = false;
    expect(await cyclingProfile(input)).toBeNull();
  });

  it("avvisar orimliga värden", async () => {
    expect(await cyclingProfile({ ...input, vo2max: 150 })).toBeNull();
    expect(await cyclingProfile({ ...input, bodyFatPct: 0 })).toBeNull();
  });
});
