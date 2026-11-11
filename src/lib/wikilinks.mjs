import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { slug as headingSlug } from "github-slugger";
import { visit } from "unist-util-visit";
import { slugify } from "./slug.mjs";

// [[target]] or [[target|label]]. A leading ! (an embed) is captured so it can
// be skipped rather than half-rendered.
const WIKILINK = /(!?)\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Split a wikilink target into the note it points at and the heading in it.
 *
 *   "Folder/My note.md#Some heading" -> { slug: "my-note", heading: "Some heading" }
 *   "#Some heading"                  -> { slug: null, heading: "Some heading" }
 *   "My note#^block-id"              -> { slug: "my-note", heading: null }
 *
 * Obsidian resolves a link by file name, ignoring any folder, so only the last
 * path segment counts. Block references (#^id) have no anchor on the site, so
 * they fall back to the top of the note.
 */
export function parseTarget(raw) {
  // Inside a table, Obsidian has you escape the alias pipe as \|, which leaves
  // a trailing backslash on the target.
  const target = raw.trim().replace(/\\$/, "");
  const hash = target.indexOf("#");
  const file = (hash === -1 ? target : target.slice(0, hash)).trim();
  let heading = hash === -1 ? null : target.slice(hash + 1).trim();
  if (heading?.startsWith("^") || heading === "") heading = null;
  // Nested headings ("Note#Parent#Child") point at the last one.
  if (heading?.includes("#")) heading = heading.split("#").pop().trim();

  const name = file.split("/").pop().replace(/\.md$/i, "");
  return {
    slug: name ? slugify(name) : null,
    name,
    heading,
  };
}

/** Every [[wikilink]] target in a markdown body, as parsed targets. */
export function wikilinkTargets(markdown) {
  // Links inside code are examples, not links.
  const prose = markdown.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, "");
  return [...prose.matchAll(WIKILINK)]
    .filter(([, bang]) => !bang)
    .map(([, , target]) => parseTarget(target));
}

/**
 * Slugs of every published note, read straight from the synced notes folder.
 *
 * The remark plugin runs while Astro renders each note, outside the content
 * collection API, so it can't call getNotes(). The rule here must match
 * getNotes(): published: true in frontmatter, slug from the file name.
 */
let publishedCache = null;
let publishedAt = 0;
export function publishedSlugs(dir = join(process.cwd(), "src", "content", "notes")) {
  // A build renders every note within moments, so one scan serves them all. The
  // short expiry only matters in `astro dev`, where you may publish a note and
  // expect links to it to light up without restarting.
  if (publishedCache && Date.now() - publishedAt < 2000) return publishedCache;
  const slugs = new Set();
  if (existsSync(dir)) {
    for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const source = readFileSync(join(entry.parentPath ?? entry.path, entry.name), "utf8");
      const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
      if (/^published:\s*true\s*(#.*)?$/im.test(frontmatter)) {
        slugs.add(slugify(entry.name.replace(/\.md$/, "")));
      }
    }
  }
  publishedCache = slugs;
  publishedAt = Date.now();
  return slugs;
}

/**
 * Rewrites Obsidian wikilinks into real links.
 *
 *   [[A note]]             -> <a href="/notes/a-note">A note</a>
 *   [[A note|see this]]    -> <a href="/notes/a-note">see this</a>
 *   [[A note#Heading]]     -> <a href="/notes/a-note#heading">A note > Heading</a>
 *   [[#Heading]]           -> <a href="#heading">Heading</a>
 *
 * A link to a note that isn't published (a draft, or no such file) becomes
 * plain text, so readers never land on a 404 and drafts stay invisible.
 * Embeds (![[...]]) aren't supported yet and are left untouched.
 *
 * Runs on text nodes only, so wikilinks inside code blocks are left alone.
 */
export function remarkWikilinks() {
  return (tree) => {
    const published = publishedSlugs();

    visit(tree, "text", (node, index, parent) => {
      if (!parent || parent.type === "link") return;
      if (!node.value.includes("[[")) return;

      const children = [];
      let last = 0;
      const text = (value) => {
        const prev = children.at(-1);
        if (prev?.type === "text") prev.value += value;
        else children.push({ type: "text", value });
      };

      for (const match of node.value.matchAll(WIKILINK)) {
        const [raw, bang, target, alias] = match;
        if (bang) continue;
        if (match.index > last) text(node.value.slice(last, match.index));
        last = match.index + raw.length;

        const { slug, name, heading } = parseTarget(target);
        const anchor = heading ? `#${headingSlug(heading)}` : "";
        const label =
          alias?.trim() ||
          (name && heading ? `${name} > ${heading}` : name || heading || target.trim());

        if (slug && !published.has(slug)) {
          text(label);
          continue;
        }
        if (!slug && !anchor) {
          text(label);
          continue;
        }
        children.push({
          type: "link",
          url: slug ? `/notes/${slug}${anchor}` : anchor,
          data: { hProperties: { className: "wl" } },
          children: [{ type: "text", value: label }],
        });
      }

      if (!children.length) return;
      if (last < node.value.length) text(node.value.slice(last));
      parent.children.splice(index, 1, ...children);
      return index + children.length;
    });
  };
}
