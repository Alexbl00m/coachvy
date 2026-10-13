/**
 * Passbibliotekets färdiga pass som SQL, för att läsa in dem i en databas.
 *
 * Passen ägs av en admin och delas med alla coacher. Inläsningen går att
 * köra igen: ett pass med samma namn hos samma ägare hoppas över, så ett
 * pass coachen ändrat skrivs inte över.
 *
 * Modulen är ren. `scripts/session-library-atlas.ts` skriver ut SQL:en.
 */

import {
  validateLibraryInput,
  type LibraryInput,
  type ValidInput,
} from "../library";
import { CYCLING_ATLAS } from "./cycling";

/** Passen tolkade och kontrollerade. Kastar om ett pass inte går igenom. */
export function atlasRows(
  sessions: LibraryInput[] = CYCLING_ATLAS,
): ValidInput[] {
  return sessions.map((input) => {
    const checked = validateLibraryInput(input);
    if (!checked.ok) {
      throw new Error(`${input.title}: ${checked.error}`);
    }
    return checked.value;
  });
}

const literal = (value: string | null) =>
  value === null || value === "" ? "null" : `'${value.replace(/'/g, "''")}'`;

const json = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`;

/** Ägaren: den första admin, om inget annat anges. */
export const FIRST_ADMIN =
  "(select profile_id from public.admins order by created_at limit 1)";

/**
 * En insert per pass. Tidsstämplarna sjunker en sekund per pass, så att
 * biblioteket – som visar det senast ändrade först – står i atlasens
 * ordning.
 */
export function atlasStatements(
  owner: string = FIRST_ADMIN,
  rows: ValidInput[] = atlasRows(),
): string[] {
  return rows.map((row, i) => {
    const stamp = `now() - interval '${i} seconds'`;
    return [
      "insert into public.session_library (",
      "  owner_id, shared, title, sport, kind, intensity, purpose, description,",
      "  progression, adaptations, fueling, timing, phases, basis, structure,",
      "  blocks, levels, created_at, updated_at",
      ")",
      "select",
      `  o.id, ${row.shared}, ${literal(row.title)}, ${literal(row.sport)},`,
      `  ${literal(row.kind)}, ${literal(row.intensity)},`,
      `  ${literal(row.purpose)},`,
      `  ${literal(row.description)},`,
      `  ${literal(row.progression)},`,
      `  ${literal(row.adaptations)},`,
      `  ${literal(row.fueling)},`,
      `  ${literal(row.timing)},`,
      `  array[${row.phases.map((p) => literal(p)).join(", ")}]::text[],`,
      `  ${literal(row.basis)}, ${literal(row.structure)},`,
      `  ${json(row.blocks)},`,
      `  ${json(row.levels)},`,
      `  ${stamp}, ${stamp}`,
      `from (select ${owner} as id) o`,
      "where o.id is not null",
      "  and not exists (",
      "    select 1 from public.session_library s",
      `    where s.owner_id = o.id and s.title = ${literal(row.title)}`,
      "  );",
    ].join("\n");
  });
}
