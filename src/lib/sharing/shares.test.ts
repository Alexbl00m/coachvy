import { describe, expect, it } from "vitest";

import {
  authorLabel,
  choiceError,
  choiceOf,
  planShares,
  PRIVATE,
  shareSummary,
  type Share,
} from "./shares";

const share = (over: Partial<Share>): Share => ({
  id: over.id ?? `s-${Math.random()}`,
  audience: "adepter",
  status: "aktiv",
  reviewNote: null,
  adeptId: null,
  adeptName: null,
  coachId: null,
  coachName: null,
  ...over,
});

describe("choiceOf", () => {
  it("är privat utan rader", () => {
    expect(choiceOf([])).toEqual(PRIVATE);
  });

  it("läser alla adepter, medlemmar och utvalda coacher", () => {
    const choice = choiceOf([
      share({ audience: "adepter" }),
      share({ audience: "medlemmar", status: "granskas" }),
      share({ audience: "coach", coachId: "c1" }),
      share({ audience: "coach", coachId: "c2" }),
    ]);
    expect(choice).toEqual({
      adepts: "alla",
      adeptIds: [],
      members: true,
      coaches: "utvalda",
      coachIds: ["c1", "c2"],
    });
  });
});

describe("planShares", () => {
  it("lägger till det som saknas och tar bort det som inte längre ska finnas", () => {
    const current = [
      share({ id: "a", audience: "adepter" }),
      share({ id: "m", audience: "medlemmar", status: "aktiv" }),
    ];
    const plan = planShares(current, {
      ...PRIVATE,
      adepts: "utvalda",
      adeptIds: ["x", "y"],
      members: true,
    });
    expect(plan.remove).toEqual(["a"]);
    expect(plan.add).toEqual([
      { audience: "adept", adeptId: "x" },
      { audience: "adept", adeptId: "y" },
    ]);
  });

  it("rör inte en godkänd medlemsdelning som står kvar", () => {
    const current = [
      share({ id: "m", audience: "medlemmar", status: "aktiv" }),
    ];
    const plan = planShares(current, { ...PRIVATE, members: true });
    expect(plan).toEqual({ add: [], remove: [] });
  });

  it("tar bort allt när valet blir privat", () => {
    const current = [
      share({ id: "a", audience: "adept", adeptId: "x" }),
      share({ id: "c", audience: "coacher" }),
    ];
    expect(planShares(current, PRIVATE).remove.sort()).toEqual(["a", "c"]);
  });

  it("lägger inte till samma adept två gånger", () => {
    const plan = planShares([], {
      ...PRIVATE,
      adepts: "utvalda",
      adeptIds: ["x", "x"],
    });
    expect(plan.add).toHaveLength(1);
  });
});

describe("choiceError", () => {
  it("kräver minst en vald när det gäller utvalda", () => {
    expect(choiceError({ ...PRIVATE, adepts: "utvalda" })).toMatch(/adept/);
    expect(choiceError({ ...PRIVATE, coaches: "utvalda" })).toMatch(/coach/);
    expect(choiceError({ ...PRIVATE, adepts: "alla" })).toBeNull();
  });
});

describe("shareSummary", () => {
  it("säger bara du när inget är delat", () => {
    expect(shareSummary([])).toBe("Bara du");
  });

  it("räknar upp mottagarna med granskningen", () => {
    expect(
      shareSummary([
        share({ audience: "adepter" }),
        share({ audience: "medlemmar", status: "granskas" }),
        share({ audience: "coach", coachId: "c1", coachName: "Dora" }),
      ]),
    ).toBe("Dina adepter · Alla medlemmar (granskas) · Dora");
  });

  it("kortar en lång lista med utvalda", () => {
    expect(
      shareSummary(
        ["Anna", "Bert", "Cilla", "David"].map((n, i) =>
          share({ audience: "adept", adeptId: `a${i}`, adeptName: n }),
        ),
      ),
    ).toBe("Anna, Bert och 2 till");
  });
});

describe("authorLabel", () => {
  const viewer = { id: "me", coachId: "coach" };
  it("visar inget för det egna", () => {
    expect(
      authorLabel(
        { id: "me", name: "Jag", company: null, coachvy: false },
        viewer,
      ),
    ).toBeNull();
  });
  it("säger från din coach före Coachvy", () => {
    expect(
      authorLabel(
        { id: "coach", name: "A", company: null, coachvy: true },
        viewer,
      ),
    ).toBe("Från din coach");
  });
  it("visar Coachvy för admin och annars coachens namn", () => {
    expect(
      authorLabel(
        { id: "admin", name: "A", company: null, coachvy: true },
        viewer,
      ),
    ).toBe("Coachvy");
    expect(
      authorLabel(
        { id: "x", name: null, company: "Klubben", coachvy: false },
        viewer,
      ),
    ).toBe("Klubben");
  });
});
