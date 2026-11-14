import { cp, mkdir, rm, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, sep } from "node:path";

// Where the notes come from. CI overrides this with GARDEN_DIR.
const source =
  process.env.GARDEN_DIR ??
  join(homedir(), "Documents", "ObsidianVault", "Digital-garden");

const dest = join(process.cwd(), "src", "content", "notes");
// Videos are served as static files from here (see src/lib/embeds.mjs).
const media = join(process.cwd(), "public", "media");

if (!existsSync(source)) {
  console.error(`\n  Garden not found at ${source}`);
  console.error(`  Set GARDEN_DIR to point at it.\n`);
  process.exit(1);
}

await rm(dest, { recursive: true, force: true });
await rm(media, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
// Skip anything dot-prefixed: .git, .github, .obsidian, .DS_Store. Tested on the
// path *relative to the source*, so a dot in a parent directory can't wipe out
// the whole copy.
const isHidden = (src) =>
  relative(source, src)
    .split(sep)
    .some((segment) => segment.startsWith("."));

// Attachments (pasted images etc.) come along too: src/lib/embeds.mjs resolves
// ![[image.png]] against these copies and Astro's image pipeline optimises them.
await cp(source, dest, {
  recursive: true,
  filter: (src) => !isHidden(src),
});

const sections = (await readdir(dest, { withFileTypes: true }))
  // "_"-prefixed folders (e.g. _assets) are never sections; see src/lib/garden.mjs.
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name);

const IMAGE = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i;
const synced = await readdir(dest, { recursive: true });
const images = synced.filter((f) => IMAGE.test(f));

// Keep in sync with VIDEO_EXT in src/lib/embeds.mjs.
const VIDEO = /\.(mp4|m4v|webm|ogv|mov)$/i;
const videos = synced.filter((f) => VIDEO.test(f));
for (const f of videos) {
  const to = join(media, f);
  await mkdir(dirname(to), { recursive: true });
  await cp(join(dest, f), to);
  // Cloudflare Pages refuses to deploy any single file over 25 MiB.
  const { size } = await stat(to);
  if (size > 25 * 1024 * 1024) {
    console.warn(`  [sync] ${f} is ${(size / 1048576).toFixed(1)} MiB; Cloudflare Pages allows 25 MiB per file`);
  }
}

console.log(
  `  synced ${sections.length} sections, ${images.length} images and ${videos.length} videos from ${source}`,
);
