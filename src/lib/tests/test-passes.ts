/**
 * Pass som del av ett test: namnen och vilka pass som hör till ett test
 * de dagar det gjordes. Ren modul.
 */

import { addDays } from "@/lib/season/season";

import { protocolByKey } from "./protocols";

/** Protokollets namn, eller nyckeln när protokollet är okänt. */
export const testName = (protocol: string) =>
  protocolByKey(protocol)?.label ?? protocol;

/** "Test · Metabol profil", för en rad i kalendern. */
export const testTag = (protocols: string[]) =>
  protocols.length > 0
    ? `Test · ${[...new Set(protocols.map(testName))].join(", ")}`
    : null;

/** Så långt från testets dag ett pass får ligga för att föreslås. */
export const NEAR_DAYS = 14;

export const nearRange = (date: string) => ({
  from: addDays(date, -NEAR_DAYS),
  to: addDays(date, NEAR_DAYS),
});

/**
 * Passen som troligen är testets: samma gren, på en dag då testet hade en
 * insats (eller testets egen dag), och inte redan kopplade. Flera pass samma
 * dag föreslås alla – coachen väljer.
 */
export function suggestedPasses<
  T extends { id: string; sport: string; performed_on: string },
>(
  session: {
    sport: string;
    performed_on: string;
    effortDates: (string | null)[];
  },
  activities: T[],
  linked: Set<string>,
): T[] {
  const days = new Set(
    [session.performed_on, ...session.effortDates].filter((d): d is string =>
      Boolean(d),
    ),
  );
  return activities.filter(
    (a) =>
      !linked.has(a.id) &&
      a.sport === session.sport &&
      days.has(a.performed_on),
  );
}
