import JSZip from "jszip";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
/** EMU → CSS px @ 96 dpi */
export const EMU_PER_PX = 9525;
/** twip → mm */
export const TWIP_PER_MM = 1440 / 25.4;

export interface ThemeFonts {
  major: string;
  minor: string;
}

export interface DocxPageSetup {
  widthMm: number;
  heightMm: number;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  columns?: number;
}

export interface DocxImageMeta {
  widthPx: number;
  heightPx: number;
  inline: boolean;
  wrap: "inline" | "square" | "tight" | "through" | "topAndBottom" | "behind" | "inFront";
  relId?: string;
}

export interface DocxTableCellMeta {
  text: string;
  colspan: number;
  rowspan: number;
  vMerge?: "restart" | "continue";
  borders: { top?: string; right?: string; bottom?: string; left?: string };
}

export interface DocxTableMeta {
  columnWidthsPct: number[];
  rows: DocxTableCellMeta[][];
  borders: boolean;
}

export interface DocxMeta {
  theme: ThemeFonts;
  page: DocxPageSetup | null;
  images: DocxImageMeta[];
  tables: DocxTableMeta[];
}

const DEFAULT_THEME: ThemeFonts = { major: "Calibri Light", minor: "Calibri" };

export async function readDocxMeta(bytes: Uint8Array): Promise<DocxMeta> {
  const zip = await JSZip.loadAsync(bytes);
  const theme = parseTheme((await zip.file("word/theme/theme1.xml")?.async("string")) ?? "");
  const documentXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  const doc = parseXml(documentXml);
  return {
    theme,
    page: doc ? parsePageSetup(doc) : null,
    images: doc ? parseImages(doc) : [],
    tables: doc ? parseTables(doc) : [],
  };
}

export function resolveThemeFont(theme: ThemeFonts, token: string | undefined): string | undefined {
  if (!token) return;
  if (token === "minorHAnsi" || token === "minorAscii" || token === "minorEastAsia" || token === "minorBidi") {
    return theme.minor;
  }
  if (token === "majorHAnsi" || token === "majorAscii" || token === "majorEastAsia" || token === "majorBidi") {
    return theme.major;
  }
  return;
}

export function emuToPx(emu: number): number {
  return Math.max(1, Math.round(emu / EMU_PER_PX));
}

export function twipsToMm(twips: number): number {
  return Math.round((twips / TWIP_PER_MM) * 100) / 100;
}

function parseTheme(xml: string): ThemeFonts {
  const doc = parseXml(xml);
  if (!doc) return { ...DEFAULT_THEME };
  const scheme = firstDesc(doc, "fontScheme");
  if (!scheme) return { ...DEFAULT_THEME };
  const major = typefaceOf(firstChild(scheme, "majorFont"));
  const minor = typefaceOf(firstChild(scheme, "minorFont"));
  return {
    major: major || DEFAULT_THEME.major,
    minor: minor || DEFAULT_THEME.minor,
  };
}

function typefaceOf(fontEl: Element | null): string | undefined {
  if (!fontEl) return;
  const latin = firstChild(fontEl, "latin");
  return attrAny(latin, "typeface");
}

function parsePageSetup(doc: Document): DocxPageSetup | null {
  const sect = lastDesc(doc, "sectPr") ?? firstDesc(doc, "sectPr");
  if (!sect) return null;
  const pgSz = firstChild(sect, "pgSz");
  const pgMar = firstChild(sect, "pgMar");
  const cols = firstChild(sect, "cols");
  const widthTw = num(attr(pgSz, "w")) ?? 11906;
  const heightTw = num(attr(pgSz, "h")) ?? 16838;
  return {
    widthMm: twipsToMm(widthTw),
    heightMm: twipsToMm(heightTw),
    marginTopMm: twipsToMm(num(attr(pgMar, "top")) ?? 1440),
    marginRightMm: twipsToMm(num(attr(pgMar, "right")) ?? 1440),
    marginBottomMm: twipsToMm(num(attr(pgMar, "bottom")) ?? 1440),
    marginLeftMm: twipsToMm(num(attr(pgMar, "left")) ?? 1440),
    columns: Math.max(1, num(attr(cols, "num")) ?? 1),
  };
}

function parseImages(doc: Document): DocxImageMeta[] {
  const out: DocxImageMeta[] = [];
  for (const drawing of allDesc(doc, "drawing")) {
    const inline = firstDesc(drawing, "inline");
    const anchor = firstDesc(drawing, "anchor");
    const host = inline ?? anchor;
    if (!host) continue;
    const extent = firstChild(host, "extent") ?? firstDesc(host, "extent");
    const cx = num(attrAny(extent, "cx")) ?? 0;
    const cy = num(attrAny(extent, "cy")) ?? 0;
    const wrap = wrapOf(host, Boolean(inline));
    const blip = firstDesc(drawing, "blip");
    const relId =
      attrAny(blip, "embed") ||
      blip?.getAttribute("r:embed") ||
      blip?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed") ||
      undefined;
    out.push({
      widthPx: emuToPx(cx || EMU_PER_PX * 200),
      heightPx: emuToPx(cy || EMU_PER_PX * 120),
      inline: Boolean(inline) || wrap === "inline",
      wrap,
      relId,
    });
  }
  return out;
}

function wrapOf(host: Element, isInline: boolean): DocxImageMeta["wrap"] {
  if (isInline) return "inline";
  if (firstChild(host, "wrapNone") || firstDesc(host, "wrapNone")) {
    const behind = attrAny(host, "behindDoc");
    return behind === "1" || behind === "true" ? "behind" : "inFront";
  }
  if (firstChild(host, "wrapSquare") || firstDesc(host, "wrapSquare")) return "square";
  if (firstChild(host, "wrapTight") || firstDesc(host, "wrapTight")) return "tight";
  if (firstChild(host, "wrapThrough") || firstDesc(host, "wrapThrough")) return "through";
  if (firstChild(host, "wrapTopAndBottom") || firstDesc(host, "wrapTopAndBottom")) return "topAndBottom";
  return "inFront";
}

function parseTables(doc: Document): DocxTableMeta[] {
  return allDesc(doc, "tbl").map((tbl) => {
    const grid = firstChild(tbl, "tblGrid");
    const cols = grid
      ? Array.from(grid.children)
          .filter((el) => el.localName === "gridCol")
          .map((el) => num(attr(el, "w")) ?? 0)
      : [];
    const total = cols.reduce((sum, w) => sum + w, 0) || 1;
    const columnWidthsPct = cols.map((w) => Math.round((w / total) * 1000) / 10);
    const rows = Array.from(tbl.children)
      .filter((el) => el.localName === "tr")
      .map((tr) => parseTableRow(tr));
    const borders = Boolean(firstDesc(firstChild(tbl, "tblPr"), "tblBorders"));
    return { columnWidthsPct, rows, borders: borders || rows.some((row) => row.some((cell) => hasBorder(cell))) };
  });
}

function parseTableRow(tr: Element): DocxTableCellMeta[] {
  return Array.from(tr.children)
    .filter((el) => el.localName === "tc")
    .map((tc) => {
      const tcPr = firstChild(tc, "tcPr");
      const gridSpan = num(attr(firstChild(tcPr, "gridSpan"), "val")) ?? 1;
      const vMergeVal = attr(firstChild(tcPr, "vMerge"), "val");
      const vMerge = firstChild(tcPr, "vMerge")
        ? vMergeVal === "restart" || !vMergeVal
          ? ("restart" as const)
          : ("continue" as const)
        : undefined;
      const bordersEl = firstChild(tcPr, "tcBorders");
      return {
        text: cellText(tc),
        colspan: Math.max(1, gridSpan),
        rowspan: 1,
        vMerge,
        borders: {
          top: borderColor(firstChild(bordersEl, "top")),
          right: borderColor(firstChild(bordersEl, "right")),
          bottom: borderColor(firstChild(bordersEl, "bottom")),
          left: borderColor(firstChild(bordersEl, "left")),
        },
      };
    });
}

function cellText(tc: Element): string {
  const parts: string[] = [];
  for (const t of allDesc(tc, "t")) {
    parts.push(t.textContent ?? "");
  }
  return parts.join("").trim();
}

function borderColor(el: Element | null): string | undefined {
  if (!el) return;
  const val = attr(el, "val");
  if (!val || val === "nil" || val === "none") return;
  const color = attr(el, "color");
  if (!color || color === "auto") return "#000000";
  return color.startsWith("#") ? color : `#${color}`;
}

function hasBorder(cell: DocxTableCellMeta): boolean {
  return Boolean(cell.borders.top || cell.borders.right || cell.borders.bottom || cell.borders.left);
}

function parseXml(xml: string): Document | null {
  if (!xml.trim() || typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) return null;
  return doc;
}

function firstDesc(el: Document | Element | null, name: string): Element | null {
  if (!el) return null;
  for (const node of Array.from(el.getElementsByTagName("*"))) {
    if (node.localName === name) return node;
  }
  return null;
}

function lastDesc(el: Document | Element, name: string): Element | null {
  const all = allDesc(el, name);
  return all[all.length - 1] ?? null;
}

function allDesc(el: Document | Element, name: string): Element[] {
  return Array.from(el.getElementsByTagName("*")).filter((node) => node.localName === name);
}

function firstChild(el: Element | null | undefined, name: string): Element | null {
  if (!el) return null;
  for (const node of Array.from(el.children)) {
    if (node.localName === name) return node;
  }
  return null;
}

function attr(el: Element | null | undefined, name: string): string | undefined {
  if (!el) return;
  return el.getAttributeNS(W_NS, name) || el.getAttribute(`w:${name}`) || el.getAttribute(name) || undefined;
}

function attrAny(el: Element | null | undefined, name: string): string | undefined {
  if (!el) return;
  return (
    el.getAttributeNS(A_NS, name) ||
    el.getAttributeNS(W_NS, name) ||
    el.getAttribute(name) ||
    el.getAttribute(`a:${name}`) ||
    el.getAttribute(`wp:${name}`) ||
    undefined
  );
}

function num(value: string | undefined): number | undefined {
  if (value == null || value === "") return;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
