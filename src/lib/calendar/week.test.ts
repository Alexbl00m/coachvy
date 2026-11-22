import { describe, expect, it } from "vitest";

import { parseDrag } from "./drag";
import { shiftToWeek, weekChoices, weekLabel, weekStart } from "./week";

describe("en vecka i kalendern", () => {
  it("hittar veckans måndag", () => {
    expect(weekStart("2026-11-22")).toBe("2026-11-16");
    expect(weekStart("2026-11-16")).toBe("2026-11-16");
    expect(weekStart("22 nov")).toBeNull();
  });

  it("lägger passen på samma veckodag i den nya veckan", () => {
    // Astrids testvecka (v. 47) till veckan efter lägret (v. 50).
    expect(shiftToWeek("2026-11-17", "2026-11-16", "2026-12-07")).toBe(
      "2026-12-08",
    );
    expect(shiftToWeek("2026-11-22", "2026-11-16", "2026-12-07")).toBe(
      "2026-12-13",
    );
    // Bakåt, och med en dag i veckan i stället för måndagen.
    expect(shiftToWeek("2026-11-20", "2026-11-18", "2026-11-11")).toBe(
      "2026-11-13",
    );
  });

  it("skriver veckan med datum, och året när det är ett annat", () => {
    expect(weekLabel("2026-12-07", "2026")).toBe("v. 50 · 7–13 dec");
    expect(weekLabel("2026-11-30", "2026")).toBe("v. 49 · 30 nov–6 dec");
    expect(weekLabel("2027-01-04", "2026")).toBe("v. 1 · 4–10 jan 2027");
    expect(weekLabel("2026-12-28", "2026")).toBe("v. 53 · 28 dec–3 jan 2027");
  });

  it("listar veckorna runt veckan, utan veckan själv", () => {
    const choices = weekChoices("2026-11-18", 2, 3);
    expect(choices.map((c) => c.monday)).toEqual([
      "2026-11-02",
      "2026-11-09",
      "2026-11-23",
      "2026-11-30",
      "2026-12-07",
    ]);
    expect(choices[4].label).toBe("v. 50 · 7–13 dec");
  });

  it("tar emot en vecka som dras, men inte en trasig", () => {
    const week = {
      kind: "vecka",
      adeptId: "a",
      monday: "2026-11-16",
      title: "Vecka 47",
    };
    expect(parseDrag(JSON.stringify(week))).toEqual(week);
    expect(parseDrag(JSON.stringify({ ...week, monday: "16 nov" }))).toBeNull();
    expect(
      parseDrag(JSON.stringify({ kind: "vecka", monday: "2026-11-16" })),
    ).toBeNull();
  });
});
