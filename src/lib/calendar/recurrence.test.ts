import { describe, expect, it } from "vitest";

import { MAX_DATES, recurringDates } from "./recurrence";

describe("recurringDates", () => {
  it("ger varje onsdag i fyra veckor", () => {
    // 2026-10-21 är en onsdag.
    expect(
      recurringDates({ start: "2026-10-21", weekdays: [2], weeks: 4 }),
    ).toEqual(["2026-10-21", "2026-10-28", "2026-11-04", "2026-11-11"]);
  });

  it("hoppar över dagar före starten i första veckan", () => {
    // Torsdag 22 oktober: måndagen och onsdagen den veckan är redan förbi.
    expect(
      recurringDates({ start: "2026-10-22", weekdays: [0, 2], weeks: 2 }),
    ).toEqual(["2026-10-26", "2026-10-28"]);
  });

  it("sorterar flera veckodagar och tar bort dubbletter", () => {
    expect(
      recurringDates({ start: "2026-10-19", weekdays: [3, 1, 1], weeks: 1 }),
    ).toEqual(["2026-10-20", "2026-10-22"]);
  });

  it("går över årsskiftet", () => {
    expect(
      recurringDates({ start: "2026-12-30", weekdays: [2], weeks: 2 }),
    ).toEqual(["2026-12-30", "2027-01-06"]);
  });

  it("stannar vid taket", () => {
    expect(
      recurringDates({
        start: "2026-01-05",
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        weeks: 20,
      }),
    ).toHaveLength(MAX_DATES);
  });

  it("ger inget för ett ogiltigt datum eller noll veckor", () => {
    expect(recurringDates({ start: "", weekdays: [2], weeks: 4 })).toEqual([]);
    expect(
      recurringDates({ start: "2026-10-21", weekdays: [2], weeks: 0 }),
    ).toEqual([]);
  });
});
