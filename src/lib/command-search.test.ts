import { describe, expect, it } from "vitest";

import { searchCommands, type Command } from "./command-search";

const commands: Command[] = [
  { id: "p1", group: "Sidor", label: "Översikt", href: "/app/oversikt" },
  { id: "p2", group: "Sidor", label: "Kalender", href: "/app/kalender" },
  {
    id: "p3",
    group: "Sidor",
    label: "Passbibliotek",
    href: "/app/passbibliotek",
  },
  { id: "a1", group: "Adepter", label: "Tobias Schander", href: "/a/t" },
  { id: "a2", group: "Adepter", label: "Astrid Berg", href: "/a/a" },
  {
    id: "a1-maende",
    group: "Adepter",
    label: "Mående",
    hint: "Tobias Schander",
    href: "/a/t/maende",
    deep: true,
  },
  {
    id: "a1-tester",
    group: "Adepter",
    label: "Tester",
    hint: "Tobias Schander",
    href: "/a/t/tester",
    keywords: ["progression"],
    deep: true,
  },
];

const ids = (query: string) => searchCommands(commands, query).map((c) => c.id);

describe("searchCommands", () => {
  it("visar allt utom adepternas flikar utan sökning", () => {
    expect(ids("")).toEqual(["p1", "p2", "p3", "a1", "a2"]);
  });

  it("matchar utan hänsyn till accenter och versaler", () => {
    expect(ids("OVERSIKT")).toEqual(["p1"]);
    expect(ids("tobias maende")).toEqual(["a1-maende"]);
  });

  it("visar en adepts flikar först när sökningen har flera ord", () => {
    expect(ids("tobias")).toEqual(["a1"]);
    expect(ids("tobias tester")).toEqual(["a1-tester"]);
  });

  it("visar adepternas flikar för ett ensamt ord när inget annat passar", () => {
    expect(ids("maende")).toEqual(["a1-maende"]);
  });

  it("hittar en flik på sina sökord", () => {
    expect(ids("tobias progression")).toEqual(["a1-tester"]);
  });

  it("sätter träffar i början av etiketten först", () => {
    expect(ids("pass")[0]).toBe("p3");
    expect(ids("berg")).toEqual(["a2"]);
  });

  it("ger inget när ett ord saknas", () => {
    expect(ids("kalender xyz")).toEqual([]);
  });
});
