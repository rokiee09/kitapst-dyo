import { toast } from "sonner";
import { importDocx } from "@/features/import/docxToDrafts";
import { askWordImportMode } from "@/features/import/ImportWordDialog";
import { paginateDrafts } from "@/features/import/paginateDrafts";
import { plainTextToDraftBlocks, type DraftBlock } from "@/features/import/htmlToDraftBlocks";
import { invokeCommand } from "@/services/tauri/invoke";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { pickLocalFile } from "@/utils/filePicker";
import type { Asset } from "@/types/domain";

export async function importWordIntoChapter() {
  const path = await pickLocalFile("word");
  if (!path) return;

  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  let mode: "adapt" | "reflow" | null = "reflow";
  if (ext === "docx") {
    mode = await askWordImportMode();
    if (!mode) return;
  }

  const toastId = toast.loading("Word dosyası okunuyor…");
  try {
    const raw = await invokeCommand<number[] | Uint8Array>("read_import_bytes", { path });
    const bytes = raw instanceof Uint8Array ? raw : Uint8Array.from(raw);
    let drafts: DraftBlock[] = [];

    if (ext === "docx") {
      const imported = await importDocx(bytes);
      if (mode === "adapt" && imported.meta.page) {
        const page = imported.meta.page;
        const book = useWorkspaceStore.getState().book;
        if (book) {
          await useWorkspaceStore.getState().updateBook(
            {
              ...book,
              pageSizePreset: "custom",
              pageWidthMm: clamp(page.widthMm, 80, 400),
              pageHeightMm: clamp(page.heightMm, 80, 500),
              marginTopMm: clamp(page.marginTopMm, 0, 80),
              marginRightMm: clamp(page.marginRightMm, 0, 80),
              marginBottomMm: clamp(page.marginBottomMm, 0, 80),
              marginLeftMm: clamp(page.marginLeftMm, 0, 80),
            },
            { silent: true },
          );
        }
      }
      const book = useWorkspaceStore.getState().book;
      drafts = paginateDrafts(imported.drafts, book);
      drafts = await hydrateImportedImages(drafts);
    } else {
      const text = new TextDecoder("utf-8").decode(bytes);
      drafts = plainTextToDraftBlocks(text);
      drafts = paginateDrafts(drafts, useWorkspaceStore.getState().book);
    }

    if (drafts.length === 0) {
      toast.error("Dosyada aktarılacak yazı bulunamadı.", { id: toastId });
      return;
    }
    const pages = drafts.filter((d) => d.type === "pageBreak").length + 1;
    toast.loading(`${drafts.length} blok · ~${pages} sayfa ekleniyor…`, { id: toastId });
    await useEditorStore.getState().importDrafts(drafts);
    toast.success(
      mode === "adapt"
        ? "Word içeriği eklendi; kitap sayfası Word boyutuna uyarlandı."
        : "Word içeriği biçimiyle sayfalara bölünerek eklendi.",
      { id: toastId },
    );
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Word içe aktarılamadı.", { id: toastId });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
}

async function hydrateImportedImages(drafts: DraftBlock[]): Promise<DraftBlock[]> {
  const next: DraftBlock[] = [];
  for (const draft of drafts) {
    if (draft.type !== "image") {
      next.push(draft);
      continue;
    }
    const data = (draft.data ?? {}) as Record<string, unknown>;
    const dataUrl = typeof data.dataUrl === "string" ? data.dataUrl : "";
    if (!dataUrl.startsWith("data:")) {
      next.push(draft);
      continue;
    }
    try {
      const asset = await invokeCommand<Asset>("import_asset_bytes", {
        payload: {
          filename: guessImageName(dataUrl),
          bytes: dataUrlToBytes(dataUrl),
          assetType: "image",
        },
      });
      next.push({
        ...draft,
        data: {
          ...data,
          dataUrl: undefined,
          assetId: asset.id,
          relativePath: asset.relativePath,
        },
      });
    } catch {
      next.push(draft);
    }
  }
  return next;
}

function dataUrlToBytes(dataUrl: string): number[] {
  const comma = dataUrl.indexOf(",");
  const encoded = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(encoded);
  const bytes = new Array<number>(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function guessImageName(dataUrl: string): string {
  if (dataUrl.includes("image/png")) return "word-gorsel.png";
  if (dataUrl.includes("image/webp")) return "word-gorsel.webp";
  if (dataUrl.includes("image/gif")) return "word-gorsel.gif";
  return "word-gorsel.jpg";
}
