/* Matches the callout marker on the first line, capturing the title and
   whatever body text follows. remark hands us the entire blockquote as a single
   text node with embedded newlines, so this has to split on \n itself rather
   than expecting separate nodes. */
const CALLOUT = /^\[!(\w+)\]\s*([^\n]*)\n?([\s\S]*)$/;

/**
 * Turns Obsidian callouts into styled blocks.
 *
 *   > [!note] Optional title
 *   > body text
 *
 * Without this they render as a plain blockquote containing the literal
 * text "[!note] Optional title", which looks broken.
 */
export function remarkCallouts() {
  return (tree) => {
    for (const node of tree.children ?? []) {
      if (node.type !== "blockquote") continue;
      const first = node.children?.[0];
      if (first?.type !== "paragraph") continue;
      const lead = first.children?.[0];
      if (lead?.type !== "text") continue;

      const match = lead.value.match(CALLOUT);
      if (!match) continue;

      const [, type, title, rest] = match;

      // Keep the body, drop the marker line.
      lead.value = rest;
      if (!rest && first.children.length === 1) node.children.shift();

      node.data = {
        hName: "aside",
        hProperties: { className: `callout callout-${type.toLowerCase()}` },
      };
      node.children.unshift({
        type: "paragraph",
        data: { hProperties: { className: "clabel" } },
        children: [{ type: "text", value: title.trim() || type }],
      });
    }
  };
}
