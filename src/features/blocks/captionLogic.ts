import type { BlockType, ContentBlock, QrTarget } from "@/types/domain";

export type CaptionKind = "image" | "video" | "qr";

export function isCaptionKind(type: BlockType | string): type is CaptionKind {
  return type === "image" || type === "video" || type === "qr";
}

export function defaultQrNote(target: QrTarget): string {
  switch (target) {
    case "video":
      return "Videoyu izlemek için tarayın";
    case "chapter":
      return "Bu bölüme gitmek için tarayın";
    case "url":
      return "Bağlantı için tarayın";
    case "text":
      return "QR kod";
  }
}

export function mediaLabel(kind: CaptionKind): string {
  if (kind === "image") return "Resim";
  if (kind === "video") return "Video";
  return "QR";
}

export function blockOrdinal(blocks: ContentBlock[], blockId: string, kind: CaptionKind): number {
  let index = 0;
  for (const block of blocks) {
    if (block.type === kind) {
      index += 1;
      if (block.id === blockId) return index;
    }
  }
  return Math.max(1, index);
}

export function composeCaption(options: {
  kind: CaptionKind;
  index: number;
  note: string;
  custom: boolean;
  visible: boolean;
  qrTarget?: QrTarget;
}): string | null {
  if (!options.visible) return null;
  const note = options.note.trim();
  if (options.custom) return note || null;
  const label = mediaLabel(options.kind);
  let extra = note;
  if (!extra && options.kind === "qr") {
    extra = defaultQrNote(options.qrTarget ?? "url");
  }
  if (!extra) return `${label} ${options.index}.`;
  return `${label} ${options.index}: ${extra}`;
}
