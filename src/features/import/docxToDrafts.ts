import mammoth from "mammoth";
import { htmlToDraftBlocks, type DraftBlock } from "@/features/import/htmlToDraftBlocks";
import { readDocxMeta, type DocxImageMeta, type DocxMeta, type DocxTableMeta } from "@/features/import/docxMeta";
import { readWordLayout } from "@/features/import/wordLayout";
import { paginateDrafts } from "@/features/import/paginateDrafts";
import { defaultMediaStyle } from "@/features/blocks/mediaLayout";
import type { PageBookFields } from "@/page/pageSpec";
import type { BlockStyle } from "@/types/domain";

export type DocxPageMode = "adapt" | "reflow";

export interface DocxImportResult {
  html: string;
  drafts: DraftBlock[];
  meta: DocxMeta;
}

export async function draftsFromDocx(
  bytes: Uint8Array,
  options?: { book?: PageBookFields | null; paginate?: boolean },
): Promise<DraftBlock[]> {
  const imported = await importDocx(bytes);
  const drafts = options?.paginate === false ? imported.drafts : paginateDrafts(imported.drafts, options?.book);
  return drafts;
}

export async function importDocx(bytes: Uint8Array): Promise<DocxImportResult> {
  const meta = await readDocxMeta(bytes);
  const layout = await readWordLayout(bytes);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  let imageCursor = 0;
  const result = await mammoth.convertToHtml(
    { arrayBuffer, buffer: bytes } as Parameters<typeof mammoth.convertToHtml>[0],
    {
      styleMap: layout.styleMap,
      transformDocument: layout.transformDocument,
      ignoreEmptyParagraphs: false,
      convertImage: mammoth.images.imgElement(async (image) => {
        const encoded = await image.read("base64");
        const info = meta.images[imageCursor];
        imageCursor += 1;
        const attrs: { src: string; [key: string]: string } = {
          src: `data:${image.contentType};base64,${encoded}`,
        };
        if (info) {
          attrs.width = String(info.widthPx);
          attrs.height = String(info.heightPx);
          attrs["data-ks-wrap"] = info.wrap;
          attrs["data-ks-inline"] = info.inline ? "1" : "0";
        }
        return attrs;
      }),
    },
  );
  let drafts = htmlToDraftBlocks(result.value);
  drafts = enrichImages(drafts, meta.images);
  drafts = enrichTables(drafts, meta.tables);
  return { html: result.value, drafts, meta };
}

function enrichImages(drafts: DraftBlock[], images: DocxImageMeta[]): DraftBlock[] {
  let index = 0;
  return drafts.map((draft) => {
    if (draft.type !== "image") return draft;
    const info = images[index];
    index += 1;
    if (!info) return draft;
    const data = { ...(draft.data as Record<string, unknown>) };
    const pageWidthGuess = 600;
    const widthPct = Math.min(100, Math.max(8, Math.round((info.widthPx / pageWidthGuess) * 100)));
    data.width = widthPct;
    data.widthPx = info.widthPx;
    data.heightPx = info.heightPx;
    data.align = data.align ?? "center";

    let style: BlockStyle = { ...(draft.style ?? {}) };
    if (info.inline || info.wrap === "inline") {
      style = { ...style, placement: "inline" };
    } else if (info.wrap === "square" || info.wrap === "tight" || info.wrap === "through") {
      style = { ...defaultMediaStyle("wrapRight"), ...style, placement: "wrapRight" };
    } else if (info.wrap === "behind") {
      style = {
        ...defaultMediaStyle("freeBehind"),
        ...style,
        placement: "freeBehind",
        width: widthPct,
      };
    } else {
      style = {
        ...defaultMediaStyle("freeFront"),
        ...style,
        placement: "freeFront",
        width: widthPct,
      };
    }
    return { ...draft, data, style };
  });
}

function enrichTables(drafts: DraftBlock[], tables: DocxTableMeta[]): DraftBlock[] {
  let index = 0;
  return drafts.map((draft) => {
    if (draft.type !== "table") return draft;
    const meta = tables[index];
    index += 1;
    if (!meta) return draft;
    const grid = meta.rows.map((row) =>
      row.map((cell) => ({
        text: cell.text,
        colspan: cell.colspan,
        rowspan: cell.vMerge === "continue" ? 0 : 1,
        vMerge: cell.vMerge,
      })),
    );
    for (let r = 0; r < grid.length; r += 1) {
      for (let c = 0; c < (grid[r]?.length ?? 0); c += 1) {
        const cell = grid[r]?.[c];
        if (!cell || cell.vMerge !== "restart") continue;
        let span = 1;
        for (let rr = r + 1; rr < grid.length; rr += 1) {
          const below = grid[rr]?.[c];
          if (!below || below.vMerge !== "continue") break;
          span += 1;
          below.rowspan = 0;
        }
        cell.rowspan = span;
      }
    }
    return {
      ...draft,
      data: {
        ...(draft.data as object),
        rows: grid.map((row) =>
          row.map((cell) =>
            cell.colspan > 1 || cell.rowspan !== 1
              ? { text: cell.text, colspan: cell.colspan, rowspan: cell.rowspan }
              : cell.text,
          ),
        ),
        columnWidthsPct: meta.columnWidthsPct,
        borders: meta.borders,
      },
    };
  });
}
