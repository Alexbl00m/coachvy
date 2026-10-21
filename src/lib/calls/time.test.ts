import { describe, expect, it } from "vitest";

import {
  callDate,
  callState,
  callWhen,
  cleanMeetingUrl,
  stockholmToIso,
} from "./time";

describe("stockholmToIso", () => {
  it("räknar om svensk sommartid och vintertid till UTC", () => {
    expect(stockholmToIso("2026-07-01", "18:00")).toBe(
      "2026-07-01T16:00:00.000Z",
    );
    expect(stockholmToIso("2026-12-01", "18:00")).toBe(
      "2026-12-01T17:00:00.000Z",
    );
  });

  it("klarar dagen när sommartiden slutar", () => {
    // 25 oktober 2026: klockan går från 03:00 till 02:00.
    expect(stockholmToIso("2026-10-25", "18:00")).toBe(
      "2026-10-25T17:00:00.000Z",
    );
  });

  it("ger null för det som inte går att läsa", () => {
    expect(stockholmToIso("2026-10-28", "25:00")).toBeNull();
    expect(stockholmToIso("28/10", "18:00")).toBeNull();
  });
});

describe("callWhen och callDate", () => {
  it("skriver tiden i Stockholm", () => {
    expect(callWhen("2026-10-28T17:00:00.000Z")).toBe(
      "onsdag 28 oktober kl. 18:00",
    );
    expect(callDate("2026-10-28T23:30:00.000Z")).toBe("2026-10-29");
  });
});

describe("callState", () => {
  const call = {
    starts_at: "2026-10-28T17:00:00.000Z",
    duration_minutes: 30,
    cancelled_at: null,
  };
  const at = (iso: string) => Date.parse(iso);

  it("följer samtalet från bokat till avslutat", () => {
    expect(callState(call, at("2026-10-28T16:00:00Z"))).toBe("kommande");
    expect(callState(call, at("2026-10-28T16:55:00Z"))).toBe("snart");
    expect(callState(call, at("2026-10-28T17:20:00Z"))).toBe("pågår");
    expect(callState(call, at("2026-10-28T17:40:00Z"))).toBe("pågår");
    expect(callState(call, at("2026-10-28T17:46:00Z"))).toBe("avslutat");
  });

  it("ett avbokat samtal är avbokat", () => {
    expect(
      callState(
        { ...call, cancelled_at: "2026-10-27T10:00:00Z" },
        at("2026-10-28T17:00:00Z"),
      ),
    ).toBe("avbokat");
  });
});

describe("cleanMeetingUrl", () => {
  it("tar bara https-länkar", () => {
    expect(cleanMeetingUrl(" https://meet.google.com/abc-defg-hij ")).toBe(
      "https://meet.google.com/abc-defg-hij",
    );
    expect(cleanMeetingUrl("http://zoom.us/j/1")).toBeNull();
    expect(cleanMeetingUrl("meet.google.com/abc")).toBeNull();
    expect(cleanMeetingUrl("")).toBeNull();
  });
});
