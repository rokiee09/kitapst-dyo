import { pagePixels, resolvePageSpec, type PageBookFields } from "@/page/pageSpec";
import type { DraftBlock } from "@/features/import/htmlToDraftBlocks";
import type { BlockStyle } from "@/types/domain";

/**
 * Word sayfa taşmasını önler: içerik yüksekliğini sayfa içerik alanına göre
 * tahmin eder ve gerektiğinde pageBreak ekler. Mevcut pageBreak’ler korunur.
 */
export function paginateDrafts(drafts: DraftBlock[], book: PageBookFields | null | undefined): DraftBlock[] {
  if (drafts.length === 0) return drafts;
  const px = pagePixels(resolvePageSpec(book));
  const capacity = Math.max(240, px.contentHeight - 8);
  const out: DraftBlock[] = [];
  let used = 0;

  for (const draft of drafts) {
    if (draft.type === "pageBreak") {
      out.push(draft);
      used = 0;
      continue;
    }
    const height = estimateBlockHeight(draft, px.contentWidth);
    if (used > 0 && used + height > capacity) {
      out.push({ type: "pageBreak", data: {} });
      used = 0;
    }
    out.push(draft);
    used += height;
    if (used >= capacity) {
      out.push({ type: "pageBreak", data: {} });
      used = 0;
    }
  }

  while (out.length && out[out.length - 1]?.type === "pageBreak") out.pop();
  return out;
}

function estimateBlockHeight(draft: DraftBlock, contentWidth: number): number {
  const style = (draft.style ?? {}) as BlockStyle;
  const fontSize = style.fontSize ?? defaultFontSize(draft.type);
  const lineHeight = style.lineHeight ?? 1.25;
  const marginTop = style.marginTop ?? (draft.type === "heading" ? 10 : 4);
  const marginBottom = style.marginBottom ?? (draft.type === "heading" ? 8 : 6);

  if (draft.type === "image") {
    const data = draft.data as { width?: number; heightPx?: number; widthPx?: number };
    const widthPct = Math.min(100, Math.max(8, data.width ?? 100)) / 100;
    if (data.heightPx && data.widthPx) {
      const displayW = contentWidth * widthPct;
      return Math.min(contentWidth * 0.9, (data.heightPx / data.widthPx) * displayW) + marginTop + marginBottom + 24;
    }
    return contentWidth * widthPct * 0.55 + marginTop + marginBottom + 16;
  }

  if (draft.type === "table") {
    const rows = (draft.data as { rows?: unknown[] }).rows ?? [];
    return rows.length * 28 + marginTop + marginBottom + 12;
  }

  if (draft.type === "divider") return 18;
  if (draft.type === "video" || draft.type === "qr") return 180;

  const text = extractText(draft.data);
  const charsPerLine = Math.max(28, Math.floor(contentWidth / Math.max(6, fontSize * 0.52)));
  const lines = Math.max(1, Math.ceil(Math.max(1, text.length) / charsPerLine) + (text.match(/\n/g)?.length ?? 0));
  return marginTop + marginBottom + lines * fontSize * lineHeight + (draft.type === "heading" ? 6 : 0);
}

function defaultFontSize(type: DraftBlock["type"]): number {
  if (type === "heading") return 22;
  if (type === "quote") return 15;
  return 14;
}

function extractText(data: unknown): string {
  if (!data) return "";
  if (typeof data === "string") return data;
  try {
    const matches = JSON.stringify(data).match(/"text":"((?:\\.|[^"\\])*)"/g) ?? [];
    return matches
      .map((item) => {
        const raw = item.slice(8, -1);
        try {
          return JSON.parse(`"${raw}"`) as string;
        } catch {
          return raw;
        }
      })
      .join(" ");
  } catch {
    return "";
  }
}
