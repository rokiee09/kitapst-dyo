import type { BlockStyle, ContentBlock } from "@/types/domain";
import { MM_TO_PX, pagePixels, resolvePageSpec, type PageBookFields } from "@/page/pageSpec";

/** Word benzeri yerleşim: satır içi, metni sar, serbest (önde/arkada). */
export type MediaLayoutMode = "inline" | "wrapLeft" | "wrapRight" | "freeFront" | "freeBehind";

export const MEDIA_LAYOUT_OPTIONS: { id: MediaLayoutMode; label: string }[] = [
  { id: "inline", label: "Satır içi" },
  { id: "wrapLeft", label: "Metni sar (sol)" },
  { id: "wrapRight", label: "Metni sar (sağ)" },
  { id: "freeFront", label: "Serbest (önde)" },
  { id: "freeBehind", label: "Serbest (arkada)" },
];

export function readLayoutMode(style: BlockStyle | undefined): MediaLayoutMode {
  const value = style?.placement;
  if (value === "wrapLeft" || value === "wrapRight" || value === "freeFront" || value === "freeBehind") {
    return value;
  }
  if (value === "free") return "freeFront";
  return "inline";
}

export function isFreeLayout(mode: MediaLayoutMode): boolean {
  return mode === "freeFront" || mode === "freeBehind";
}

export function isWrapLayout(mode: MediaLayoutMode): boolean {
  return mode === "wrapLeft" || mode === "wrapRight";
}

export function layoutToPlacement(mode: MediaLayoutMode): BlockStyle["placement"] {
  return mode;
}

export function findAnchorBlockId(blocks: ContentBlock[], mediaId: string): string | null {
  const index = blocks.findIndex((block) => block.id === mediaId);
  if (index < 0) return null;
  for (let i = index - 1; i >= 0; i -= 1) {
    const candidate = blocks[i];
    if (candidate && (candidate.type === "paragraph" || candidate.type === "heading")) {
      return candidate.id;
    }
  }
  for (const candidate of blocks) {
    if (candidate.id !== mediaId && (candidate.type === "paragraph" || candidate.type === "heading")) {
      return candidate.id;
    }
  }
  return null;
}

export function contentRectPx(book: PageBookFields | null | undefined) {
  return pagePixels(resolvePageSpec(book));
}

/** İçerik alanına göre % → mm */
export function percentToMm(
  xPercent: number,
  yPercent: number,
  widthPercent: number,
  book: PageBookFields | null | undefined,
) {
  const px = contentRectPx(book);
  const contentWidthMm = px.contentWidth / MM_TO_PX;
  const contentHeightMm = px.contentHeight / MM_TO_PX;
  return {
    xMm: (xPercent / 100) * contentWidthMm,
    yMm: (yPercent / 100) * contentHeightMm,
    widthMm: (widthPercent / 100) * contentWidthMm,
  };
}

export function mmToPercent(
  xMm: number,
  yMm: number,
  widthMm: number,
  book: PageBookFields | null | undefined,
) {
  const px = contentRectPx(book);
  const contentWidthMm = px.contentWidth / MM_TO_PX;
  const contentHeightMm = px.contentHeight / MM_TO_PX;
  return {
    x: contentWidthMm > 0 ? (xMm / contentWidthMm) * 100 : 0,
    y: contentHeightMm > 0 ? (yMm / contentHeightMm) * 100 : 0,
    width: contentWidthMm > 0 ? (widthMm / contentWidthMm) * 100 : 36,
  };
}

export function applyLayoutMode(
  style: BlockStyle,
  mode: MediaLayoutMode,
  blocks: ContentBlock[],
  mediaId: string,
  book?: PageBookFields | null,
): BlockStyle {
  if (mode === "inline") {
    return {
      ...style,
      placement: "inline",
      x: undefined,
      y: undefined,
      width: undefined,
      xMm: undefined,
      yMm: undefined,
      widthMm: undefined,
      heightMm: undefined,
      anchorBlockId: undefined,
    };
  }
  if (mode === "wrapLeft" || mode === "wrapRight") {
    return {
      ...style,
      placement: mode,
      x: undefined,
      y: undefined,
      width: undefined,
      xMm: undefined,
      yMm: undefined,
      widthMm: undefined,
      heightMm: undefined,
      anchorBlockId: undefined,
    };
  }
  const x = style.x ?? 58;
  const y = style.y ?? 8;
  const width = style.width ?? 36;
  const mm = percentToMm(x, y, width, book);
  return {
    ...style,
    placement: mode,
    x,
    y,
    width,
    xMm: style.xMm ?? mm.xMm,
    yMm: style.yMm ?? mm.yMm,
    widthMm: style.widthMm ?? mm.widthMm,
    heightMm: style.heightMm,
    anchorBlockId: style.anchorBlockId ?? findAnchorBlockId(blocks, mediaId),
  };
}

export function snapGuides(
  x: number,
  y: number,
  width: number,
): { x: number; y: number; guides: { v?: number; h?: number } } {
  const centers = [0, 25, 50, 75, 100 - width];
  const mids = [0, 25, 50, 75, 92];
  let nextX = x;
  let nextY = y;
  let v: number | undefined;
  let h: number | undefined;
  for (const point of centers) {
    if (Math.abs(x - point) < 1.8) {
      nextX = point;
      v = point === 50 - width / 2 || Math.abs(point + width / 2 - 50) < 0.01 ? 50 : point;
    }
    if (Math.abs(x + width / 2 - 50) < 1.8) {
      nextX = 50 - width / 2;
      v = 50;
    }
  }
  for (const point of mids) {
    if (Math.abs(y - point) < 1.8) {
      nextY = point;
      h = point;
    }
  }
  return { x: nextX, y: nextY, guides: { v, h } };
}

export function defaultMediaStyle(mode: MediaLayoutMode = "inline"): BlockStyle {
  if (mode === "inline") return { placement: "inline" };
  if (mode === "wrapLeft") return { placement: "wrapLeft" };
  if (mode === "wrapRight") return { placement: "wrapRight" };
  return {
    placement: mode,
    x: 58,
    y: 8,
    width: 36,
  };
}
