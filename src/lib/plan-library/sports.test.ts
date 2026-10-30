import { describe, expect, it } from "vitest";

import { categoriesForSport } from "./sports";

describe("grenens planer", () => {
  it("hittar kategorierna oavsett versaler", () => {
    expect(categoriesForSport("Cykling")).toEqual(["cykel"]);
    expect(categoriesForSport("Löpning")).toContain("halvmaraton");
  });

  it("ger triathleten alla tre grenarna", () => {
    const cats = categoriesForSport("Triathlon");
    expect(cats).toContain("70-3");
    expect(cats).toContain("cykel");
    expect(cats).toContain("lopning");
    expect(cats).toContain("simning");
  });

  it("ger null utan känd gren", () => {
    expect(categoriesForSport(null)).toBeNull();
    expect(categoriesForSport("  ")).toBeNull();
    expect(categoriesForSport("Skidor")).toBeNull();
  });
});
