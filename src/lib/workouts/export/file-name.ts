/**
 * Ett filnamn ur passets titel: bara bokstäver, siffror och bindestreck.
 *
 * Klockor och cykeldatorer läser filsystem som inte alltid klarar å, ä, ö
 * eller mellanslag, så tecknen skalas ned till sin grundbokstav.
 */
export function workoutFileName(title: string, extension: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return `${slug || "pass"}.${extension}`;
}
