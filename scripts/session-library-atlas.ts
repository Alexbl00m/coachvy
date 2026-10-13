/**
 * Skriver ut SQL som läser in passbibliotekets färdiga cykelpass – atlasen
 * Z1–Z5 och kraftpasset – som delade pass ägda av en admin.
 *
 *   node --import ./scripts/alias/register.mjs scripts/session-library-atlas.ts > atlas.sql
 *   node --import ./scripts/alias/register.mjs scripts/session-library-atlas.ts --owner-email coach@example.com
 *
 * Utan --owner-email blir den första admin ägare. Inläsningen går att köra
 * igen: ett pass med samma namn hos ägaren hoppas över.
 */
import { atlasStatements, FIRST_ADMIN } from "@/lib/session-library/atlas/seed";

const flag = process.argv.indexOf("--owner-email");
const email = flag > -1 ? process.argv[flag + 1] : null;
if (flag > -1 && !email) {
  console.error("Ange e-postadressen efter --owner-email.");
  process.exit(1);
}
const owner = email
  ? `(select id from auth.users where email = '${email.replace(/'/g, "''")}')`
  : FIRST_ADMIN;

console.log("-- Passbibliotekets cykelpass: atlasen Z1–Z5 och kraftpasset.");
console.log(atlasStatements(owner).join("\n\n"));
