/**
 * Turn a note title into its URL slug.
 *
 * This must stay in sync with how notes are named on disk: a wikilink is written
 * as [[The note title]], and we resolve it by slugifying that title and matching
 * it against the file's slug. Apostrophes are dropped rather than replaced, so
 * "doesn't" becomes "doesnt" and not "doesn-t".
 */
export function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
