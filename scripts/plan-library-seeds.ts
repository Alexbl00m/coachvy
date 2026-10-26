/**
 * Skriver ut SQL som läser in de färdiga planerna – cykel och löpning – som
 * utkast, ägda av en admin och delade med medlemmar och coacher.
 *
 *   node --import ./scripts/alias/register.mjs scripts/plan-library-seeds.ts > planer.sql
 *   node --import ./scripts/alias/register.mjs scripts/plan-library-seeds.ts --owner-email coach@example.com
 *   node --import ./scripts/alias/register.mjs scripts/plan-library-seeds.ts --slug lop-grund
 *
 * Inläsningen går att köra igen: en plan vars adress redan finns hoppas
 * över. Publicera planerna sedan i mallverktyget, eller med
 * publish_plan_version, som kontrollerar dem en gång till.
 */
import { seedSql } from "@/lib/plan-library/seeds/build";
import { CYCLING_PLANS } from "@/lib/plan-library/seeds/cycling";
import { RUNNING_PLANS } from "@/lib/plan-library/seeds/running";

const ALL = [...CYCLING_PLANS, ...RUNNING_PLANS];

const FIRST_ADMIN = "(select profile_id from public.admins order by created_at limit 1)";

const flag = process.argv.indexOf("--owner-email");
const email = flag > -1 ? process.argv[flag + 1] : null;
if (flag > -1 && !email) {
  console.error("Ange e-postadressen efter --owner-email.");
  process.exit(1);
}
const owner = email
  ? `(select id from auth.users where email = '${email.replace(/'/g, "''")}')`
  : FIRST_ADMIN;

const only = process.argv.indexOf("--slug");
const plans =
  only > -1 ? ALL.filter((p) => p.slug === process.argv[only + 1]) : ALL;

console.log("-- De färdiga planerna: cykel och löpning.");
console.log(plans.map((p) => seedSql(p, owner)).join("\n\n"));
