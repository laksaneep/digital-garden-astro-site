import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import tailwindcss from "@tailwindcss/vite";
import { remarkWikilinks } from "./src/lib/wikilinks.mjs";
import { remarkCallouts } from "./src/lib/callouts.mjs";

export default defineConfig({
  site: "https://what-i-have-learned.pages.dev",
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Pagefind's runtime only exists in the built output (dist/pagefind/),
      // generated after Astro runs. Keep the dynamic import external so Rollup
      // doesn't try to resolve it at build time.
      rollupOptions: { external: ["/pagefind/pagefind.js"] },
    },
  },
  markdown: {
    // Astro 7 defaults to the Sätteri pipeline, which doesn't run remark
    // plugins. Opt back into unified so our custom remark plugins keep working.
    processor: unified(),
    // Callouts first: it needs the marker line intact as a single text node,
    // which the wikilink plugin would otherwise split apart.
    remarkPlugins: [remarkCallouts, remarkWikilinks],
  },
});
