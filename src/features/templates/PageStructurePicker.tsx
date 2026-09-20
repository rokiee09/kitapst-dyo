import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageLayoutPreview } from "@/features/templates/PageLayoutPreview";
import { BOOK_PAGE_STRUCTURES } from "@/features/templates/bookPages";
import { addBookPage, applyBookPageToCurrent } from "@/features/templates/addBookPage";
import { templateService } from "@/services";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { BookPageStructureId } from "@/features/templates/bookPages";
import type { ChapterTemplate } from "@/types/domain";

export function PageStructurePicker() {
  const selectedChapterId = useWorkspaceStore((state) => state.selectedChapterId);
  const [templates, setTemplates] = useState<ChapterTemplate[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      try {
        const items = await templateService.list();
        if (!cancelled) setTemplates(items.filter((item) => item.builtin));
      } catch {
        if (!cancelled) setTemplates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const bookIds = new Set(BOOK_PAGE_STRUCTURES.map((item) => item.id));
  const others = templates.filter((item) => !bookIds.has(item.id as BookPageStructureId));

  async function applyOther(id: string) {
    if (!selectedChapterId) {
      toast.error("Önce bir bölüm seçin.");
      return;
    }
    try {
      await applyBookPageToCurrent(id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Yapı uygulanamadı.");
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-[#d6d0c4] bg-[#fbf8f1] p-4">
      <div className="mb-1 text-sm font-semibold text-[#152033]">Kitap sayfası ekle</div>
      <p className="mb-3 text-xs text-[#5b6578]">
        Kapak, önsöz, içindekiler veya girişi yeni sayfa olarak ekle. İstersen bu boş bölüme de uygula.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {BOOK_PAGE_STRUCTURES.map((page) => {
          const item = templates.find((template) => template.id === page.id);
          return (
            <div key={page.id} className="overflow-hidden rounded-lg border border-[#e4ddd0] bg-white">
              <PageLayoutPreview templateId={page.id} payload={item?.payload} />
              <div className="space-y-1.5 px-2 py-2">
                <div className="text-[12px] font-semibold text-[#152033]">{page.title}</div>
                <p className="text-[10px] text-[#5b6578]">{page.hint}</p>
                <button
                  type="button"
                  className="h-7 w-full rounded-md bg-blue-600 text-[11px] text-white hover:bg-blue-500"
                  onClick={() => void addBookPage(page.id)}
                >
                  Sayfa olarak ekle
                </button>
                <button
                  type="button"
                  className="h-7 w-full rounded-md border border-[#d6d0c4] text-[11px] text-[#152033] hover:border-blue-400"
                  onClick={() => void applyBookPageToCurrent(page.id)}
                >
                  Bu bölüme uygula
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {others.length > 0 ? (
        <>
          <div className="mb-2 mt-5 text-xs font-semibold text-[#152033]">Diğer sayfa düzenleri</div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {others.map((item) => (
              <button
                key={item.id}
                type="button"
                className="overflow-hidden rounded-lg border border-[#e4ddd0] bg-white text-left hover:border-blue-400"
                onClick={() => void applyOther(item.id)}
              >
                <PageLayoutPreview templateId={item.id} payload={item.payload} />
                <div className="px-2 py-1.5 text-[11px] font-medium text-[#152033]">{item.name}</div>
              </button>
            ))}
          </div>
        </>
      ) : null}
      <Button className="mt-3" size="sm" variant="paper" onClick={() => void useEditorStore.getState().addBlock("paragraph")}>
        Boş metinle başla
      </Button>
    </div>
  );
}
