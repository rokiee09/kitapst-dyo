import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assetService } from "@/services/assets";
import { projectService } from "@/services";
import { useEditorStore } from "@/stores/editorStore";
import { useUiStore } from "@/stores/uiStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { LibraryBook } from "@/types/domain";

export function LibraryView() {
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const currentTitle = useWorkspaceStore((state) => state.book?.title);
  const createLibraryBook = useWorkspaceStore((state) => state.createLibraryBook);
  const openLibraryBook = useWorkspaceStore((state) => state.openLibraryBook);
  const setView = useUiStore((state) => state.setView);

  async function refresh() {
    try {
      setBooks(await projectService.listLibrary());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kitap listesi alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      try {
        const items = await projectService.listLibrary();
        if (!cancelled) setBooks(items);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Kitap listesi alınamadı.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function applySnapshot(loader: () => Promise<import("@/types/domain").WorkspaceSnapshot | null>) {
    await useEditorStore.getState().flushSave();
    const snapshot = await loader();
    if (!snapshot) return;
    assetService.clearCache();
    useEditorStore.getState().setBlocks(snapshot.selectedBlocks);
    useUiStore.getState().setView("book");
    await refresh();
  }

  return (
    <div className="h-full overflow-auto bg-[#0d1524] p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Kitaplar</h1>
          <p className="mt-1 text-sm text-[#8aa0bd]">
            Her kitap ayrı klasörde saklanır. Mevcut kitabı bırakıp yenisine geçebilir, istediğin kadar kitap üretebilirsin.
          </p>
          {currentTitle ? (
            <p className="mt-2 text-sm text-[#9fb3c9]">
              Açık kitap: <span className="font-medium text-white">{currentTitle}</span>
            </p>
          ) : null}
        </div>
        <div className="rounded-lg border border-[#1c314c] bg-[#102038] p-4">
          <p className="mb-3 text-sm text-[#8aa0b8]">Yeni boş kitap oluştur</p>
          <div className="flex gap-2">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Kitap adı"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void applySnapshot(() => createLibraryBook(title.trim()));
                  setTitle("");
                }
              }}
            />
            <Button
              onClick={() => {
                const name = title.trim();
                if (!name) {
                  toast.error("Kitap adı girin.");
                  return;
                }
                void applySnapshot(() => createLibraryBook(name)).then(() => setTitle(""));
              }}
            >
              Oluştur
            </Button>
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-[#8aa0bd]">Yükleniyor…</p>
        ) : books.length === 0 ? (
          <p className="text-sm text-[#8aa0bd]">Henüz kitap yok.</p>
        ) : (
          <div className="space-y-2">
            {books.map((item) => (
              <div
                key={item.path}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#1c314c] bg-[#07111f] p-4"
              >
                <div className="min-w-0">
                  <div className="font-medium">
                    {item.title}
                    {item.isCurrent ? (
                      <span className="ml-2 text-[11px] font-normal text-blue-300">açık</span>
                    ) : null}
                  </div>
                  <div className="mt-1 break-all text-[11px] text-[#8aa0bd]">{item.path}</div>
                </div>
                <Button
                  size="sm"
                  variant={item.isCurrent ? "secondary" : "default"}
                  disabled={item.isCurrent}
                  onClick={() => void applySnapshot(() => openLibraryBook(item.path))}
                >
                  {item.isCurrent ? "Açık" : "Aç"}
                </Button>
              </div>
            ))}
          </div>
        )}
        <Button variant="secondary" onClick={() => setView("book")}>
          Düzenleyiciye dön
        </Button>
      </div>
    </div>
  );
}
