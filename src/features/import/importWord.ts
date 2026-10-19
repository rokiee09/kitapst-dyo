import mammoth from "mammoth";
import { toast } from "sonner";
import { htmlToDraftBlocks, plainTextToDraftBlocks, type DraftBlock } from "@/features/import/htmlToDraftBlocks";
import { invokeCommand } from "@/services/tauri/invoke";
import { useEditorStore } from "@/stores/editorStore";
import { pickLocalFile } from "@/utils/filePicker";
import type { Asset } from "@/types/domain";

export async function importWordIntoChapter() {
  const path = await pickLocalFile("word");
  if (!path) return;
  const toastId = toast.loading("Word dosyası okunuyor…");
  try {
    const raw = await invokeCommand<number[] | Uint8Array>("read_import_bytes", { path });
    const bytes = raw instanceof Uint8Array ? raw : Uint8Array.from(raw);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    let drafts: DraftBlock[] = [];
    if (ext === "docx") {
      const result = await mammoth.convertToHtml(
        { arrayBuffer: buffer as ArrayBuffer },
        {
          styleMap: [
            "p[style-name='Title'] => h1:fresh",
            "p[style-name='Subtitle'] => h2:fresh",
            "p[style-name='Quote'] => blockquote:fresh",
            "r[style-name='Strong'] => strong",
            "r[style-name='Emphasis'] => em",
            "u => u",
            "strike => s",
          ],
          convertImage: mammoth.images.imgElement(async (image) => {
            const encoded = await image.read("base64");
            return { src: `data:${image.contentType};base64,${encoded}` };
          }),
        },
      );
      drafts = htmlToDraftBlocks(result.value);
      drafts = await hydrateImportedImages(drafts);
    } else {
      const text = new TextDecoder("utf-8").decode(bytes);
      drafts = plainTextToDraftBlocks(text);
    }
    if (drafts.length === 0) {
      toast.error("Dosyada aktarılacak yazı bulunamadı.", { id: toastId });
      return;
    }
    toast.loading(`${drafts.length} blok ekleniyor…`, { id: toastId });
    await useEditorStore.getState().importDrafts(drafts);
    toast.success("Word içeriği biçimiyle eklendi.", { id: toastId });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Word içe aktarılamadı.", { id: toastId });
  }
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
