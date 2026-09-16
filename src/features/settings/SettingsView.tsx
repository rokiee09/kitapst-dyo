import { BookSettingsView } from "@/features/books/BookSettingsView";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { folderService, projectService } from "@/services";
import { pickLocalFile } from "@/utils/filePicker";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function SettingsView() {
  return (
    <div className="h-full overflow-auto bg-[#0d1524]">
      <BookSettingsView />
      <div className="mx-auto max-w-2xl space-y-4 px-8 pb-8">
        <div className="rounded-lg border border-[#1c2a44] bg-[#070b14] p-4">
          <h2 className="mb-2 font-medium">Klasörler</h2>
          <p className="mb-3 text-sm text-[#8aa0bd]">
            Kitap dosyaları, dışa aktarmalar ve yedekler proje klasöründedir.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void folderService.open("project")}>
              Proje klasörü
            </Button>
            <Button variant="secondary" onClick={() => void folderService.open("exports")}>
              Dışa aktarmalar
            </Button>
            <Button variant="secondary" onClick={() => void folderService.open("backups")}>
              Yedekler
            </Button>
          </div>
        </div>
        <div className="rounded-lg border border-[#1c2a44] bg-[#070b14] p-4">
          <h2 className="mb-2 font-medium">Yedek</h2>
          <p className="mb-3 text-sm text-[#8aa0bd]">
            Veritabanı, varlıklar ve proje meta verisi ZIP olarak yedeklenir.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                void projectService
                  .createBackup()
                  .then((path) => toast.success(`Yedek oluşturuldu: ${path}`))
                  .catch((error: unknown) =>
                    toast.error(error instanceof Error ? error.message : "Yedek oluşturulamadı."),
                  );
              }}
            >
              ZIP yedek oluştur
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void (async () => {
                  const path = await pickLocalFile("zip");
                  if (!path) return;
                  if (!window.confirm("Seçilen yedek mevcut projenin üzerine yazılacak. Devam edilsin mi?")) return;
                  try {
                    await projectService.restoreBackup(path);
                    const snapshot = await useWorkspaceStore.getState().load();
                    if (snapshot) useEditorStore.getState().setBlocks(snapshot.selectedBlocks);
                    toast.success("Yedek geri yüklendi.");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Yedek geri yüklenemedi.");
                  }
                })();
              }}
            >
              ZIP yedekten geri yükle
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
