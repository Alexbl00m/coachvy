/**
 * Sökningen bakom ⌘K: sidorna i menyn, adepterna och deras flikar, och de
 * vanligaste handlingarna – matchade mot det som skrivs.
 *
 * Matchningen är enkel och förutsägbar: varje ord i sökningen ska finnas i
 * etiketten (eller ett av dess sökord), utan hänsyn till versaler och
 * accenter, så att "maende" hittar Mående. Träffar där etiketten börjar med
 * sökningen kommer först, sedan träffar i början av ett ord.
 */

export type CommandGroup = "Sidor" | "Adepter" | "Handlingar";

export type Command = {
  id: string;
  group: CommandGroup;
  label: string;
  /** En rad under etiketten: "Tester · Tobias Schander". */
  hint?: string;
  href: string;
  /** Fler ord att hitta posten på, som "progression" för Tester. */
  keywords?: string[];
  /**
   * Visas bara när sökningen har flera ord – "tobias tester" – så att en
   * adepts tolv flikar inte fyller listan när man bara skriver namnet.
   */
  deep?: boolean;
};

export const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

const tokensOf = (query: string) =>
  normalize(query).split(/\s+/).filter(Boolean);

/** Hur väl posten passar; null när den inte passar alls. Högre är bättre. */
export function scoreCommand(
  command: Command,
  query: string,
  { includeDeep = false }: { includeDeep?: boolean } = {},
): number | null {
  const tokens = tokensOf(query);
  if (tokens.length === 0) return command.deep ? null : 0;
  if (command.deep && tokens.length < 2 && !includeDeep) return null;

  const label = normalize(command.label);
  const haystack = [
    label,
    normalize(command.hint ?? ""),
    ...(command.keywords ?? []).map(normalize),
  ].join(" ");
  if (!tokens.every((t) => haystack.includes(t))) return null;

  const q = tokens.join(" ");
  let score = 1;
  if (label === q) score += 100;
  else if (label.startsWith(q)) score += 50;
  if (
    tokens.every((t) =>
      new RegExp(
        `(^|[\\s›·-])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      ).test(haystack),
    )
  )
    score += 20;
  // Kortare etiketter vinner vid lika: "Tester" före "Testtillfällen".
  score -= label.length / 100;
  return score;
}

/** Posterna som passar, bäst först, högst `limit` stycken. */
export function searchCommands(
  commands: Command[],
  query: string,
  limit = 12,
): Command[] {
  if (!query.trim()) return commands.filter((c) => !c.deep).slice(0, limit);
  const run = (includeDeep: boolean) =>
    commands.map((command, index) => ({
      command,
      index,
      score: scoreCommand(command, query, { includeDeep }),
    }));
  // Ett ensamt ord som bara finns bland adepternas flikar – "maende" – visar
  // dem hellre än ingenting.
  let scored = run(false);
  if (scored.every((r) => r.score === null)) scored = run(true);
  return scored
    .filter(
      (r): r is { command: Command; index: number; score: number } =>
        r.score !== null,
    )
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((r) => r.command);
}
