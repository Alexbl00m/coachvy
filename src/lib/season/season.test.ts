import { describe, expect, it } from "vitest";

import {
  blockText,
  isoWeek,
  lengthText,
  monthDates,
  planNotes,
  seasonToPrompt,
  shiftMonth,
  weekdayIndex,
  weekSpan,
} from "./season";

describe("kalendern", () => {
  it("räknar veckor som i en svensk kalender, måndag först", () => {
    expect(weekdayIndex("2026-10-12")).toBe(0); // måndag
    expect(weekdayIndex("2026-10-18")).toBe(6); // söndag
    expect(isoWeek("2026-10-12")).toBe(42);
    // Vecka 53 finns 2026; 1 januari 2027 är en fredag i den.
    expect(isoWeek("2027-01-01")).toBe(53);
    expect(isoWeek("2027-01-04")).toBe(1);
  });

  it("visar hela veckor från måndag till söndag", () => {
    const dates = monthDates("2026-10");
    expect(dates[0]).toBe("2026-09-28");
    expect(dates.at(-1)).toBe("2026-11-01");
    expect(dates.length % 7).toBe(0);
    expect(dates.every((d, i) => weekdayIndex(d) === i % 7)).toBe(true);
  });

  it("flyttar månader över årsskiftet", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(shiftMonth("2026-10", 12)).toBe("2027-10");
  });
});

describe("periodens längd", () => {
  it("skrivs i veckor, och i dagar under en vecka", () => {
    expect(lengthText(56)).toBe("8 veckor");
    expect(lengthText(7)).toBe("1 vecka");
    expect(lengthText(10)).toBe("1 vecka och 3 dagar");
    expect(lengthText(15)).toBe("2 veckor och 1 dag");
    expect(lengthText(5)).toBe("5 dagar");
  });

  it("visar veckonumren", () => {
    expect(weekSpan("2026-10-12", "2026-12-06")).toBe("v. 42–49");
    expect(weekSpan("2026-10-12", "2026-10-18")).toBe("v. 42");
    expect(weekSpan("2026-12-21", "2027-01-17")).toBe("v. 52–2");
  });
});

describe("periodens namn", () => {
  const vinter = {
    id: "1",
    phase: "grund" as const,
    name: "Vinterbas",
    starts_on: "2026-10-12",
    ends_on: "2026-12-06",
    focus: null,
  };
  const bygg = {
    id: "2",
    phase: "uppbyggnad" as const,
    name: null,
    starts_on: "2026-12-14",
    ends_on: "2027-01-24",
    focus: null,
  };

  it("används i löptext, annars fasen", () => {
    expect(blockText(vinter)).toBe("Vinterbas");
    expect(blockText(bygg)).toBe("uppbyggnad");
    expect(blockText({ phase: "topp", name: "  " })).toBe("toppning");
  });

  it("står i anmärkningarna och i AI-underlaget", () => {
    const notes = planNotes([vinter, bygg], [], "2026-10-13");
    expect(notes[0]).toContain("mellan Vinterbas och uppbyggnad");

    const prompt = seasonToPrompt([], [vinter, bygg], "2026-10-13");
    expect(prompt).toContain(
      "Nu: Vinterbas (grundperiod) 2026-10-12–2026-12-06",
    );
    expect(prompt).toContain("Därefter: uppbyggnad från 2026-12-14");
  });
});
