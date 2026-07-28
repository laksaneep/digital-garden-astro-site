import { getCollection } from "astro:content";
import { slugify } from "./slug.mjs";

/** Published notes only, newest first. Drafts never reach the site. */
export async function getNotes() {
  const notes = await getCollection("notes", ({ data }) => data.published === true);
  return notes
    .map((note) => ({
      ...note,
      section: note.id.includes("/") ? note.id.split("/")[0] : "unfiled",
      // Slugify the filename so notes can be named naturally in Obsidian
      // ("A static site doesn't need a database.md") and still resolve to a
      // clean URL that matches how [[wikilinks]] slugify the same title.
      slug: slugify(note.id.split("/").pop().replace(/\.md$/, "")),
    }))
    // Title breaks ties: notes written the same day would otherwise order
    // differently between builds, producing noisy diffs in the output.
    .sort(
      (a, b) =>
        b.data.created - a.data.created ||
        a.data.title.localeCompare(b.data.title),
    );
}

/**
 * Section names with note counts, biggest first. Each carries its URL slug,
 * so an Obsidian folder named "System Design" resolves to /sections/system-design
 * while the raw name stays available for the display heading.
 */
export function sectionCounts(notes) {
  const counts = new Map();
  for (const note of notes) {
    counts.set(note.section, (counts.get(note.section) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, slug: slugify(name), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Tag names with note counts, biggest first. Each carries its URL slug. */
export function tagCounts(notes) {
  const counts = new Map();
  for (const note of notes) {
    for (const tag of note.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, slug: slugify(name), count }))
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

/**
 * Build a GitHub-style activity calendar from note creation dates: the trailing
 * `weeks` weeks up to today, as whole Sun→Sat columns. Returns the week columns
 * (each 7 days), month labels positioned by column, and the busiest-day count.
 * Dates are handled in local time so a day never lands in the wrong column.
 */
export function activityCalendar(notes, weeks = 53) {
  const ymd = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const counts = new Map();
  for (const note of notes) {
    const key = ymd(note.data.created);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // End on the Saturday of the current week so every column is a full week.
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay()));
  const cursor = new Date(end);
  cursor.setDate(cursor.getDate() - (weeks * 7 - 1));

  let max = 0;
  const columns = [];
  for (let w = 0; w < weeks; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const key = ymd(cursor);
      const count = counts.get(key) ?? 0;
      max = Math.max(max, count);
      days.push({ date: key, count, future: cursor > today });
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push(days);
  }

  // A month label sits on the first column that opens a new month.
  const monthLabels = [];
  let lastMonth = -1;
  columns.forEach((week, col) => {
    const first = new Date(`${week[0].date}T00:00:00`);
    if (first.getMonth() !== lastMonth) {
      monthLabels.push({
        col,
        label: first.toLocaleDateString("en-GB", { month: "short" }),
      });
      lastMonth = first.getMonth();
    }
  });

  // The window opens mid-month, so its first label sits only a column or two
  // before the next one and the two collide. Drop it, like GitHub does.
  if (monthLabels.length > 1 && monthLabels[1].col - monthLabels[0].col < 3) {
    monthLabels.shift();
  }

  return { columns, monthLabels, max };
}

/** Notes whose body links to this one, via [[wikilink]]. */
export function backlinksTo(note, notes) {
  const needle = `[[${note.data.title}`;
  return notes.filter((other) => other.id !== note.id && other.body.includes(needle));
}

export const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);
