import { toast } from "sonner";
import { exportService, folderService, projectService } from "@/services";
import { useEditorStore } from "@/stores/editorStore";

export async function runBookExport(
  format: "html" | "epub" | "pdf" | "printPdf" | "mobile" | "zip",
) {
  const toastId = toast.loading("Dışa aktarılıyor…");
  try {
    await useEditorStore.getState().flushSave();
    if (format === "zip") {
      const path = await projectService.createBackup();
      toast.success(`Yedek oluşturuldu: ${path}`, { id: toastId });
      void folderService.open("backups");
      return;
    }
    const result = await exportService.run(format);
    toast.success(`Oluşturuldu: ${result.outputPath}`, { id: toastId });
    const folder =
      format === "mobile" ? "mobile" : format === "printPdf" ? "pdf" : format;
    void folderService.open(folder);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Dışa aktarma başarısız.", { id: toastId });
  }
}
