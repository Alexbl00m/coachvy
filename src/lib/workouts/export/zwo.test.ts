import { describe, expect, it } from "vitest";

import { CYCLING_ATLAS } from "@/lib/session-library/atlas/cycling";
import { atlasRows } from "@/lib/session-library/atlas/seed";
import { libraryWorkout } from "@/lib/session-library/library";

import { workoutToZwo } from "./zwo";

const [pass] = atlasRows(CYCLING_ATLAS).filter((r) => r.levels.length > 0);
const session = { ...pass, id: "x" };

describe(".zwo ur biblioteket", () => {
  it("tar med passets förklaring i beskrivningen", () => {
    const workout = libraryWorkout(session, "C")!;
    const zwo = workoutToZwo(workout, null)!;
    expect(zwo).toContain("Därför det här passet");
    expect(zwo).toContain("Syfte");
    expect(zwo).toContain("Så byggs det på");
    // Utan adept står procenten mot appens FTP, inte mot några watt.
    expect(zwo).toMatch(/räknas mot din FTP i appen|Sätt FTP i appen till din/);
    expect(zwo).not.toMatch(/\d+ W\./);
  });

  it("skriver nivåns struktur, och watten när en referens finns", () => {
    const c = libraryWorkout(session, "C")!;
    const a = libraryWorkout(session, "A")!;
    expect(c.blocks).toEqual(pass.levels.find((l) => l.key === "C")!.blocks);
    expect(workoutToZwo(a, null)).not.toEqual(workoutToZwo(c, null));
    expect(workoutToZwo(c, 280)).toContain("Sätt FTP i appen till 280 W");
  });

  it("skriver inga filer för löp- eller simpass", () => {
    const run = libraryWorkout({ ...session, sport: "löpning", basis: "MP" });
    expect(run && workoutToZwo(run, null)).toBeNull();
  });
});
