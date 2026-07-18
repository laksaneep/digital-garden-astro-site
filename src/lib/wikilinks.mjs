import { visit } from "unist-util-visit";
import { slugify } from "./slug.mjs";

const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Rewrites Obsidian wikilinks into real links.
 *
 *   [[A note title]]           -> <a href="/notes/a-note-title">A note title</a>
 *   [[A note title|see this]]  -> <a href="/notes/a-note-title">see this</a>
 *
 * Runs on text nodes only, so wikilinks inside code blocks are left alone.
 */
export function remarkWikilinks() {
  return (tree) => {
    visit(tree, "text", (node, index, parent) => {
      if (!parent || parent.type === "link") return;
      if (!node.value.includes("[[")) return;

      const children = [];
      let last = 0;

      for (const match of node.value.matchAll(WIKILINK)) {
        const [raw, target, label] = match;
        if (match.index > last) {
          children.push({ type: "text", value: node.value.slice(last, match.index) });
        }
        children.push({
          type: "link",
          url: `/notes/${slugify(target.trim())}`,
          data: { hProperties: { className: "wl" } },
          children: [{ type: "text", value: (label ?? target).trim() }],
        });
        last = match.index + raw.length;
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
