import { describe, expect, it } from "vitest";

import { summarizeVolume, volumeFor, volumeText } from "./volume";

describe("veckovolym", () => {
  const volumes = [
    { weekId: "w1", levelId: "A", min: 70, max: 80 },
    { weekId: "w1", levelId: "B", min: 55, max: null },
  ];

  it("hittar veckans volym på nivån", () => {
    expect(volumeFor(volumes, "w1", "A")).toEqual({ min: 70, max: 80 });
    expect(volumeFor(volumes, "w1", "C")).toBeNull();
  });

  it("skriver volymen som tal eller spann", () => {
    expect(volumeText({ min: 70, max: 80 }, "km")).toBe("70–80 km");
    expect(volumeText({ min: 55, max: null }, "km")).toBe("55 km");
    expect(volumeText({ min: 7.5, max: 7.5 }, "h")).toBe("7,5 h");
  });

  it("räknar vad som är kvar att fylla med lugn löpning", () => {
    const s = summarizeVolume({
      target: { min: 70, max: 80 },
      unit: "km",
      sessions: [
        { metres: 14000, seconds: 3600 },
        { metres: 28000, seconds: 9000 },
        { metres: null, seconds: 1800 },
      ],
    });
    expect(s.planned).toBe(42);
    expect(s.unknown).toBe(1);
    expect(s.fill).toEqual({ min: 28, max: 38 });
  });

  it("räknar i timmar, och säger när passen räcker", () => {
    const s = summarizeVolume({
      target: { min: 2, max: null },
      unit: "h",
      sessions: [{ metres: null, seconds: 9000 }],
    });
    expect(s.planned).toBe(2.5);
    expect(s.fill).toBeNull();
  });
});
