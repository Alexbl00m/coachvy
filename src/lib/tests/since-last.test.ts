import { describe, expect, it } from "vitest";

import { metric } from "./analysis";
import { compareProfiles } from "./since-last";

describe("jämförelse med förra testet", () => {
  const now = [
    metric("AT", "Anaerob tröskel", 295, "W", { spread: 9 }),
    metric("VLamax", "VLamax", 0.5, "mmol/l/s", { spread: 0.03 }),
    metric("CP", "Critical power", 301, "W"),
  ];
  const previous = [
    metric("AT", "Anaerob tröskel", 278, "W", { spread: 9 }),
    metric("VLamax", "VLamax", 0.53, "mmol/l/s", { spread: 0.03 }),
  ];
  const rows = compareProfiles(now, previous);

  it("räknar en skillnad större än mätfelet som en ändring", () => {
    const at = rows.find((r) => r.key === "AT")!;
    expect(at.delta).toBe(17);
    expect(at.changed).toBe(true);
  });

  it("kallar en skillnad inom mätfelet oförändrad", () => {
    expect(rows.find((r) => r.key === "VLamax")!.changed).toBe(false);
  });

  it("tar bara med nyckeltal som finns i båda testen", () => {
    expect(rows.map((r) => r.key)).toEqual(["AT", "VLamax"]);
  });

  it("lämnar bedömningen öppen när mätfelet saknas", () => {
    const bare = compareProfiles([metric("AT", "AT", 300, "W")], [metric("AT", "AT", 280, "W")]);
    expect(bare[0].changed).toBeNull();
  });
});
