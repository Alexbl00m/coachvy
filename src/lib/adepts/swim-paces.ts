import "server-only";

import { listFullSessions } from "@/lib/tests/session-queries";
import { swimRacePaces, type SwimPoint } from "@/lib/tests/swim";
import type { SwimPaces } from "@/lib/workouts/swim-pace";

import { getAdeptProfile } from "./profile";

/** En tävlingsfart och var den kommer ifrån. */
export type SwimRaceValue = {
  /** Sekunder per 100 m. */
  pace: number;
  /** Inskriven på profilen, eller ur simtestets prognos. */
  from: "profil" | "test";
  /** Testets datum, när farten kommer ur testet. */
  testedOn: string | null;
};

export type SwimRaceDetail = {
  im: SwimRaceValue | null;
  half: SwimRaceValue | null;
  /** Testets prognos, också när profilen har en egen fart. */
  fromTest: { im: number | null; half: number | null; testedOn: string } | null;
};

const num = (v: number | string | null | undefined) =>
  v === null || v === undefined ? null : Number(v);

/** Det senaste simtestet med tider på minst en distans, som punkter. */
async function latestSwimTest(
  adeptId: string,
): Promise<{ points: SwimPoint[]; testedOn: string } | null> {
  const sessions = await listFullSessions(adeptId).catch(() => []);
  for (const session of [...sessions].reverse()) {
    if (session.sport !== "simning") continue;
    const points = session.test_efforts.flatMap((e) =>
      e.distance_m && e.duration_seconds
        ? [
            {
              metres: Number(e.distance_m),
              seconds: Number(e.duration_seconds),
            },
          ]
        : [],
    );
    if (points.length > 0) return { points, testedOn: session.performed_on };
  }
  return null;
}

/**
 * Adeptens tävlingsfart i simning för Ironman och 70.3. En fart som coachen
 * eller adepten skrivit in på profilen gäller; annars används prognosen ur
 * det senaste simtestet, så att farten följer med när ett nytt test läggs in.
 */
export async function swimRaceDetail(adeptId: string): Promise<SwimRaceDetail> {
  const [profile, test] = await Promise.all([
    getAdeptProfile(adeptId).catch(() => null),
    latestSwimTest(adeptId),
  ]);
  const fromTest = test
    ? { ...swimRacePaces(test.points), testedOn: test.testedOn }
    : null;
  const pick = (
    own: number | null,
    tested: number | null | undefined,
  ): SwimRaceValue | null =>
    own !== null && own > 0
      ? { pace: own, from: "profil", testedOn: null }
      : tested && tested > 0
        ? { pace: tested, from: "test", testedOn: fromTest?.testedOn ?? null }
        : null;
  return {
    im: pick(num(profile?.swim_im_pace), fromTest?.im),
    half: pick(num(profile?.swim_703_pace), fromTest?.half),
    fromTest,
  };
}

/** Adeptens tävlingsfart i simning, s/100 m: profilen först, sedan testet. */
export async function adeptSwimRace(
  adeptId: string,
): Promise<Pick<SwimPaces, "im" | "half">> {
  const detail = await swimRaceDetail(adeptId);
  return { im: detail.im?.pace ?? null, half: detail.half?.pace ?? null };
}

/**
 * Adeptens simfarter för passraden: CSS ur testerna (m/s, som referensen i
 * simpassen) och tävlingsfarten. Null utan CSS.
 */
export async function adeptSwimPaces(
  adeptId: string,
  cssSpeed: number | null,
): Promise<SwimPaces | null> {
  if (!(cssSpeed !== null && cssSpeed > 0)) return null;
  return { css: 100 / cssSpeed, ...(await adeptSwimRace(adeptId)) };
}
