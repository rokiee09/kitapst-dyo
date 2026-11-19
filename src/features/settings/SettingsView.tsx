import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { folderService, projectService, type DriveSyncSettings } from "@/services";
import { pickLocalFile, pickLocalFolder } from "@/utils/filePicker";
import { useEditorStore } from "@/stores/editorStore";
import { useUiStore } from "@/stores/uiStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { aiProofread } from "@/features/proofread/aiProofread";
import { persistProofreadAiSettings, loadProofreadAiSettings } from "@/features/proofread/settings";

export function SettingsView() {
  return (
    <div className="h-full overflow-auto bg-[#0d1524] p-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Uygulama ayarları</h1>
          <p className="mt-1 text-sm text-[#8aa0bd]">
            Kitap bilgileri için üst çubuktaki dişliyi veya Dosya → Kitap ayarları’nı kullanın.
          </p>
          <Button className="mt-3" variant="secondary" onClick={() => useUiStore.getState().openBookSettings()}>
            Kitap ayarlarını aç
          </Button>
        </div>
        <DriveSyncCard />
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

function DriveSyncCard() {
  const [settings, setSettings] = useState<DriveSyncSettings | null>(null);
  const [folderPath, setFolderPath] = useState("");
  const [mode, setMode] = useState<"google" | "folder">("google");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const pullDriveSync = useWorkspaceStore((state) => state.pullDriveSync);

  useEffect(() => {
    void projectService
      .getDriveSync()
      .then((next) => {
        applySettings(next);
      })
      .catch(() => undefined);
  }, []);

  function applySettings(next: DriveSyncSettings) {
    setSettings(next);
    setFolderPath(next.folderPath);
    setEnabled(next.enabled);
    setMode(next.mode === "folder" ? "folder" : "google");
    useWorkspaceStore.setState({ driveSync: next });
  }

  async function save(nextEnabled = enabled, nextPath = folderPath, nextMode = mode) {
    setBusy(true);
    try {
      const saved = await projectService.setDriveSync(nextEnabled, nextPath.trim(), nextMode);
      applySettings(saved);
      if (saved.warning) toast.warning(saved.warning, { duration: 12000 });
      else toast.success(saved.enabled ? "Drive senkronu açıldı ve kitap yedeklendi." : "Drive senkronu kapandı.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Drive ayarı kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-[#1c2a44] bg-[#070b14] p-4">
      <h2 className="mb-2 font-medium">Çoklu çalışma (Google Drive)</h2>
      <p className="mb-3 text-sm text-[#8aa0bd]">
        Google hesabıyla giriş yapınca uygulama Drive’da kendi “Kitap Stüdyosu” klasörünü oluşturur
        (<code className="text-[#a8c0d8]">drive.file</code> izni). Aynı hesabı iki PC’de kullanın.
        Testing modunda ~7 günde bir yeniden giriş gerekir; kalıcı kullanım için uygulamayı yayınlayın
        ve gizlilik politikası URL’si ekleyin.
      </p>
      <div className="space-y-3">
        {!settings?.clientConfigured ? (
          <div className="rounded-md border border-[#243552] bg-[#0a1220] p-3 space-y-2">
            <p className="text-xs text-[#8aa0bd]">
              Önce Google Cloud’da Desktop OAuth istemcisi oluşturup Client ID / Secret girin. Adımlar:{" "}
              <span className="text-[#c5d4e8]">docs/GOOGLE_DRIVE_OAUTH.md</span>
            </p>
            <div>
              <Label>Client ID</Label>
              <Input className="mt-1" value={clientId} onChange={(e) => setClientId(e.target.value)} />
            </div>
            <div>
              <Label>Client Secret</Label>
              <Input
                className="mt-1"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </div>
            <Button
              disabled={busy}
              variant="secondary"
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    const next = await projectService.saveGoogleOauthClient(clientId.trim(), clientSecret.trim());
                    applySettings(next);
                    toast.success("OAuth istemcisi kaydedildi.");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "OAuth kaydı başarısız.");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              Client bilgilerini kaydet
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {settings?.googleConnected ? (
            <>
              <p className="text-sm text-emerald-300">Bağlı: {settings.googleEmail || "Google hesabı"}</p>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    try {
                      applySettings(await projectService.googleDriveLogout());
                      toast.success("Google oturumu kapatıldı.");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Çıkış başarısız.");
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Çıkış yap
              </Button>
            </>
          ) : (
            <Button
              disabled={busy || !settings?.clientConfigured}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    const next = await projectService.googleDriveLogin();
                    applySettings(next);
                    toast.success("Google hesabı bağlandı.");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Google girişi başarısız.");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              Google ile giriş
            </Button>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              const next = event.target.checked;
              setEnabled(next);
              if (!next) void save(false, folderPath, mode);
              else if (mode === "google") void save(true, folderPath, "google");
            }}
          />
          Canlı Drive senkronu
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() => void save(true, folderPath, mode === "folder" ? "folder" : "google")}
          >
            Kaydet ve senkronla
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  await useEditorStore.getState().flushSave();
                  const next = await projectService.pushDriveSync();
                  applySettings(next);
                  if (next.warning) toast.warning(next.warning, { duration: 12000 });
                  else toast.success("Drive’a yazıldı.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Drive’a yazılamadı.");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Şimdi yedekle
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  const snapshot = await pullDriveSync();
                  if (snapshot) {
                    useEditorStore.getState().setBlocks(snapshot.selectedBlocks);
                    toast.success("Drive’dan güncel kitap alındı.");
                  }
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Drive’dan al
          </Button>
        </div>

        <button
          type="button"
          className="text-xs text-[#8aa0bd] underline"
          onClick={() => setShowAdvanced((value) => !value)}
        >
          {showAdvanced ? "Gelişmiş seçenekleri gizle" : "Gelişmiş: masaüstü klasör yolu"}
        </button>
        {showAdvanced ? (
          <div className="space-y-2 rounded-md border border-[#1c2a44] p-3">
            <p className="text-xs text-[#8aa0bd]">
              Eski yöntem: Google Drive masaüstü uygulamasındaki klasörü seçin. OAuth’a gerek yok.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={mode === "folder"}
                onChange={() => setMode("folder")}
              />
              Klasör yolu kullan
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={mode === "google"}
                onChange={() => setMode("google")}
              />
              Google hesabı (önerilen)
            </label>
            <div>
              <Label htmlFor="drive-path">Paylaşılan klasör</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  id="drive-path"
                  value={folderPath}
                  placeholder="Örn. G:\\Benim Drive\\KitapStudio"
                  onChange={(event) => setFolderPath(event.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void pickLocalFolder().then((path) => {
                      if (!path) return;
                      setFolderPath(path);
                      setMode("folder");
                    });
                  }}
                >
                  Seç
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {settings?.enabled ? (
          <p className="text-xs text-emerald-300">
            Canlı senkron açık ({settings.mode === "folder" ? "klasör" : "Google API"}).
          </p>
        ) : (
          <p className="text-xs text-[#8aa0bd]">Canlı senkron kapalı.</p>
        )}
        {settings?.lastPushAt ? (
          <p className="text-xs text-[#8aa0bd]">Son yazma: {new Date(settings.lastPushAt).toLocaleString("tr-TR")}</p>
        ) : null}
        {settings?.lastPullAt ? (
          <p className="text-xs text-[#8aa0bd]">Son alma: {new Date(settings.lastPullAt).toLocaleString("tr-TR")}</p>
        ) : null}
        {settings?.warning ? <p className="text-xs text-amber-300">{settings.warning}</p> : null}
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
