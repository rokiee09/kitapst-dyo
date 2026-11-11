import JSZip from "jszip";
import type { BlockStyle } from "@/types/domain";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

interface Spacing {
  before?: number;
  after?: number;
  line?: number;
  lineRule?: string;
}

interface IndentTwips {
  start?: number;
  end?: number;
  firstLine?: number;
  hanging?: number;
}

interface Props {
  align?: BlockStyle["align"];
  font?: string;
  fontSizePt?: number;
  spacing?: Spacing;
  indent?: IndentTwips;
}

interface RawStyle extends Props {
  basedOn?: string;
}

interface StyleTable {
  defaults: Props;
  paragraph: Map<string, RawStyle>;
  character: Map<string, RawStyle>;
}

interface ParagraphExtra {
  spacing?: Spacing;
}

interface WordNode {
  type?: string;
  children?: WordNode[];
  styleId?: string | null;
  styleName?: string | null;
  numbering?: unknown;
  alignment?: string | null;
  indent?: {
    start?: string | number | null;
    end?: string | number | null;
    firstLine?: string | number | null;
    hanging?: string | number | null;
  };
  breakType?: string;
  font?: string | null;
  fontSize?: number | null;
  isBold?: boolean;
  isItalic?: boolean;
  value?: string;
}

export interface WordLayout {
  styleMap: string[];
  transformDocument: (document: unknown) => unknown;
}

export async function readWordLayout(bytes: Uint8Array): Promise<WordLayout> {
  const zip = await JSZip.loadAsync(bytes);
  const styles = parseStyles((await zip.file("word/styles.xml")?.async("string")) ?? "");
  const extras = parseExtras((await zip.file("word/document.xml")?.async("string")) ?? "");
  const styleMap = [
    "p[style-name='Title'] => h1:fresh",
    "p[style-name='Subtitle'] => h2:fresh",
    "p[style-name='Quote'] => blockquote:fresh",
    "p[style-name='Alıntı'] => blockquote:fresh",
    "p[style-name='ks-page-break'] => hr.page:fresh",
    "r[style-name='Strong'] => strong",
    "r[style-name='Emphasis'] => em",
    "u => u",
    "strike => s",
  ];
  const paragraphStyles = new Map<string, string>();
  const runStyles = new Map<string, string>();
  let activeProps: Props = {};
  let useExtras = false;
  let extraCursor = 0;

  function styleNameFor(tag: string, css: string): string {
    const key = `${tag}|${css}`;
    const existing = paragraphStyles.get(key);
    if (existing) return existing;
    const name = `ks-${tag}-${paragraphStyles.size + 1}`;
    paragraphStyles.set(key, name);
    const styleAttr = css ? `[style='${css}']` : "";
    styleMap.push(`p[style-name='${name}'] => ${tag}${styleAttr}:fresh`);
    return name;
  }

  function runStyleName(css: string): string {
    const existing = runStyles.get(css);
    if (existing) return existing;
    const name = `ks-r-${runStyles.size + 1}`;
    runStyles.set(css, name);
    styleMap.push(`r[style-name='${name}'] => span[style='${css}']:fresh`);
    return name;
  }

  function takeExtra(): ParagraphExtra | undefined {
    const extra = useExtras ? extras[extraCursor] : undefined;
    extraCursor += 1;
    return extra;
  }

  function stampRun(run: WordNode): WordNode {
    const char = run.styleId ? resolveStyle(styles.character, run.styleId) : {};
    const font = run.font || char.font || activeProps.font;
    const sizePt =
      (typeof run.fontSize === "number" ? run.fontSize : undefined) ?? char.fontSizePt ?? activeProps.fontSizePt;
    const css = runCss(run, font, sizePt);
    if (!css) return run;
    const name = runStyleName(css);
    return {
      ...run,
      font: font ?? null,
      fontSize: sizePt ?? null,
      styleId: name,
      styleName: name,
    };
  }

  function splitRun(run: WordNode): Array<WordNode | "PAGE"> {
    const pieces: Array<WordNode | "PAGE"> = [];
    let bucket: WordNode[] = [];
    const flush = () => {
      if (!bucket.length) return;
      pieces.push(stampRun({ ...run, children: bucket }));
      bucket = [];
    };
    for (const child of run.children ?? []) {
      if (child.type === "break" && (child.breakType === "page" || child.breakType === "column")) {
        flush();
        pieces.push("PAGE");
      } else {
        bucket.push(child);
      }
    }
    flush();
    return pieces;
  }

  function splitContainer(node: WordNode): Array<WordNode | "PAGE"> {
    const pieces: Array<WordNode | "PAGE"> = [];
    let bucket: WordNode[] = [];
    const flush = () => {
      if (!bucket.length) return;
      pieces.push({ ...node, children: bucket });
      bucket = [];
    };
    for (const child of node.children ?? []) {
      for (const piece of splitNode(child)) {
        if (piece === "PAGE") {
          flush();
          pieces.push("PAGE");
        } else {
          bucket.push(piece);
        }
      }
    }
    flush();
    return pieces.length ? pieces : [{ ...node, children: [] }];
  }

  function splitNode(node: WordNode): Array<WordNode | "PAGE"> {
    if (node.type === "run") return splitRun(node);
    if (node.type === "break" && (node.breakType === "page" || node.breakType === "column")) return ["PAGE"];
    if (node.type === "hyperlink") return splitContainer(node);
    return [node];
  }

  function groupChildren(children: WordNode[]): Array<WordNode[] | "PAGE"> {
    const groups: Array<WordNode[] | "PAGE"> = [];
    let current: WordNode[] = [];
    const flush = () => {
      if (!current.length) return;
      groups.push(current);
      current = [];
    };
    for (const child of children) {
      for (const piece of splitNode(child)) {
        if (piece === "PAGE") {
          flush();
          groups.push("PAGE");
        } else {
          current.push(piece);
        }
      }
    }
    flush();
    return groups;
  }

  function styleParagraph(paragraph: WordNode, children: WordNode[], extra: ParagraphExtra | undefined, resolved: Props): WordNode {
    const next: WordNode = { ...paragraph, children };
    if (paragraph.numbering) return next;
    const align = mapAlign(paragraph.alignment) ?? resolved.align;
    const indent = combineIndent(paragraph.indent, resolved.indent);
    const spacing = mergeSpacing(resolved.spacing, extra?.spacing);
    const font = uniformFont(children);
    const css = paragraphCss({ align, indent, spacing, font });
    const level = headingLevel(paragraph.styleId, paragraph.styleName);
    const quote = isQuote(paragraph.styleId, paragraph.styleName);
    const title = !level && isTitle(paragraph.styleId, paragraph.styleName);
    const subtitle = !level && !title && isSubtitle(paragraph.styleId, paragraph.styleName);
    let tag = "p";
    if (quote) tag = "blockquote";
    else if (level) tag = `h${Math.min(level, 3)}`;
    else if (title) tag = "h1";
    else if (subtitle) tag = "h2";
    if (!css && tag === "p") return next;
    const name = styleNameFor(tag, css);
    return { ...next, styleId: name, styleName: name };
  }

  function expandParagraph(paragraph: WordNode): WordNode[] {
    const extra = takeExtra();
    const resolved = effectiveParagraph(styles, paragraph.styleId);
    const previous = activeProps;
    activeProps = resolved;
    const groups = groupChildren(paragraph.children ?? []);
    activeProps = previous;
    if (paragraph.numbering) {
      const children = groups.flatMap((group) => (group === "PAGE" ? [] : group));
      return [{ ...paragraph, children }];
    }
    const hasPage = groups.some((group) => group === "PAGE");
    if (!hasPage) {
      const only = groups[0];
      return [styleParagraph(paragraph, Array.isArray(only) ? only : [], extra, resolved)];
    }
    const out: WordNode[] = [];
    for (const group of groups) {
      if (group === "PAGE") out.push(pageBreakParagraph());
      else out.push(styleParagraph(paragraph, group, extra, resolved));
    }
    return out.length ? out : [styleParagraph(paragraph, [], extra, resolved)];
  }

  function mapChildren(children: WordNode[]): WordNode[] {
    const out: WordNode[] = [];
    for (const child of children) {
      if (child.type === "paragraph") out.push(...expandParagraph(child));
      else out.push(mapNode(child));
    }
    return out;
  }

  function mapNode(node: WordNode): WordNode {
    if (!node.children) return node;
    return { ...node, children: mapChildren(node.children) };
  }

  return {
    styleMap,
    transformDocument: (document: unknown) => {
      const doc = document as WordNode;
      extraCursor = 0;
      useExtras = countParagraphs(doc) === extras.length;
      return mapNode(doc);
    },
  };
}

function pageBreakParagraph(): WordNode {
  return {
    type: "paragraph",
    styleId: "ks-page-break",
    styleName: "ks-page-break",
    children: [],
    alignment: null,
    indent: { start: null, end: null, firstLine: null, hanging: null },
  };
}

function countParagraphs(node: WordNode | undefined): number {
  if (!node) return 0;
  let count = node.type === "paragraph" ? 1 : 0;
  for (const child of node.children ?? []) count += countParagraphs(child);
  return count;
}

function runCss(run: WordNode, font?: string, sizePt?: number): string {
  const parts: string[] = [];
  if (font) parts.push(`font-family:${fontCss(font)}`);
  if (sizePt) parts.push(`font-size:${pointsToPx(sizePt)}px`);
  const name = run.styleName ?? "";
  if (!run.isBold && /strong/i.test(name)) parts.push("font-weight:bold");
  if (!run.isItalic && /emphasis/i.test(name)) parts.push("font-style:italic");
  return parts.join(";");
}

function paragraphCss(input: {
  align?: BlockStyle["align"];
  indent: { marginLeft?: number; marginRight?: number; textIndent?: number };
  spacing?: Spacing;
  font?: { font?: string; sizePt?: number };
}): string {
  const parts: string[] = [];
  if (input.align && input.align !== "left") parts.push(`text-align:${input.align}`);
  if (input.indent.marginLeft) parts.push(`margin-left:${ptFromTwips(input.indent.marginLeft)}`);
  if (input.indent.marginRight) parts.push(`margin-right:${ptFromTwips(input.indent.marginRight)}`);
  if (input.indent.textIndent) parts.push(`text-indent:${ptFromTwips(input.indent.textIndent)}`);
  if (input.spacing?.before != null) parts.push(`margin-top:${ptFromTwips(input.spacing.before)}`);
  if (input.spacing?.after != null) parts.push(`margin-bottom:${ptFromTwips(input.spacing.after)}`);
  const lineHeight = lineHeightOf(input.spacing, input.font?.sizePt);
  if (lineHeight) parts.push(`line-height:${lineHeight}`);
  if (input.font?.font) parts.push(`font-family:${fontCss(input.font.font)}`);
  if (input.font?.sizePt) parts.push(`font-size:${pointsToPx(input.font.sizePt)}px`);
  return parts.join(";");
}

function uniformFont(children: WordNode[]): { font?: string; sizePt?: number } | undefined {
  const runs = collectRuns(children).filter(hasText);
  if (!runs.length) return;
  const first = lookOf(runs[0]);
  for (const run of runs.slice(1)) {
    const look = lookOf(run);
    if (look.font !== first.font || look.sizePt !== first.sizePt) return;
  }
  if (!first.font && first.sizePt == null) return;
  return first;
}

function lookOf(run: WordNode): { font?: string; sizePt?: number } {
  return {
    font: run.font || undefined,
    sizePt: typeof run.fontSize === "number" ? run.fontSize : undefined,
  };
}

function collectRuns(nodes: WordNode[]): WordNode[] {
  const out: WordNode[] = [];
  for (const node of nodes) {
    if (node.type === "run") out.push(node);
    if (node.children) out.push(...collectRuns(node.children));
  }
  return out;
}

function hasText(run: WordNode): boolean {
  return (run.children ?? []).some((child) => child.type === "text" && Boolean(child.value));
}

function combineIndent(
  direct: WordNode["indent"],
  fromStyle: IndentTwips | undefined,
): { marginLeft?: number; marginRight?: number; textIndent?: number } {
  const start = twip(direct?.start) ?? fromStyle?.start;
  const end = twip(direct?.end) ?? fromStyle?.end;
  const first = twip(direct?.firstLine) ?? fromStyle?.firstLine;
  const hanging = twip(direct?.hanging) ?? fromStyle?.hanging;
  if (hanging) {
    return { marginLeft: start ?? hanging, marginRight: end, textIndent: -hanging };
  }
  return { marginLeft: start, marginRight: end, textIndent: first };
}

function effectiveParagraph(styles: StyleTable, styleId: string | null | undefined): Props {
  return mergeProps(styles.defaults, resolveStyle(styles.paragraph, styleId));
}

function resolveStyle(map: Map<string, RawStyle>, id: string | null | undefined, seen = new Set<string>()): Props {
  if (!id || seen.has(id)) return {};
  const raw = map.get(id);
  if (!raw) return {};
  seen.add(id);
  const parent = raw.basedOn ? resolveStyle(map, raw.basedOn, seen) : {};
  return mergeProps(parent, raw);
}

function mergeProps(base: Props, extra: Props): Props {
  return {
    align: extra.align ?? base.align,
    font: extra.font ?? base.font,
    fontSizePt: extra.fontSizePt ?? base.fontSizePt,
    spacing: mergeSpacing(base.spacing, extra.spacing),
    indent: mergeIndent(base.indent, extra.indent),
  };
}

function mergeSpacing(base?: Spacing, extra?: Spacing): Spacing | undefined {
  if (!base && !extra) return;
  return {
    before: extra?.before ?? base?.before,
    after: extra?.after ?? base?.after,
    line: extra?.line ?? base?.line,
    lineRule: extra?.lineRule ?? base?.lineRule,
  };
}

function mergeIndent(base?: IndentTwips, extra?: IndentTwips): IndentTwips | undefined {
  if (!base && !extra) return;
  return {
    start: extra?.start ?? base?.start,
    end: extra?.end ?? base?.end,
    firstLine: extra?.firstLine ?? base?.firstLine,
    hanging: extra?.hanging ?? base?.hanging,
  };
}

function parseStyles(xml: string): StyleTable {
  const table: StyleTable = { defaults: {}, paragraph: new Map(), character: new Map() };
  const doc = parseXml(xml);
  if (!doc) return table;
  const defaults = firstDesc(doc, "docDefaults");
  if (defaults) {
    const rPr = firstChild(firstChild(defaults, "rPrDefault"), "rPr");
    const pPr = firstChild(firstChild(defaults, "pPrDefault"), "pPr");
    table.defaults = mergeProps(readPPr(pPr), readRPr(rPr));
  }
  for (const styleEl of allDesc(doc, "style")) {
    const type = attr(styleEl, "type");
    const id = attr(styleEl, "styleId");
    if (!id || (type !== "paragraph" && type !== "character")) continue;
    const raw: RawStyle = {
      basedOn: attr(firstChild(styleEl, "basedOn"), "val"),
      ...readPPr(firstChild(styleEl, "pPr")),
      ...readRPr(firstChild(styleEl, "rPr")),
    };
    const bucket = type === "character" ? table.character : table.paragraph;
    bucket.set(id, raw);
  }
  return table;
}

function parseExtras(xml: string): ParagraphExtra[] {
  const doc = parseXml(xml);
  if (!doc) return [];
  return allDesc(doc, "p").map((paragraph) => {
    const spacingEl = firstChild(firstChild(paragraph, "pPr"), "spacing");
    if (!spacingEl) return {};
    return {
      spacing: {
        before: num(attr(spacingEl, "before")),
        after: num(attr(spacingEl, "after")),
        line: num(attr(spacingEl, "line")),
        lineRule: attr(spacingEl, "lineRule"),
      },
    };
  });
}

function readPPr(pPr: Element | null): Props {
  if (!pPr) return {};
  const spacingEl = firstChild(pPr, "spacing");
  const indentEl = firstChild(pPr, "ind");
  return {
    align: mapAlign(attr(firstChild(pPr, "jc"), "val")),
    spacing: spacingEl
      ? {
          before: num(attr(spacingEl, "before")),
          after: num(attr(spacingEl, "after")),
          line: num(attr(spacingEl, "line")),
          lineRule: attr(spacingEl, "lineRule"),
        }
      : undefined,
    indent: indentEl
      ? {
          start: num(attr(indentEl, "start") ?? attr(indentEl, "left")),
          end: num(attr(indentEl, "end") ?? attr(indentEl, "right")),
          firstLine: num(attr(indentEl, "firstLine")),
          hanging: num(attr(indentEl, "hanging")),
        }
      : undefined,
  };
}

function readRPr(rPr: Element | null): Props {
  if (!rPr) return {};
  const fonts = firstChild(rPr, "rFonts");
  const sz = num(attr(firstChild(rPr, "sz"), "val"));
  return {
    font: attr(fonts, "ascii") || attr(fonts, "hAnsi") || themeFont(attr(fonts, "asciiTheme") || attr(fonts, "hAnsiTheme")),
    fontSizePt: sz != null ? sz / 2 : undefined,
  };
}

function themeFont(theme: string | undefined): string | undefined {
  if (theme === "minorHAnsi" || theme === "minorAscii") return "Calibri";
  if (theme === "majorHAnsi" || theme === "majorAscii") return "Calibri Light";
  return;
}

function parseXml(xml: string): Document | null {
  if (!xml.trim() || typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return null;
  return doc;
}

function firstDesc(el: Document | Element, name: string): Element | null {
  for (const node of Array.from(el.getElementsByTagName("*"))) {
    if (node.localName === name) return node;
  }
  return null;
}

function allDesc(el: Document | Element, name: string): Element[] {
  return Array.from(el.getElementsByTagName("*")).filter((node) => node.localName === name);
}

function firstChild(el: Element | null, name: string): Element | null {
  if (!el) return null;
  for (const node of Array.from(el.children)) {
    if (node.localName === name) return node;
  }
  return null;
}

function attr(el: Element | null, name: string): string | undefined {
  if (!el) return;
  return el.getAttributeNS(W_NS, name) || el.getAttribute(`w:${name}`) || el.getAttribute(name) || undefined;
}

function num(value: string | undefined): number | undefined {
  if (value == null || value === "") return;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function twip(value: string | number | null | undefined): number | undefined {
  if (value == null || value === "") return;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapAlign(value: unknown): BlockStyle["align"] | undefined {
  if (typeof value !== "string" || !value) return;
  const normalized = value.toLowerCase();
  if (normalized === "center") return "center";
  if (normalized === "right" || normalized === "end") return "right";
  if (normalized === "both" || normalized === "justify" || normalized === "distribute") return "justify";
  if (normalized === "left" || normalized === "start") return "left";
  return;
}

function headingLevel(styleId?: string | null, styleName?: string | null): number | null {
  for (const source of [styleId, styleName]) {
    if (!source) continue;
    const match = source.match(/heading\s*([1-6])/i) || source.match(/ba[sş]l[ıi]k\s*([1-6])/i);
    if (match) return Number(match[1]);
  }
  return null;
}

function isTitle(styleId?: string | null, styleName?: string | null): boolean {
  return [styleId, styleName].some((value) => !!value && /^(title|ba[sş]l[ıi]k)$/i.test(value.trim()));
}

function isSubtitle(styleId?: string | null, styleName?: string | null): boolean {
  return [styleId, styleName].some((value) => !!value && /subtitle|alt\s*ba[sş]l[ıi]k/i.test(value));
}

function isQuote(styleId?: string | null, styleName?: string | null): boolean {
  return [styleId, styleName].some((value) => !!value && /quote|al[ıi]nt[ıi]|citation/i.test(value));
}

function fontCss(name: string): string {
  const cleaned = name.replace(/['";]/g, "").trim();
  if (!cleaned) return "sans-serif";
  const generic = /mono|courier|consolas/i.test(cleaned)
    ? "monospace"
    : /times|georgia|garamond|cambria|palatino|liberation serif|book antiqua/i.test(cleaned)
      ? "serif"
      : "sans-serif";
  const quoted = /\s/.test(cleaned) ? `"${cleaned}"` : cleaned;
  return `${quoted},${generic}`;
}

function pointsToPx(points: number): number {
  return Math.round(points * (96 / 72));
}

function ptFromTwips(twips: number): string {
  const points = Math.round((twips / 20) * 100) / 100;
  return `${points}pt`;
}

function lineHeightOf(spacing: Spacing | undefined, fontPt: number | undefined): number | undefined {
  if (!spacing?.line) return;
  const rule = spacing.lineRule || "auto";
  if (rule === "auto") return Math.round((spacing.line / 240) * 100) / 100;
  const linePt = spacing.line / 20;
  return Math.round((linePt / (fontPt || 11)) * 100) / 100;
}
