/**
 * Grenarna och planbibliotekets kategorier: vilka planer som hör till en
 * gren, så att förslagen och planväljaren visar adeptens planer först.
 *
 * Modulen är ren och används på servern och i webbläsaren.
 */

const RUNNING = ["lopning", "maraton", "halvmaraton", "10-km", "trail-ultra"];
const TRIATHLON = ["ironman", "70-3", "olympisk-triathlon", "xterra"];

/** Kategorierna för ett lopps gren, så att cykelplaner kommer först för ett cykellopp. */
export const SPORT_CATEGORY: Record<string, string[]> = {
  cykling: ["cykel"],
  löpning: RUNNING,
  simning: ["simning"],
  triathlon: TRIATHLON,
};

/**
 * Kategorierna som hör till adeptens gren, eller null när grenen saknas
 * eller är okänd. En triathlet tränar i alla tre grenarna och får också
 * cykel-, löp- och simplanerna.
 */
export function categoriesForSport(sport: string | null): string[] | null {
  const key = sport?.trim().toLowerCase();
  if (!key) return null;
  if (key === "triathlon") return [...TRIATHLON, "cykel", ...RUNNING, "simning"];
  return SPORT_CATEGORY[key] ?? null;
}
