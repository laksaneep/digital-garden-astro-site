import { visit } from "unist-util-visit";

/**
 * Ends a GFM table where Obsidian would.
 *
 * In spec GFM a line that follows a table without a blank line in between is
 * swallowed as another table row, even when it has no pipes:
 *
 *   | a | b |
 *   | - | - |
 *   | 1 | 2 |
 *   พูดง่ายๆ:        <- becomes a lone cell <td>พูดง่ายๆ:</td><td></td>
 *
 * Obsidian instead treats a pipe-less line as the end of the table and renders
 * it as a paragraph. This plugin matches that: the first body row whose source
 * line contains no "|" (and everything after it) is lifted out of the table and
 * re-emitted as paragraphs, so notes written the Obsidian way look the same on
 * the site without needing a hand-added blank line.
 *
 * Works off `position.offset` into the original source, so it doesn't care where
 * frontmatter puts the line numbers.
 */
export function remarkObsidianTables() {
  return (tree, file) => {
    const source = String(file.value);

    visit(tree, "table", (table, index, parent) => {
      if (!parent || index == null) return;

      const rows = table.children ?? [];
      // Skip the header (row 0); its pipes always define the table.
      let cut = -1;
      for (let i = 1; i < rows.length; i++) {
        const pos = rows[i].position;
        if (!pos?.start || !pos?.end) continue;
        const raw = source.slice(pos.start.offset, pos.end.offset);
        if (!raw.includes("|")) {
          cut = i;
          break;
        }
      }
      if (cut === -1) return;

      const stray = rows.slice(cut);
      table.children = rows.slice(0, cut);

      // A pipe-less row has a single cell; reuse its already-parsed inline
      // children (text, emphasis, links, …) as the paragraph body.
      const paragraphs = stray.map((row) => ({
        type: "paragraph",
        children: row.children?.[0]?.children ?? [{ type: "text", value: "" }],
      }));

      parent.children.splice(index + 1, 0, ...paragraphs);
      // Resume visiting past the table and the paragraphs we just inserted.
      return index + 1 + paragraphs.length;
    });
  };
}
