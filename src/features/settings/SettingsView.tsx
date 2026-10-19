import { BookSettingsView } from "@/features/books/BookSettingsView";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { folderService, projectService } from "@/services";
import { pickLocalFile } from "@/utils/filePicker";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { aiProofread } from "@/features/proofread/aiProofread";
import { persistProofreadAiSettings, loadProofreadAiSettings } from "@/features/proofread/settings";

export function SettingsView() {
  return (
    <div className="h-full overflow-auto bg-[#0d1524]">
      <BookSettingsView />
      <div className="mx-auto max-w-2xl space-y-4 px-8 pb-8">
        <ProofreadAiCard />
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

function ProofreadAiCard() {
  const initial = loadProofreadAiSettings();
  const [endpoint, setEndpoint] = useState(initial.endpoint);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [model, setModel] = useState(initial.model);
  const [testing, setTesting] = useState(false);

  function persist(next: { endpoint?: string; apiKey?: string; model?: string }) {
    const saved = {
      endpoint: next.endpoint ?? endpoint,
      apiKey: next.apiKey ?? apiKey,
      model: next.model ?? model,
    };
    setEndpoint(saved.endpoint);
    setApiKey(saved.apiKey);
    setModel(saved.model);
    void persistProofreadAiSettings(saved);
  }

  return (
    <div className="rounded-lg border border-[#1c2a44] bg-[#070b14] p-4">
      <h2 className="mb-2 font-medium">Yazım denetimi (isteğe bağlı yapay zeka)</h2>
      <p className="mb-3 text-sm text-[#8aa0bd]">
        Üst çubuktaki “Yazımı denetle” her zaman bu makinede çalışır. Yapay zeka zorunlu değildir.
        İsterseniz OpenAI uyumlu bir adres ve anahtar ekleyin. OpenAI için adres
        `https://api.openai.com/v1`, model `gpt-4o-mini` olmalıdır. Metin yalnızca siz tarama istediğinizde gönderilir.
      </p>
      <div className="space-y-2">
        <div>
          <Label htmlFor="ai-endpoint">API adresi</Label>
          <Input
            id="ai-endpoint"
            className="mt-1"
            placeholder="https://api.openai.com/v1"
            value={endpoint}
            onChange={(event) => persist({ endpoint: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="ai-key">API anahtarı</Label>
          <Input
            id="ai-key"
            className="mt-1"
            type="password"
            value={apiKey}
            onChange={(event) => persist({ apiKey: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="ai-model">Model</Label>
          <Input
            id="ai-model"
            className="mt-1"
            value={model}
            onChange={(event) => persist({ model: event.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              persist({});
              toast.success("Yazım denetimi ayarı kaydedildi.");
            }}
          >
            Kaydet
          </Button>
          <Button
            variant="outline"
            disabled={testing}
            onClick={() => {
              persist({});
              void (async () => {
                setTesting(true);
                try {
                  const issues = await aiProofread(
                    "Herkes yanlız geldi. Bu cümle bozuk ve yazım hatası içeriyor.",
                  );
                  if (issues.length === 0) {
                    toast.error("Bağlantı oldu ama öneri gelmedi. Model adını gpt-4o-mini yapın.");
                  } else {
                    toast.success(`Bağlantı çalışıyor. ${issues.length} örnek öneri geldi.`);
                  }
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Bağlantı denemesi başarısız.");
                } finally {
                  setTesting(false);
                }
              })();
            }}
          >
            {testing ? "Deneniyor…" : "Bağlantıyı dene"}
          </Button>
        </div>
      </div>
    </div>
  );
}
