import { cp, mkdir, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, sep } from "node:path";

// Where the notes come from. CI overrides this with GARDEN_DIR.
const source =
  process.env.GARDEN_DIR ??
  join(homedir(), "Documents", "ObsidianVault", "Digital-garden");

const dest = join(process.cwd(), "src", "content", "notes");

if (!existsSync(source)) {
  console.error(`\n  Garden not found at ${source}`);
  console.error(`  Set GARDEN_DIR to point at it.\n`);
  process.exit(1);
}

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
// Skip anything dot-prefixed: .git, .github, .obsidian, .DS_Store. Tested on the
// path *relative to the source*, so a dot in a parent directory can't wipe out
// the whole copy.
const isHidden = (src) =>
  relative(source, src)
    .split(sep)
    .some((segment) => segment.startsWith("."));

await cp(source, dest, {
  recursive: true,
  filter: (src) => !isHidden(src),
});

const sections = (await readdir(dest, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

console.log(`  synced ${sections.length} sections from ${source}`);
