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
        return headingBlock(level, [textNode(heading[2])], { align: "left" });
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
        { align: "left" },
      );
    });
}

function pushNode(node: ChildNode, out: DraftBlock[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    if (text) out.push(paragraphBlock([textNode(text)], { align: "left" }));
    return;
  }
  if (!(node instanceof HTMLElement)) return;
  const tag = node.tagName.toLowerCase();
  const layout = readLayout(node);
  const align = layout.align ?? "left";
  if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
    const level = Math.min(3, Number(tag.slice(1)) || 2) as 1 | 2 | 3;
    out.push(headingBlock(level, inlineFrom(node), layout));
    return;
  }
  if (tag === "p") {
    const images = Array.from(node.querySelectorAll(":scope > img")).filter(
      (item): item is HTMLImageElement => item instanceof HTMLImageElement,
    );
    for (const img of images) pushImage(img, out, align);
    const content = inlineFrom(node);
    if (content.length) out.push(paragraphBlock(content, layout));
    else if (!images.length) out.push(paragraphBlock([textNode("\u00a0")], layout));
    return;
  }
  if (tag === "blockquote") {
    out.push({
      type: "quote",
      style: pickStyle(layout),
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
    out.push(listBlock("unorderedList", node));
    return;
  }
  if (tag === "ol") {
    out.push(listBlock("orderedList", node));
    return;
  }
  if (tag === "table") {
    out.push(tableBlock(node));
    return;
  }
  if (tag === "hr") {
    if (node.classList.contains("page")) out.push({ type: "pageBreak", data: {} });
    else out.push({ type: "divider", data: { style: "solid" } });
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

function listBlock(type: "orderedList" | "unorderedList", node: HTMLElement): DraftBlock {
  const layout = readLayout(node);
  const align = layout.align ?? "left";
  return {
    type,
    style: pickStyle(layout),
    data: {
      content: {
        type: "doc",
        content: [listNode(node, align)],
      },
    },
  };
}

function listNode(node: HTMLElement, align: BlockStyle["align"]): JSONContent {
  const listType = node.tagName.toLowerCase() === "ol" ? "orderedList" : "bulletList";
  const items = Array.from(node.querySelectorAll(":scope > li")).map((item) => ({
    type: "listItem",
    content: listItemContent(item, align),
  }));
  return {
    type: listType,
    content: items.length ? items : [{ type: "listItem", content: [{ type: "paragraph" }] }],
  };
}

function listItemContent(item: Element, align: BlockStyle["align"]): JSONContent[] {
  const blocks: JSONContent[] = [];
  let inline: JSONContent[] = [];
  const flush = () => {
    if (!inline.length) return;
    blocks.push({ type: "paragraph", attrs: { textAlign: align ?? "left" }, content: inline });
    inline = [];
  };
  for (const child of Array.from(item.childNodes)) {
    if (child instanceof HTMLElement && (child.tagName === "UL" || child.tagName === "OL")) {
      flush();
      blocks.push(listNode(child, align));
      continue;
    }
    if (child instanceof HTMLElement && child.tagName === "P") {
      flush();
      const content = inlineFrom(child);
      blocks.push({
        type: "paragraph",
        attrs: { textAlign: align ?? "left" },
        content: content.length ? content : undefined,
      });
      continue;
    }
    inline.push(...renderInline(child));
  }
  flush();
  if (!blocks.length) blocks.push({ type: "paragraph" });
  return blocks;
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

function headingBlock(level: 1 | 2 | 3, content: JSONContent[], layout: Partial<BlockStyle>): DraftBlock {
  const align = layout.align ?? "left";
  return {
    type: "heading",
    style: pickStyle({ ...layout, align }),
    data: {
      level,
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level, textAlign: align },
            content: content.length ? content : undefined,
          },
        ],
      },
    },
  };
}

function paragraphBlock(content: JSONContent[], layout: Partial<BlockStyle>): DraftBlock {
  const align = layout.align ?? "left";
  return {
    type: "paragraph",
    style: pickStyle({ ...layout, align }),
    data: {
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            attrs: { textAlign: align },
            content: content.length ? content : undefined,
          },
        ],
      },
    },
  };
}

function inlineFrom(el: Node): JSONContent[] {
  const out: JSONContent[] = [];
  for (const child of Array.from(el.childNodes)) out.push(...renderInline(child));
  return out;
}

function renderInline(child: ChildNode): JSONContent[] {
  if (child.nodeType === Node.TEXT_NODE) {
    const text = child.textContent ?? "";
    return text ? [textNode(text)] : [];
  }
  if (!(child instanceof HTMLElement)) return [];
  const tag = child.tagName.toLowerCase();
  if (tag === "br") return [{ type: "hardBreak" }];
  if (tag === "img" || tag === "ul" || tag === "ol") return [];
  if (tag === "a") return renderLink(child);
  return applyMarks(child, inlineFrom(child));
}

function renderLink(el: HTMLElement): JSONContent[] {
  const href = el.getAttribute("href") || "";
  const marks = href.startsWith("http") ? [{ type: "link", attrs: { href } }] : undefined;
  const inner = inlineFrom(el);
  if (inner.length === 0) {
    const text = el.textContent ?? "";
    return text ? [{ type: "text", text, marks }] : [];
  }
  if (!marks) return inner;
  return inner.map((piece) =>
    piece.type === "text" ? { ...piece, marks: [...(piece.marks ?? []), ...marks] } : piece,
  );
}

function applyMarks(el: HTMLElement, nested: JSONContent[]): JSONContent[] {
  const extra = marksFrom(el);
  if (nested.length === 0) {
    const text = el.textContent ?? "";
    if (!text) return [];
    return [{ type: "text", text, marks: extra.length ? extra : undefined }];
  }
  if (!extra.length) return nested;
  return nested.map((piece) =>
    piece.type === "text" ? { ...piece, marks: mergeMarks(piece.marks, extra) } : piece,
  );
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
  const family = style.match(/font-family\s*:\s*([^;]+)/i)?.[1]?.trim();
  if (family) marks.push({ type: "textStyle", attrs: { fontFamily: family } });
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
  const match = value.trim().match(/^(-?[\d.]+)\s*(pt|px)?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (Number.isNaN(amount)) return null;
  if ((match[2] ?? "px").toLowerCase() === "pt") return Math.round(amount * (96 / 72));
  return Math.round(amount);
}

function readLayout(el: HTMLElement): Partial<BlockStyle> {
  const style = el.getAttribute("style") ?? "";
  const layout: Partial<BlockStyle> = { align: readAlign(el) };
  const family = cssValue(style, "font-family");
  if (family) layout.fontFamily = family;
  const size = cssValue(style, "font-size");
  const px = size ? cssSizeToPx(size) : null;
  if (px) layout.fontSize = px;
  const marginLeft = cssValue(style, "margin-left");
  if (marginLeft) {
    const parsed = cssSizeToPx(marginLeft);
    if (parsed != null) layout.marginLeft = parsed;
  }
  const marginRight = cssValue(style, "margin-right");
  if (marginRight) {
    const parsed = cssSizeToPx(marginRight);
    if (parsed != null) layout.marginRight = parsed;
  }
  const textIndent = cssValue(style, "text-indent");
  if (textIndent) {
    const parsed = cssSizeToPx(textIndent);
    if (parsed != null) layout.textIndent = parsed;
  }
  const marginTop = cssValue(style, "margin-top");
  if (marginTop) {
    const parsed = cssSizeToPx(marginTop);
    if (parsed != null) layout.marginTop = parsed;
  }
  const marginBottom = cssValue(style, "margin-bottom");
  if (marginBottom) {
    const parsed = cssSizeToPx(marginBottom);
    if (parsed != null) layout.marginBottom = parsed;
  }
  const lineHeight = cssValue(style, "line-height");
  if (lineHeight && /^[\d.]+$/.test(lineHeight)) layout.lineHeight = Number(lineHeight);
  else if (lineHeight && /^[\d.]+%$/.test(lineHeight)) layout.lineHeight = Number(lineHeight.replace("%", "")) / 100;
  return layout;
}

function cssValue(style: string, prop: string): string | undefined {
  const match = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i"));
  return match?.[1]?.trim();
}

function pickStyle(layout: Partial<BlockStyle>): BlockStyle {
  const style: BlockStyle = {};
  if (layout.align) style.align = layout.align;
  if (layout.fontFamily) style.fontFamily = layout.fontFamily;
  if (layout.fontSize != null) style.fontSize = layout.fontSize;
  if (layout.lineHeight != null) style.lineHeight = layout.lineHeight;
  if (layout.marginLeft != null) style.marginLeft = layout.marginLeft;
  if (layout.marginRight != null) style.marginRight = layout.marginRight;
  if (layout.textIndent != null) style.textIndent = layout.textIndent;
  if (layout.marginTop != null) style.marginTop = layout.marginTop;
  if (layout.marginBottom != null) style.marginBottom = layout.marginBottom;
  return style;
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
  if (item.type === "divider" || item.type === "image" || item.type === "pageBreak") return false;
  if (item.type === "table") {
    const rows = (item.data as { rows?: string[][] }).rows ?? [];
    return rows.every((row) => row.every((cell) => !cell.trim()));
  }
  return !JSON.stringify(item.data).match(/"text":"[^"]+/);
}
