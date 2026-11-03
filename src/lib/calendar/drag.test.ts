import { describe, expect, it } from "vitest";

import { dragOf, parseDrag } from "./drag";

describe("pass som dras i kalendern", () => {
  it("drar ett eget pass med sitt id", () => {
    expect(
      dragOf({ id: "w1", adeptId: "a", title: "Tröskel", fromPlan: false }),
    ).toEqual({
      kind: "pass",
      id: "w1",
      adeptId: "a",
      title: "Tröskel",
    });
  });

  it("drar ett planpass med planen, passet och veckan", () => {
    expect(
      dragOf({
        id: "plan-x",
        adeptId: "a",
        title: "Långpass",
        fromPlan: true,
        planRef: { instanceId: "i", sessionId: "s", week: 3 },
      }),
    ).toEqual({
      kind: "planpass",
      instanceId: "i",
      sessionId: "s",
      week: 3,
      adeptId: "a",
      title: "Långpass",
    });
  });

  it("drar inte ett planpass utan koppling till planen", () => {
    expect(
      dragOf({ id: "plan-x", adeptId: "a", title: "x", fromPlan: true }),
    ).toBeNull();
  });

  it("läser bara Coachvys pass ur datan", () => {
    const pass = dragOf({ id: "w1", adeptId: "a", title: "Tröskel" })!;
    expect(parseDrag(JSON.stringify(pass))).toEqual(pass);
    expect(parseDrag("https://example.com")).toBeNull();
    expect(parseDrag(JSON.stringify({ kind: "annat" }))).toBeNull();
  });
});
