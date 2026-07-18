# digital-garden-astro-site

The Astro site for "What I've learned today". Code only — **no notes live here.**

Notes come from `ObsidianVault/Digital-garden/`, which is its own git repo. They are
copied into `src/content/notes/` at build time and that folder is git-ignored.

## Running it

```bash
npm install
npm run dev      # syncs notes, then starts the dev server
npm run build    # clean + sync + build to dist/
```

`npm run sync` reads from `~/Documents/ObsidianVault/Digital-garden` by default.
Override with `GARDEN_DIR=/path/to/garden npm run dev`.

## Gotcha: the content cache

Astro caches rendered markdown in `node_modules/.astro/data-store.json`. **Editing a
remark plugin does not invalidate it** — the build silently replays the previously
rendered HTML, so plugin changes appear to do nothing. Note that `rm -rf .astro` is
*not* enough; the store lives under `node_modules/`.

`npm run build` runs `npm run clean` first for this reason. If you're using
`npm run dev` and a plugin edit seems ignored, run `npm run clean`.

## Layout

```
src/
├── content.config.ts     frontmatter schema — a bad tag fails the build
├── lib/
│   ├── garden.mjs        published filter, section counts, month grouping, backlinks
│   ├── slug.mjs          title -> slug, shared by wikilinks and routing
│   ├── wikilinks.mjs     [[Note title]] -> real links
│   └── callouts.mjs      > [!note] -> <aside class="callout">
├── layouts/Base.astro
├── components/NoteList.astro
├── pages/
│   ├── index.astro       section map, note count, recent notes
│   └── notes/
│       ├── index.astro   all notes by month
│       └── [slug].astro  one note + backlinks
└── styles/global.css     grid-notebook theme, light + dark
```

## Two rules worth not breaking

**The publish gate.** Only notes with `published: true` are rendered. Default is false.
The vault holds private journal and personal folders, so this fails closed on purpose.

**Type sits on the grid.** `--cell` is 24px; body line-height is exactly 24px, headings
48px, spacing in multiples. That alignment is what makes the background read as paper
rather than wallpaper. Change the cell size and the whole scale has to move with it.

## Not built yet

Tags, Pagefind search, section pages, and the activity heatmap are v2.
