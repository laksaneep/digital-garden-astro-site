import { readdirSync } from "node:fs";
import { dirname, join, posix, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { visit } from "unist-util-visit";

// Where scripts/sync-notes.mjs copies the vault, attachments included.
const NOTES_DIR = join(process.cwd(), "src", "content", "notes");

const EMBED = /!\[\[([^\]|#^]+)(?:[#^][^\]|]*)?(?:\|([^\]]*))?\]\]/g;
const IMAGE_EXT = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i;
// Keep in sync with VIDEO in scripts/sync-notes.mjs, which copies these files
// to public/ so they are served as-is.
const VIDEO_EXT = /\.(mp4|m4v|webm|ogv|mov)$/i;
const SIZE = /^(\d+)(?:x(\d+))?$/;

/**
 * Every file in the synced vault, as POSIX paths relative to NOTES_DIR. Built
 * per run, not cached at module level, so `astro dev` sees images added after
 * a re-sync.
 */
function listVault(dir = NOTES_DIR, prefix = "") {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    if (e.name.startsWith(".")) return [];
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    return e.isDirectory() ? listVault(join(dir, e.name), rel) : [rel];
  });
}

/**
 * Resolve an embed target the way Obsidian does: an exact vault path wins,
 * otherwise match by file name anywhere in the vault, preferring the copy in
 * the note's own folder, then the shortest path.
 */
function resolve(target, noteDir, files) {
  const wanted = target.replace(/^\/+/, "");
  if (files.includes(wanted)) return wanted;
  const fromNote = posix.normalize(posix.join(noteDir, wanted));
  if (files.includes(fromNote)) return fromNote;

  // "pic.png" matches any pic.png; "img/pic.png" matches any path ending in it.
  const tail = `/${wanted.toLowerCase()}`;
  const hits = files.filter((f) => `/${f.toLowerCase()}`.endsWith(tail));
  if (!hits.length) return null;
  return (
    hits.find((f) => posix.dirname(f) === noteDir) ??
    hits.sort((a, b) => a.split("/").length - b.split("/").length || a.length - b.length)[0]
  );
}

const escapeAttr = (s) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * Turns Obsidian embeds into real images.
 *
 *   ![[diagram.png]]           -> <img src=".../diagram.png" alt="diagram">
 *   ![[diagram.png|300]]       -> same, 300px wide
 *   ![[diagram.png|300x200]]   -> same, 300x200
 *   ![[diagram.png|A caption]] -> alt text "A caption"
 *   ![[clip.mp4]]              -> <video controls src="/media/.../clip.mp4">
 *   ![[clip.mp4|400]]          -> same, 400px wide
 *
 * The image node points at the attachment's copy inside src/content/notes via a
 * relative path, so Astro's image pipeline picks it up, optimises it, and fails
 * loudly if it goes missing. An embed whose file isn't in the vault becomes its
 * plain file name and a build warning, rather than breaking the build.
 *
 * Videos can't go through the image pipeline, so sync-notes.mjs copies them to
 * public/media/ and the embed becomes a <video> pointing there.
 *
 * Embeds of other notes (![[Some note]]) are rewritten to plain [[Some note]]
 * so the wikilink plugin turns them into links: we don't transclude notes.
 *
 * Must run before remarkWikilinks, which would otherwise grab the [[...]] part.
 */
export function remarkEmbeds() {
  return (tree, file) => {
    const notePath = file.path ?? file.history?.[0];
    if (!notePath) return;
    const abs = notePath.startsWith("file:") ? fileURLToPath(notePath) : notePath;
    const noteDir = relative(NOTES_DIR, dirname(abs)).split(sep).join("/") || ".";
    if (noteDir.startsWith("..")) return;
    let files;

    visit(tree, "text", (node, index, parent) => {
      if (!parent || parent.type === "link") return;
      if (!node.value.includes("![[")) return;
      files ??= listVault();

      const children = [];
      let last = 0;

      for (const match of node.value.matchAll(EMBED)) {
        const [raw, rawTarget, option] = match;
        const target = rawTarget.trim();
        if (match.index > last) {
          children.push({ type: "text", value: node.value.slice(last, match.index) });
        }
        last = match.index + raw.length;

        const isVideo = VIDEO_EXT.test(target);
        if (!isVideo && !IMAGE_EXT.test(target)) {
          // A note (or a PDF/audio/etc. we don't render): drop the "!" so it
          // becomes an ordinary wikilink.
          children.push({ type: "text", value: raw.slice(1) });
          continue;
        }

        const found = resolve(target, noteDir === "." ? "" : noteDir, files);
        if (!found) {
          console.warn(`  [embeds] ${relative(process.cwd(), abs)}: no attachment named "${target}"`);
          // Show the file name rather than a "!" next to a link to nowhere.
          children.push({ type: "text", value: target });
          continue;
        }

        const size = option?.trim().match(SIZE);

        if (isVideo) {
          const src = "/media/" + found.split("/").map(encodeURIComponent).join("/");
          const label = size || !option?.trim()
            ? posix.basename(target).replace(VIDEO_EXT, "")
            : option.trim();
          const attrs = [
            `src="${src}"`,
            `aria-label="${escapeAttr(label)}"`,
            size && `width="${size[1]}"`,
            size?.[2] && `height="${size[2]}"`,
          ].filter(Boolean).join(" ");
          children.push({
            type: "html",
            value: `<video controls preload="metadata" playsinline ${attrs}></video>`,
          });
          continue;
        }

        const alt = size || !option?.trim()
          ? posix.basename(target).replace(IMAGE_EXT, "")
          : option.trim();
        let rel = posix.relative(noteDir === "." ? "" : noteDir, found);
        if (!rel.startsWith(".")) rel = `./${rel}`;

        children.push({
          type: "image",
          url: encodeURI(rel),
          alt,
          data: size
            ? { hProperties: { width: Number(size[1]), ...(size[2] && { height: Number(size[2]) }) } }
            : undefined,
        });
      }

      if (!children.length) return;
      if (last < node.value.length) {
        children.push({ type: "text", value: node.value.slice(last) });
      }
      parent.children.splice(index, 1, ...children);
      return index + children.length;
    });
  };
}
