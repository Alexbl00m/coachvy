/**
 * Låter Node köra appens TypeScript direkt: `@/…` pekar på src/, och en
 * import utan filändelse hittar .ts-filen. Node 22.18 eller senare tar
 * själv bort typerna.
 *
 *   node --import ./scripts/alias/register.mjs scripts/<skript>.ts
 */
import { register } from "node:module";

register("./hooks.mjs", import.meta.url);
