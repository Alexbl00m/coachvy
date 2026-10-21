import { describe, expect, it } from "vitest";

import { analyse, type Sample } from "./analysis";
import {
  loadReading,
  loadTrend,
  strainFromSeries,
  weeklyLoad,
  type LoadActivity,
} from "./load";

const pass = (
  date: string,
  hours: number,
  strain: number | null,
  sport = "cykling",
): LoadActivity => ({
  id: `${date}-${hours}-${strain}`,
  sport,
  performed_on: date,
  seconds: hours * 3600,
  kj: hours * 700,
  km: null,
  strain,
});

describe("strainFromSeries", () => {
  it("räknar arbetet över CP som andel av W′", () => {
    // 60 s på 400 W mot CP 300 och W′ 20 kJ: 6 kJ = 0,3 W′.
    const t = [0, 60, 120];
    expect(
      strainFromSeries(t, [400, 250, 250], 300, 20000, "power"),
    ).toBeCloseTo(0.3);
  });

  it("räknar löpningens fart om från km/h", () => {
    // 100 s på 18 km/h (5 m/s) mot CS 4 m/s och D′ 200 m: 100 m = 0,5 D′.
    expect(
      strainFromSeries([0, 100, 200], [18, 10, null], 4, 200, "speed"),
    ).toBeCloseTo(0.5);
  });

  it("ger null utan modell eller serie", () => {
    expect(strainFromSeries([0, 1], [300, 300], 0, 20000, "power")).toBeNull();
    expect(
      strainFromSeries([0, 1], [null, null], 300, 20000, "power"),
    ).toBeNull();
  });
});

describe("analysen räknar strain", () => {
  it("två minuter på 400 W mot CP 300 och W′ 20 kJ är 0,6 W′", () => {
    const samples: Sample[] = Array.from({ length: 241 }, (_, t) => ({
      t,
      lat: null,
      lon: null,
      alt: null,
      power: t < 120 ? 400 : 200,
      hr: 150,
      speed: 10,
      cadence: 90,
      distance: t * 10,
    }));
    const { summary } = analyse(samples, "cykling", {
      ftp: 285,
      ftpSource: null,
      cp: 300,
      wPrime: 20000,
      cs: null,
      dPrime: null,
      lthr: null,
      testedOn: null,
    });
    expect(summary.aboveCriticalWork).toBeCloseTo(12000, -2);
    expect(summary.strain).toBeCloseTo(0.6, 1);
  });
});

describe("weeklyLoad", () => {
  it("lägger passen i rätt vecka och räknar pass utan strain", () => {
    const weeks = weeklyLoad(
      [
        pass("2026-10-20", 2, 1.5),
        pass("2026-10-21", 1, null),
        pass("2026-10-14", 3, 0.5),
      ],
      "2026-10-21",
      2,
    );
    expect(weeks.map((w) => w.monday)).toEqual(["2026-10-12", "2026-10-19"]);
    expect(weeks[1].seconds).toBe(3 * 3600);
    expect(weeks[1].strain).toBeCloseTo(1.5);
    expect(weeks[1].withoutStrain).toBe(1);
    expect(weeks[0].sessions).toBe(1);
  });
});

describe("loadTrend och loadReading", () => {
  const today = "2026-10-21";
  // Fyra veckor före: 8 h och 2 W′ per vecka.
  const before = [7, 14, 21, 28].flatMap((d) => [
    pass(addDaysIso(today, -d - 1), 4, 1),
    pass(addDaysIso(today, -d - 3), 4, 1),
  ]);

  it("ser när intensiteten driver ökningen", () => {
    const trend = loadTrend(
      [...before, pass(today, 4, 2.5), pass(addDaysIso(today, -2), 4, 2.5)],
      today,
    );
    expect(trend.volumeRatio).toBeCloseTo(1);
    expect(trend.strainRatio).toBeCloseTo(2.5);
    const text = loadReading(trend).join(" ");
    expect(text).toContain("i nivå med snittveckan");
    expect(text).toContain("tätare intensitet");
  });

  it("ser när volymen driver ökningen", () => {
    const trend = loadTrend(
      [...before, pass(today, 6, 1), pass(addDaysIso(today, -2), 6, 1)],
      today,
    );
    expect(loadReading(trend).join(" ")).toContain("mer träning");
  });

  it("säger rakt ut när veckan saknar pass", () => {
    const text = loadReading(loadTrend(before, today)).join(" ");
    expect(text).toContain("Inga pass ur klockan senaste sju dagarna");
    expect(text).not.toContain("100 %");
  });

  it("säger inget utan pass", () => {
    expect(loadReading(loadTrend([], today))).toEqual([]);
  });
});

function addDaysIso(iso: string, days: number) {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
