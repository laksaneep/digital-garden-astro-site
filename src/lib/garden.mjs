import { getCollection } from "astro:content";

/** Published notes only, newest first. Drafts never reach the site. */
export async function getNotes() {
  const notes = await getCollection("notes", ({ data }) => data.published === true);
  return notes
    .map((note) => ({
      ...note,
      section: note.id.includes("/") ? note.id.split("/")[0] : "unfiled",
      slug: note.id.split("/").pop().replace(/\.md$/, ""),
    }))
    // Title breaks ties: notes written the same day would otherwise order
    // differently between builds, producing noisy diffs in the output.
    .sort(
      (a, b) =>
        b.data.created - a.data.created ||
        a.data.title.localeCompare(b.data.title),
    );
}

/** Section names with note counts, biggest first. */
export function sectionCounts(notes) {
  const counts = new Map();
  for (const note of notes) {
    counts.set(note.section, (counts.get(note.section) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Group notes into month buckets, preserving newest-first order. */
export function byMonth(notes) {
  const groups = [];
  for (const note of notes) {
    const label = note.data.created.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
    const last = groups.at(-1);
    if (last?.label === label) last.notes.push(note);
    else groups.push({ label, notes: [note] });
  }
  return groups;
}

/** Notes whose body links to this one, via [[wikilink]]. */
export function backlinksTo(note, notes) {
  const needle = `[[${note.data.title}`;
  return notes.filter((other) => other.id !== note.id && other.body.includes(needle));
}

export const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);
