import type { JSONContent } from "@tiptap/react";
import type { BlockType } from "@/types/domain";

export interface DraftBlock {
  type: BlockType;
  data: unknown;
}

export function htmlToDraftBlocks(html: string): DraftBlock[] {
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return [];
  const out: DraftBlock[] = [];
  for (const node of Array.from(root.childNodes)) {
    pushNode(node, out);
  }
  return out.filter((item) => !isEmptyDraft(item));
}

export function plainTextToDraftBlocks(text: string): DraftBlock[] {
  return text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const heading = chunk.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        const level = Math.min(3, heading[1].length) as 1 | 2 | 3;
        return headingBlock(level, [textNode(heading[2])]);
      }
      return paragraphBlock(chunk.split("\n").map((line, index) => {
        const nodes: JSONContent[] = [];
        if (index > 0) nodes.push({ type: "hardBreak" });
        nodes.push(textNode(line));
        return nodes;
      }).flat());
    });
}

function pushNode(node: ChildNode, out: DraftBlock[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    if (text) out.push(paragraphBlock([textNode(text)]));
    return;
  }
  if (!(node instanceof HTMLElement)) return;
  const tag = node.tagName.toLowerCase();
  if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
    const level = Math.min(3, Number(tag.slice(1)) || 2) as 1 | 2 | 3;
    out.push(headingBlock(level, inlineFrom(node)));
    return;
  }
  if (tag === "p") {
    out.push(paragraphBlock(inlineFrom(node)));
    return;
  }
  if (tag === "blockquote") {
    out.push({
      type: "quote",
      data: {
        attribution: "",
        content: {
          type: "doc",
          content: [
            {
              type: "blockquote",
              content: [{ type: "paragraph", content: inlineFrom(node) }],
            },
          ],
        },
      },
    });
    return;
  }
  if (tag === "ul") {
    out.push(listBlock("unorderedList", "bulletList", node));
    return;
  }
  if (tag === "ol") {
    out.push(listBlock("orderedList", "orderedList", node));
    return;
  }
  if (tag === "table") {
    out.push(tableBlock(node));
    return;
  }
  if (tag === "hr") {
    out.push({ type: "divider", data: { style: "solid" } });
    return;
  }
  if (tag === "img") return;
  for (const child of Array.from(node.childNodes)) pushNode(child, out);
}

function listBlock(type: "orderedList" | "unorderedList", listType: "orderedList" | "bulletList", node: HTMLElement): DraftBlock {
  const items = Array.from(node.querySelectorAll(":scope > li")).map((item) => ({
    type: "listItem",
    content: [{ type: "paragraph", content: inlineFrom(item) }],
  }));
  return {
    type,
    data: {
      content: {
        type: "doc",
        content: [{ type: listType, content: items.length ? items : [{ type: "listItem", content: [{ type: "paragraph" }] }] }],
      },
    },
  };
}

function tableBlock(table: HTMLElement): DraftBlock {
  const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
    Array.from(row.querySelectorAll("th,td")).map((cell) => cell.textContent?.trim() ?? ""),
  );
  return {
    type: "table",
    data: { rows: rows.length ? rows : [["", ""], ["", ""]] },
  };
}

function headingBlock(level: 1 | 2 | 3, content: JSONContent[]): DraftBlock {
  return {
    type: "heading",
    data: {
      level,
      content: {
        type: "doc",
        content: [{ type: "heading", attrs: { level }, content: content.length ? content : undefined }],
      },
    },
  };
}

function paragraphBlock(content: JSONContent[]): DraftBlock {
  return {
    type: "paragraph",
    data: {
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: content.length ? content : undefined }],
      },
    },
  };
}

function inlineFrom(el: Node): JSONContent[] {
  const out: JSONContent[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      if (text) out.push(textNode(text));
      continue;
    }
    if (!(child instanceof HTMLElement)) continue;
    const tag = child.tagName.toLowerCase();
    if (tag === "br") {
      out.push({ type: "hardBreak" });
      continue;
    }
    if (tag === "a") {
      const href = child.getAttribute("href") || "";
      const marks = href.startsWith("http") ? [{ type: "link", attrs: { href } }] : undefined;
      const inner = child.textContent ?? "";
      if (inner) out.push({ type: "text", text: inner, marks });
      continue;
    }
    const marks: { type: string }[] = [];
    if (tag === "strong" || tag === "b") marks.push({ type: "bold" });
    if (tag === "em" || tag === "i") marks.push({ type: "italic" });
    if (tag === "u") marks.push({ type: "underline" });
    const nested = inlineFrom(child);
    for (const piece of nested) {
      if (piece.type === "text" && marks.length) {
        out.push({ ...piece, marks: [...(piece.marks ?? []), ...marks] });
      } else {
        out.push(piece);
      }
    }
  }
  return out;
}

function textNode(text: string): JSONContent {
  return { type: "text", text };
}

function isEmptyDraft(item: DraftBlock): boolean {
  if (item.type === "divider") return false;
  if (item.type === "table") {
    const rows = (item.data as { rows?: string[][] }).rows ?? [];
    return rows.every((row) => row.every((cell) => !cell.trim()));
  }
  return !JSON.stringify(item.data).match(/"text":"[^"]+/);
}
