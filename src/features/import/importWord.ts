import mammoth from "mammoth";
import { toast } from "sonner";
import { htmlToDraftBlocks, plainTextToDraftBlocks, type DraftBlock } from "@/features/import/htmlToDraftBlocks";
import { invokeCommand } from "@/services/tauri/invoke";
import { useEditorStore } from "@/stores/editorStore";
import { pickLocalFile } from "@/utils/filePicker";

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
      const result = await mammoth.convertToHtml({ arrayBuffer: buffer as ArrayBuffer });
      drafts = htmlToDraftBlocks(result.value);
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
    toast.success(`${drafts.length} blok Word’den eklendi.`, { id: toastId });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Word içe aktarılamadı.", { id: toastId });
  }
}
