/** Ortak sayfa motoru — editör, önizleme, PDF ve HTML aynı mm tanımını kullanır. */

import type { CSSProperties } from "react";

export const CSS_DPI = 96;
export const MM_PER_INCH = 25.4;
/** 96 dpi'de 1 mm ≈ 3,7795 px */
export const MM_TO_PX = CSS_DPI / MM_PER_INCH;

export type PageSizePreset = "classic" | "a4" | "a5" | "book1724" | "custom";

export interface PageMarginsMm {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PageSpec {
  preset: PageSizePreset;
  widthMm: number;
  heightMm: number;
  margins: PageMarginsMm;
}

export interface PagePixels {
  width: number;
  height: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  contentWidth: number;
  contentHeight: number;
}

export interface PageBookFields {
  pageSizePreset?: string | null;
  pageWidthMm?: number | null;
  pageHeightMm?: number | null;
  marginTopMm?: number | null;
  marginRightMm?: number | null;
  marginBottomMm?: number | null;
  marginLeftMm?: number | null;
}

/** Mevcut 760×920 px sayfanın mm karşılığı (geriye uyum). BOOK_PAGE_PADDING ile aynı. */
export const CLASSIC_PAGE: PageSpec = {
  preset: "classic",
  widthMm: pxToMm(760),
  heightMm: pxToMm(920),
  margins: {
    top: pxToMm(56),
    right: pxToMm(64),
    bottom: pxToMm(96),
    left: pxToMm(64),
  },
};

export const PAGE_PRESETS: Record<Exclude<PageSizePreset, "custom">, PageSpec> = {
  classic: CLASSIC_PAGE,
  a4: {
    preset: "a4",
    widthMm: 210,
    heightMm: 297,
    margins: { top: 20, right: 20, bottom: 24, left: 20 },
  },
  a5: {
    preset: "a5",
    widthMm: 148,
    heightMm: 210,
    margins: { top: 16, right: 16, bottom: 20, left: 16 },
  },
  book1724: {
    preset: "book1724",
    widthMm: 170,
    heightMm: 240,
    margins: { top: 18, right: 18, bottom: 22, left: 18 },
  },
};

export const PAGE_PRESET_OPTIONS: { id: PageSizePreset; label: string }[] = [
  { id: "classic", label: "Klasik (760×920 px)" },
  { id: "a4", label: "A4 (210×297 mm)" },
  { id: "a5", label: "A5 (148×210 mm)" },
  { id: "book1724", label: "Kitap 17×24 cm" },
  { id: "custom", label: "Özel (mm)" },
];

export function mmToPx(mm: number): number {
  return mm * MM_TO_PX;
}

export function pxToMm(px: number): number {
  return px / MM_TO_PX;
}

export function roundPx(mm: number): number {
  return Math.round(mmToPx(mm) * 1000) / 1000;
}

export function normalizePreset(value: string | null | undefined): PageSizePreset {
  if (value === "a4" || value === "a5" || value === "book1724" || value === "custom" || value === "classic") {
    return value;
  }
  return "classic";
}

export function resolvePageSpec(book?: PageBookFields | null): PageSpec {
  const preset = normalizePreset(book?.pageSizePreset);
  const base = preset === "custom" ? CLASSIC_PAGE : (PAGE_PRESETS[preset] ?? CLASSIC_PAGE);
  return {
    preset,
    widthMm: clamp(num(book?.pageWidthMm, base.widthMm), 80, 400),
    heightMm: clamp(num(book?.pageHeightMm, base.heightMm), 80, 500),
    margins: {
      top: clamp(num(book?.marginTopMm, base.margins.top), 0, 80),
      right: clamp(num(book?.marginRightMm, base.margins.right), 0, 80),
      bottom: clamp(num(book?.marginBottomMm, base.margins.bottom), 0, 80),
      left: clamp(num(book?.marginLeftMm, base.margins.left), 0, 80),
    },
  };
}

export function pagePixels(spec: PageSpec): PagePixels {
  const width = roundPx(spec.widthMm);
  const height = roundPx(spec.heightMm);
  const paddingTop = roundPx(spec.margins.top);
  const paddingRight = roundPx(spec.margins.right);
  const paddingBottom = roundPx(spec.margins.bottom);
  const paddingLeft = roundPx(spec.margins.left);
  return {
    width,
    height,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    contentWidth: Math.max(0, width - paddingLeft - paddingRight),
    contentHeight: Math.max(0, height - paddingTop - paddingBottom),
  };
}

/** Editör / önizleme article stili — PDF .sheet ile aynı sayılar. */
export function sheetInlineStyle(spec: PageSpec, extra?: CSSProperties): CSSProperties {
  const px = pagePixels(spec);
  return {
    width: px.width,
    height: px.height,
    boxSizing: "border-box",
    padding: `${px.paddingTop}px ${px.paddingRight}px ${px.paddingBottom}px ${px.paddingLeft}px`,
    ...extra,
  };
}

export function pageCssVars(spec: PageSpec): Record<string, string> {
  const px = pagePixels(spec);
  return {
    "--ks-page-width-mm": `${spec.widthMm}mm`,
    "--ks-page-height-mm": `${spec.heightMm}mm`,
    "--ks-page-width-px": `${px.width}px`,
    "--ks-page-height-px": `${px.height}px`,
    "--ks-page-pad-top": `${px.paddingTop}px`,
    "--ks-page-pad-right": `${px.paddingRight}px`,
    "--ks-page-pad-bottom": `${px.paddingBottom}px`,
    "--ks-page-pad-left": `${px.paddingLeft}px`,
  };
}

/** HTML / PDF için ortak sheet kuralları (Rust tarafı da aynı formülü kullanır). */
export function buildSheetCss(spec: PageSpec, mode: "html" | "pdf"): string {
  const px = pagePixels(spec);
  const pad = `${fmt(px.paddingTop)}px ${fmt(px.paddingRight)}px ${fmt(px.paddingBottom)}px ${fmt(px.paddingLeft)}px`;
  if (mode === "pdf") {
    return [
      `@page{size:${fmt(spec.widthMm)}mm ${fmt(spec.heightMm)}mm;margin:0}`,
      `html,body{margin:0;padding:0;width:${fmt(px.width)}px;height:${fmt(px.height)}px;background:#fff;color:#152033;-webkit-print-color-adjust:exact;print-color-adjust:exact}`,
      `.sheet{width:${fmt(px.width)}px;height:${fmt(px.height)}px;max-height:${fmt(px.height)}px;box-sizing:border-box;padding:${pad};overflow:hidden;page-break-after:always;page-break-inside:avoid;break-after:page;break-inside:avoid;position:relative}`,
      `.sheet:last-child{page-break-after:auto;break-after:auto}`,
      `.page-num{position:absolute;bottom:${fmt(Math.max(8, px.paddingBottom * 0.35))}px;left:${fmt(px.paddingLeft)}px;right:${fmt(px.paddingRight)}px;font-size:12px;letter-spacing:.08em;opacity:.7}`,
    ].join("");
  }
  return [
    `.sheet{position:relative;width:${fmt(px.width)}px;min-height:${fmt(px.height)}px;margin:24px auto;padding:${pad};box-sizing:border-box;background:#fff;box-shadow:0 12px 36px rgba(15,23,42,.18);overflow:hidden}`,
    `.page-num{position:absolute;bottom:${fmt(Math.max(8, px.paddingBottom * 0.35))}px;left:${fmt(px.paddingLeft)}px;right:${fmt(px.paddingRight)}px;font-size:12px;letter-spacing:.08em;opacity:.7}`,
  ].join("");
}

function num(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fmt(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
