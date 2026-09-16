import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { assetService } from "@/services/assets";
import { pickLocalFile } from "@/utils/filePicker";
import { useEditorStore } from "@/stores/editorStore";
import { folderService } from "@/services";
import type { ContentBlock } from "@/types/domain";

function readFileData(data: unknown) {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return {
    assetId: typeof record.assetId === "string" ? record.assetId : null,
    relativePath: typeof record.relativePath === "string" ? record.relativePath : null,
    filename: typeof record.filename === "string" ? record.filename : "",
  };
}

export function FileBlock({ block, editable }: { block: ContentBlock; editable: boolean }) {
  const data = readFileData(block.data);

  async function choose() {
    try {
      const path = await pickLocalFile("file");
      if (!path) return;
      const asset = await assetService.import(path, "file");
      useEditorStore.getState().updateBlockLocal(block.id, {
        data: { ...data, assetId: asset.id, relativePath: asset.relativePath, filename: asset.filename },
      });
      useEditorStore.getState().scheduleSave(block.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dosya eklenemedi.");
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#dbe4ef] bg-[#f8fafc] px-4 py-3">
      <div>
        <div className="text-sm font-medium">{data.filename || "Dosya seçilmedi"}</div>
        {data.relativePath ? <div className="text-xs text-[#5b6578]">{data.relativePath}</div> : null}
      </div>
      {editable ? (
        <div className="flex gap-2">
          <Button size="sm" variant="paper" onClick={() => void choose()}>
            {data.filename ? "Değiştir" : "Dosya seç"}
          </Button>
          {data.relativePath ? (
            <Button size="sm" variant="paper" onClick={() => void assetService.open(data.relativePath!).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Dosya açılamadı."))}>
              Aç
            </Button>
          ) : null}
          <Button size="sm" variant="paper" onClick={() => void folderService.open("project")}>
            Klasör
          </Button>
        </div>
      ) : null}
    </div>
  );
}
