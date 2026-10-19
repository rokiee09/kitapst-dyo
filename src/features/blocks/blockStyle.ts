import type { CSSProperties } from "react";
import type { BlockStyle, BlockType } from "@/types/domain";

export const LIST_STYLE_KEYWORDS = new Set([
  "disc",
  "circle",
  "square",
  "decimal",
  "decimal-leading-zero",
  "lower-alpha",
  "upper-alpha",
  "lower-roman",
  "upper-roman",
  "none",
]);

export const LIST_MARKER_OPTIONS = [
  { value: "", label: "Varsayılan" },
  { value: "disc", label: "• Nokta" },
  { value: "circle", label: "○ Boş daire" },
  { value: "square", label: "■ Kare" },
  { value: "decimal", label: "1. 2. 3." },
  { value: "decimal-leading-zero", label: "01. 02. 03." },
  { value: "lower-alpha", label: "a. b. c." },
  { value: "upper-alpha", label: "A. B. C." },
  { value: "lower-roman", label: "i. ii. iii." },
  { value: "upper-roman", label: "I. II. III." },
  { value: "–", label: "– Tire" },
  { value: "—", label: "— Uzun çizgi" },
  { value: "→", label: "→ Ok" },
  { value: "★", label: "★ Yıldız" },
  { value: "✦", label: "✦ Işıltı" },
  { value: "✓", label: "✓ Onay" },
  { value: "❖", label: "❖ Elmas" },
  { value: "▸", label: "▸ Üçgen" },
  { value: "▪", label: "▪ Küçük kare" },
  { value: "none", label: "İşaretsiz" },
] as const;

export function listMarkerCss(marker: string | undefined): CSSProperties {
  const value = marker?.trim();
  if (!value) return {};
  if (LIST_STYLE_KEYWORDS.has(value)) {
    return {
      ["--ks-list-type" as string]: value,
    };
  }
  const escaped = value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
  return {
    ["--ks-list-type" as string]: `"${escaped} "`,
  };
}

export const FREEABLE_TYPES: BlockType[] = ["paragraph", "heading", "image", "video", "qr"];

export const LINE_SPACINGS = [
  { value: 1, label: "1,0" },
  { value: 1.15, label: "1,15" },
  { value: 1.5, label: "1,5" },
  { value: 2, label: "2,0" },
  { value: 2.5, label: "2,5" },
  { value: 3, label: "3,0" },
] as const;

export const HEADING_SIZE_OPTIONS = [
  { value: "", label: "Varsayılan" },
  { value: "1", label: "H1" },
  { value: "2", label: "H2" },
  { value: "3", label: "H3" },
] as const;

export const HEADING_SIZE_PX: Record<1 | 2 | 3, number> = {
  1: 28,
  2: 22,
  3: 18,
};

export function parseHeadingSize(value: unknown): 1 | 2 | 3 | undefined {
  const level = typeof value === "number" ? value : Number(value);
  if (level === 1 || level === 2 || level === 3) return level;
  return undefined;
}

export function effectiveHeadingSize(style: BlockStyle | undefined, data: unknown): 1 | 2 | 3 | undefined {
  const fromStyle = parseHeadingSize(style?.headingSize);
  if (fromStyle) return fromStyle;
  if (!data || typeof data !== "object") return undefined;
  return parseHeadingSize((data as { level?: unknown }).level);
}

export const PAGE_FONTS = [
  { value: "Segoe UI", label: "Segoe UI" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Times New Roman, serif", label: "Times" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Calibri, sans-serif", label: "Calibri" },
  { value: "Trebuchet MS, sans-serif", label: "Trebuchet" },
];

export function canFloat(type: BlockType): boolean {
  return FREEABLE_TYPES.includes(type);
}

export function isFree(style: BlockStyle | undefined): boolean {
  return style?.placement === "free";
}

export function defaultFreeStyle(type: BlockType, index: number): BlockStyle {
  if (type === "qr") {
    return { placement: "free", x: 82, y: 4, width: 14 };
  }
  const media = type === "image" || type === "video";
  return {
    placement: "free",
    x: media ? 58 : 6,
    y: Math.min(78, 8 + (index % 7) * 10),
    width: media ? 36 : 88,
  };
}

export function snapPercent(value: number): number {
  const points = [0, 4, 8, 16, 25, 33, 50, 67, 75, 84, 92, 96];
  for (const point of points) {
    if (Math.abs(value - point) < 1.6) return point;
  }
  return Math.round(value * 2) / 2;
}

export function clampBox(x: number, y: number, width: number) {
  const w = Math.min(100, Math.max(8, width));
  return {
    x: Math.min(100 - w, Math.max(0, x)),
    y: Math.min(92, Math.max(0, y)),
    width: w,
  };
}

export const BOX_PRESETS = [
  { id: "left", label: "Sol", x: 4, width: 46, y: 10 },
  { id: "center", label: "Orta", x: 10, width: 80, y: 10 },
  { id: "right", label: "Sağ", x: 50, width: 46, y: 10 },
  { id: "full", label: "Tam", x: 4, width: 92, y: 8 },
] as const;

export function blockLabel(type: BlockType): string {
  switch (type) {
    case "image":
      return "Görsel";
    case "video":
      return "Video";
    case "qr":
      return "QR";
    case "heading":
      return "Başlık";
    default:
      return "Yazı";
  }
}

export function blockBoxStyle(style: BlockStyle, free: boolean, type?: BlockType): CSSProperties {
  const css: CSSProperties = {
    ...(type === "heading" ? {} : listMarkerCss(style.listMarker)),
  };
  if (style.color) css.color = style.color;
  if (style.background) css.background = style.background;
  if (style.fontFamily) css.fontFamily = style.fontFamily;
  if (style.fontSize) css.fontSize = `${style.fontSize}px`;
  if (style.align) css.textAlign = style.align;
  if (style.lineHeight) css.lineHeight = style.lineHeight;
  if (free) {
    css.position = "absolute";
    css.left = `${style.x ?? 6}%`;
    css.top = `${style.y ?? 8}%`;
    css.width = `${style.width ?? 88}%`;
    css.zIndex = 4;
  }
  return css;
}
