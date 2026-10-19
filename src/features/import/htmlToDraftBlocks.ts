import type { JSONContent } from "@tiptap/react";
import type { BlockStyle, BlockType } from "@/types/domain";

export interface DraftBlock {
  type: BlockType;
  data: unknown;
  style?: BlockStyle;
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
        return headingBlock(level, [textNode(heading[2])], "left");
      }
      return paragraphBlock(
        chunk
          .split("\n")
          .map((line, index) => {
            const nodes: JSONContent[] = [];
            if (index > 0) nodes.push({ type: "hardBreak" });
            nodes.push(textNode(line));
            return nodes;
          })
          .flat(),
        "left",
      );
    });
}

function pushNode(node: ChildNode, out: DraftBlock[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    if (text) out.push(paragraphBlock([textNode(text)], "left"));
    return;
  }
  if (!(node instanceof HTMLElement)) return;
  const tag = node.tagName.toLowerCase();
  const align = readAlign(node);
  if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
    const level = Math.min(3, Number(tag.slice(1)) || 2) as 1 | 2 | 3;
    out.push(headingBlock(level, inlineFrom(node), align));
    return;
  }
  if (tag === "p") {
    const images = Array.from(node.querySelectorAll(":scope > img")).filter(
      (item): item is HTMLImageElement => item instanceof HTMLImageElement,
    );
    for (const img of images) pushImage(img, out, align);
    const content = inlineFrom(node);
    if (content.length) out.push(paragraphBlock(content, align));
    return;
  }
  if (tag === "blockquote") {
    out.push({
      type: "quote",
      style: { align },
      data: {
        attribution: "",
        content: {
          type: "doc",
          content: [
            {
              type: "blockquote",
              content: [{ type: "paragraph", attrs: { textAlign: align }, content: inlineFrom(node) }],
            },
          ],
        },
      },
    });
    return;
  }
  if (tag === "ul") {
    out.push(listBlock("unorderedList", "bulletList", node, align));
    return;
  }
  if (tag === "ol") {
    out.push(listBlock("orderedList", "orderedList", node, align));
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
  if (tag === "img") {
    pushImage(node as HTMLImageElement, out, align);
    return;
  }
  for (const child of Array.from(node.childNodes)) pushNode(child, out);
}

function pushImage(img: HTMLImageElement, out: DraftBlock[], align: BlockStyle["align"]) {
  const src = img.getAttribute("src") || "";
  if (!src) return;
  const widthAttr = img.getAttribute("width");
  const width = widthAttr ? Math.min(100, Math.max(8, Math.round((Number(widthAttr) / 600) * 100) || 100)) : 100;
  out.push({
    type: "image",
    style: { align },
    data: {
      assetId: null,
      relativePath: null,
      dataUrl: src.startsWith("data:") ? src : null,
      alt: img.getAttribute("alt") || "",
      caption: img.getAttribute("alt") || "",
      captionCustom: false,
      captionVisible: true,
      description: "",
      width,
      align: align === "justify" ? "center" : align ?? "center",
      borderRadius: 0,
      showInEpub: true,
      showInPdf: true,
      showInHtml: true,
    },
  });
}

function listBlock(
  type: "orderedList" | "unorderedList",
  listType: "orderedList" | "bulletList",
  node: HTMLElement,
  align: BlockStyle["align"],
): DraftBlock {
  const items = Array.from(node.querySelectorAll(":scope > li")).map((item) => ({
    type: "listItem",
    content: [{ type: "paragraph", attrs: { textAlign: align }, content: inlineFrom(item) }],
  }));
  return {
    type,
    style: { align },
    data: {
      content: {
        type: "doc",
        content: [
          {
            type: listType,
            content: items.length ? items : [{ type: "listItem", content: [{ type: "paragraph" }] }],
          },
        ],
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

function headingBlock(level: 1 | 2 | 3, content: JSONContent[], align: BlockStyle["align"]): DraftBlock {
  return {
    type: "heading",
    style: { align },
    data: {
      level,
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level, textAlign: align ?? "left" },
            content: content.length ? content : undefined,
          },
        ],
      },
    },
  };
}

function paragraphBlock(content: JSONContent[], align: BlockStyle["align"]): DraftBlock {
  return {
    type: "paragraph",
    style: { align },
    data: {
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            attrs: { textAlign: align ?? "left" },
            content: content.length ? content : undefined,
          },
        ],
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
    if (tag === "img") continue;
    if (tag === "a") {
      const href = child.getAttribute("href") || "";
      const marks = href.startsWith("http") ? [{ type: "link", attrs: { href } }] : undefined;
      const inner = inlineFrom(child);
      if (inner.length === 0) {
        const text = child.textContent ?? "";
        if (text) out.push({ type: "text", text, marks });
        continue;
      }
      for (const piece of inner) {
        if (piece.type === "text" && marks) {
          out.push({ ...piece, marks: [...(piece.marks ?? []), ...marks] });
        } else {
          out.push(piece);
        }
      }
      continue;
    }
    const nested = inlineFrom(child);
    const extra = marksFrom(child) ?? [];
    if (nested.length === 0) {
      const text = child.textContent ?? "";
      if (text) out.push({ type: "text", text, marks: extra.length ? extra : undefined });
      continue;
    }
    for (const piece of nested) {
      if (piece.type === "text" && extra.length) {
        out.push({ ...piece, marks: mergeMarks(piece.marks, extra) });
      } else {
        out.push(piece);
      }
    }
  }
  return out;
}

function marksFrom(el: HTMLElement): NonNullable<JSONContent["marks"]> {
  const tag = el.tagName.toLowerCase();
  const marks: NonNullable<JSONContent["marks"]> = [];
  if (tag === "strong" || tag === "b") marks.push({ type: "bold" });
  if (tag === "em" || tag === "i") marks.push({ type: "italic" });
  if (tag === "u") marks.push({ type: "underline" });
  if (tag === "s" || tag === "strike" || tag === "del") marks.push({ type: "strike" });
  const style = el.getAttribute("style") ?? "";
  if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(style)) marks.push({ type: "bold" });
  if (/font-style\s*:\s*italic/i.test(style)) marks.push({ type: "italic" });
  if (/text-decoration[^;]*underline/i.test(style)) marks.push({ type: "underline" });
  const color = style.match(/color\s*:\s*([^;]+)/i)?.[1]?.trim();
  if (color && color !== "inherit") {
    marks.push({ type: "textStyle", attrs: { color } });
  }
  const size = style.match(/font-size\s*:\s*([^;]+)/i)?.[1]?.trim();
  if (size) {
    const px = cssSizeToPx(size);
    if (px) marks.push({ type: "textStyle", attrs: { fontSize: `${px}px` } });
  }
  return marks;
}

function mergeMarks(
  existing: JSONContent["marks"] | undefined,
  extra: JSONContent["marks"] | undefined,
): JSONContent["marks"] {
  const list = [...(existing ?? []), ...(extra ?? [])];
  const textStyle = list.filter((mark) => mark.type === "textStyle");
  const others = list.filter((mark) => mark.type !== "textStyle");
  if (textStyle.length === 0) return others;
  const attrs = Object.assign({}, ...textStyle.map((mark) => mark.attrs ?? {}));
  return [...others, { type: "textStyle", attrs }];
}

function cssSizeToPx(value: string): number | null {
  const pt = value.match(/^([\d.]+)\s*pt$/i);
  if (pt) return Math.round(Number(pt[1]) * (96 / 72));
  const px = value.match(/^([\d.]+)\s*px$/i);
  if (px) return Math.round(Number(px[1]));
  return null;
}

function readAlign(el: HTMLElement): BlockStyle["align"] {
  const style = `${el.getAttribute("style") ?? ""} ${el.getAttribute("align") ?? ""} ${el.className}`;
  if (/text-align\s*:\s*justify|align=["']?justify|justify/i.test(style)) return "justify";
  if (/text-align\s*:\s*center|align=["']?center|\.center|align-center/i.test(style)) return "center";
  if (/text-align\s*:\s*right|align=["']?right|align-right/i.test(style)) return "right";
  if (/text-align\s*:\s*left|align=["']?left/i.test(style)) return "left";
  return "left";
}

function textNode(text: string): JSONContent {
  return { type: "text", text };
}

function isEmptyDraft(item: DraftBlock): boolean {
  if (item.type === "divider" || item.type === "image") return false;
  if (item.type === "table") {
    const rows = (item.data as { rows?: string[][] }).rows ?? [];
    return rows.every((row) => row.every((cell) => !cell.trim()));
  }
  return !JSON.stringify(item.data).match(/"text":"[^"]+/);
}
