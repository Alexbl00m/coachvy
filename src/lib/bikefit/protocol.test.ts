import { describe, expect, it } from "vitest";

import {
  cleanBody,
  cleanFindings,
  cleanIntake,
  cleanScreening,
  legsFromBody,
  saddleFollowUp,
  sideDifference,
} from "./protocol";
import { DISCIPLINES, MEASURE_GROUPS, TEMPLATES } from "./templates";

describe("legsFromBody", () => {
  const body = { thigh_l: 481, thigh_r: 488, shank_l: 433, shank_r: 437 };

  it("tar den filmade sidan när den är mätt", () => {
    expect(legsFromBody(body, "right")).toEqual({ thighMm: 488, shankMm: 437 });
    expect(legsFromBody(body, "left")).toEqual({ thighMm: 481, shankMm: 433 });
  });

  it("tar medelvärdet utan känd sida, och den sida som finns", () => {
    expect(legsFromBody(body)).toEqual({ thighMm: 485, shankMm: 435 });
    expect(legsFromBody({ thigh_r: 470, shank_r: 450 }, "left")).toEqual({
      thighMm: 470,
      shankMm: 450,
    });
  });

  it("säger null när lår eller underben saknas", () => {
    expect(legsFromBody({ thigh_l: 480 })).toBeNull();
  });

  it("räknar skillnaden vänster minus höger", () => {
    expect(sideDifference(body, "thigh")).toBe(-7);
    expect(sideDifference({ thigh_l: 480 }, "thigh")).toBeNull();
  });
});

describe("tvätten", () => {
  it("släpper bara kända kroppsmått och stoppar orimliga värden", () => {
    const ok = cleanBody({
      height: 181,
      weight: 75.25,
      thigh_l: 480,
      okänt: 3,
    });
    expect(ok).toEqual({
      ok: true,
      body: { height: 181, weight: 75.3, thigh_l: 480 },
    });
    const bad = cleanBody({ height: 18.1 });
    expect(bad.ok).toBe(false);
  });

  it("håller funktionstesternas fält till testets form", () => {
    expect(
      cleanScreening({
        thomas: { l: 110, r: 100, value: 5, note: " plant " },
        plank: { l: 1, value: 125 },
        okänt: { value: 1 },
        shoulder_mobility: { value: 3, note: "Stram" },
      }),
    ).toEqual({
      thomas: { l: 110, r: 100, note: "plant" },
      plank: { value: 125 },
      shoulder_mobility: { note: "Stram" },
    });
  });

  it("tar bara samtalets och områdenas fält", () => {
    expect(cleanIntake({ goals: " Vichy ", annat: "x" })).toEqual({
      goals: "Vichy",
    });
    expect(cleanFindings({ saddle: "Höjd +10", x: "y" })).toEqual({
      saddle: "Höjd +10",
    });
  });
});

describe("mallarnas mått", () => {
  it("har unika nycklar och en känd grupp i varje gren", () => {
    for (const d of DISCIPLINES) {
      const keys = TEMPLATES[d].measures.map((m) => m.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const m of TEMPLATES[d].measures)
        expect(MEASURE_GROUPS[m.group]).toBeDefined();
    }
  });

  it("behåller nycklarna som redan sparade fits använder", () => {
    for (const d of DISCIPLINES) {
      const keys = TEMPLATES[d].measures.map((m) => m.key);
      for (const k of [
        "saddle_height",
        "saddle_setback",
        "saddle_tilt",
        "crank_length",
        "cleats",
      ])
        expect(keys).toContain(k);
    }
    const tt = TEMPLATES.tempo.measures.map((m) => m.key);
    for (const k of ["pad_stack", "pad_reach", "pad_width", "extension"])
      expect(tt).toContain(k);
  });
});

describe("saddleFollowUp", () => {
  it("jämför flytten med förslaget när vinklarna mättes före", () => {
    expect(
      saddleFollowUp({
        anglesAt: "före",
        suggestedMm: 24,
        before: 735,
        after: 758,
      }),
    ).toBe(
      "Vinklarna mättes före ändringarna. Sadeln höjdes sedan 23 mm av föreslagna 24 mm – filma igen för att se var knät hamnade.",
    );
    expect(
      saddleFollowUp({
        anglesAt: "före",
        suggestedMm: 10,
        before: 740,
        after: 735,
      }),
    ).toContain("sänktes sedan 5 mm, åt andra hållet än förslaget");
  });

  it("säger inget när vinklarna mättes efter, eller inget fanns att flytta", () => {
    expect(
      saddleFollowUp({
        anglesAt: "efter",
        suggestedMm: 24,
        before: 735,
        after: 758,
      }),
    ).toBeNull();
    expect(
      saddleFollowUp({
        anglesAt: "före",
        suggestedMm: null,
        before: 735,
        after: 735,
      }),
    ).toBeNull();
  });
});
