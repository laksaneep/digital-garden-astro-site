# Digital-garden-astro-site

The Astro site for "What I've learned today". Code only — **no notes live here.**

Notes come from a separate private repo (the Obsidian garden vault). They are
copied into `src/content/notes/` at build time, and that folder is git-ignored.
Live at https://what-i-have-learned.pages.dev.

## What it does

- **Wikilinks & backlinks** — `[[Note title]]` becomes a real link; each note lists what links to it.
- **Obsidian callouts** — `> [!note]` renders as a styled `<aside>`.
- **Sections & tags** — a folder is a section (`/sections/[name]`); tags get `/tags` + `/tags/[tag]`. Section/tag/note slugs are all slugified, so files and folders can be named naturally in Obsidian.
- **Full-text search** — Pagefind, opened via the nav button or ⌘K. The only client-side JS.
- **Activity heatmap** — a GitHub-style contribution graph on the home page (pure CSS, no library).
- **Theme** — light/dark toggle, grid-notebook aesthetic.
- **Responsive nav** — top bar on desktop; a floating icon bottom bar on mobile.

Static output, ~0 KB JS except the search runtime (loaded lazily on first open).

## Running it

```bash
npm install
npm run dev      # syncs notes, then starts the dev server
npm run build    # clean + sync + astro build + pagefind index
npm run preview  # serve the built site (needed to test search)
```

## Gotchas

- **Search only works on the _built_ site.** Pagefind indexes `dist/` after `astro build`, so search is inert under `npm run dev` — use `npm run build && npm run preview` to test it.
- **The content cache.** Astro caches rendered markdown in `node_modules/.astro/data-store.json`. Editing a remark plugin does **not** invalidate it (`rm -rf .astro` isn't enough — the store lives under `node_modules/`). `npm run build` runs `npm run clean` first; if a plugin edit seems ignored in dev, run `npm run clean`.
- **A bad note fails the whole build.** Every note's frontmatter is validated at build, not just published ones — one malformed `created` date blocks the deploy.

## Layout

```
src/
├── content.config.ts       frontmatter schema (title/published/created/updated/tags)
├── lib/
│   ├── garden.mjs          published filter, section/tag counts, month grouping,
│   │                       backlinks, activity calendar
│   ├── slug.mjs            title -> slug, shared by wikilinks and routing
│   ├── wikilinks.mjs       [[Note title]] -> real links
│   ├── callouts.mjs        > [!note] -> <aside class="callout">
│   └── utils.ts            cn() — clsx + tailwind-merge
├── layouts/Base.astro      header, nav (+ mobile bottom bar), theme toggle
├── components/
│   ├── NoteList.astro      notes grouped by month
│   ├── Search.astro        Pagefind ⌘K modal
│   └── Heatmap.astro       activity contribution graph
├── pages/
│   ├── index.astro         sections, note count, activity, recent
│   ├── notes/
│   │   ├── index.astro     all notes by month
│   │   └── [slug].astro    one note + backlinks
│   ├── sections/[name].astro   notes in a section
│   └── tags/
│       ├── index.astro     all tags
│       └── [tag].astro     notes with a tag
└── styles/global.css       Tailwind import, palette, @theme tokens

.github/workflows/
├── deploy.yml              sync garden + build + deploy to Cloudflare Pages
└── security.yml            Trivy scan -> GitHub Security tab
```

## Deploy

On Cloudflare Pages

## Security

`security.yml` runs Trivy (deps + secrets + misconfig, CRITICAL/HIGH) on every
push/PR and weekly.
