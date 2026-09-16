import type { ImageBlockData, QrBlockData, QrTarget, VideoBlockData } from "@/types/domain";

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function readImageData(value: unknown): ImageBlockData {
  const data = asRecord(value);
  const align = data.align;
  return {
    assetId: nullableStr(data.assetId),
    relativePath: nullableStr(data.relativePath),
    alt: str(data.alt),
    caption: str(data.caption),
    captionCustom: bool(data.captionCustom, false),
    captionVisible: bool(data.captionVisible, true),
    description: str(data.description),
    width: Math.min(100, Math.max(8, num(data.width, 100))),
    align: align === "left" || align === "right" || align === "center" ? align : "center",
    borderRadius: Math.min(48, Math.max(0, num(data.borderRadius, 8))),
    showInEpub: bool(data.showInEpub, true),
    showInPdf: bool(data.showInPdf, true),
    showInHtml: bool(data.showInHtml, true),
  };
}

export function readVideoData(value: unknown): VideoBlockData {
  const data = asRecord(value);
  const relativePath = nullableStr(data.relativePath);
  const url = str(data.url);
  return {
    sourceType: relativePath ? "local" : "external",
    assetId: nullableStr(data.assetId),
    relativePath,
    title: str(data.title),
    caption: str(data.caption),
    captionCustom: bool(data.captionCustom, false),
    captionVisible: bool(data.captionVisible, true),
    description: str(data.description),
    url,
    thumbnailAssetId: nullableStr(data.thumbnailAssetId),
    thumbnailPath: nullableStr(data.thumbnailPath),
    duration: str(data.duration),
    generateQr: bool(data.generateQr, false),
    showInEpub: bool(data.showInEpub, true),
    showInPdf: bool(data.showInPdf, true),
    showInHtml: bool(data.showInHtml, true),
    previewAsPdf: bool(data.previewAsPdf, false),
  };
}

export function readQrData(value: unknown): QrBlockData {
  const data = asRecord(value);
  const errorCorrection = data.errorCorrection;
  const rawTarget = data.target;
  const target: QrTarget =
    rawTarget === "video" || rawTarget === "chapter" || rawTarget === "url" || rawTarget === "text"
      ? rawTarget
      : data.mode === "text"
        ? "text"
        : "url";
  return {
    target,
    mode: target === "text" ? "text" : "url",
    value: str(data.value),
    chapterId: nullableStr(data.chapterId),
    title: str(data.title),
    caption: str(data.caption),
    captionCustom: bool(data.captionCustom, false),
    captionVisible: bool(data.captionVisible, true),
    description: str(data.description),
    size: Math.min(512, Math.max(64, num(data.size, 160))),
    errorCorrection:
      errorCorrection === "L" || errorCorrection === "Q" || errorCorrection === "H"
        ? errorCorrection
        : "M",
    margin: Math.min(16, Math.max(0, num(data.margin, 4))),
  };
}

export function qrPayload(data: QrBlockData): string {
  if (data.target === "chapter" && data.chapterId) {
    return `#chapter-${data.chapterId}`;
  }
  return data.value.trim();
}
