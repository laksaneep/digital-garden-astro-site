import { defineConfig } from "astro/config";
import { remarkWikilinks } from "./src/lib/wikilinks.mjs";
import { remarkCallouts } from "./src/lib/callouts.mjs";

export default defineConfig({
  site: "https://digital-garden.pages.dev",
  markdown: {
    // Callouts first: it needs the marker line intact as a single text node,
    // which the wikilink plugin would otherwise split apart.
    remarkPlugins: [remarkCallouts, remarkWikilinks],
  },
});
