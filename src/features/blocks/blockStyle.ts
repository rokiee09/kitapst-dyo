import type { CSSProperties } from "react";
import type { BlockStyle, BlockType } from "@/types/domain";

export const FREEABLE_TYPES: BlockType[] = ["paragraph", "heading", "image", "video", "qr"];

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

export function blockBoxStyle(style: BlockStyle, free: boolean): CSSProperties {
  const css: CSSProperties = {};
  if (style.color) css.color = style.color;
  if (style.background) css.background = style.background;
  if (style.fontFamily) css.fontFamily = style.fontFamily;
  if (style.fontSize) css.fontSize = `${style.fontSize}px`;
  if (free) {
    css.position = "absolute";
    css.left = `${style.x ?? 6}%`;
    css.top = `${style.y ?? 8}%`;
    css.width = `${style.width ?? 88}%`;
    css.zIndex = 4;
  }
  return css;
}
