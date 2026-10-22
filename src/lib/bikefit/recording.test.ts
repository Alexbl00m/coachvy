import { describe, expect, it } from "vitest";

import { recordingCheck } from "./recording";

describe("recordingCheck", () => {
  it("godkänner en vanlig mobilvideo", () => {
    const c = recordingCheck({
      durationS: 20,
      fps: 60,
      width: 1080,
      height: 1920,
    });
    expect(c.ok).toBe(true);
    expect(c.sentence).toBe(
      "20,0 s, 60 bilder/s, 1080×1920 – går att analysera.",
    );
  });

  it("säger till om 30 bilder/s men analyserar ändå", () => {
    const c = recordingCheck({
      durationS: 15,
      fps: 29.97,
      width: 1920,
      height: 1080,
    });
    expect(c.ok).toBe(true);
    expect(c.sentence).toContain("60 bilder/s ger ett säkrare nedre dödläge");
  });

  it("stoppar ett för kort klipp och säger varför", () => {
    const c = recordingCheck({
      durationS: 6,
      fps: 60,
      width: 1080,
      height: 1920,
    });
    expect(c.ok).toBe(false);
    expect(c.sentence).toContain("för kort");
  });
});
