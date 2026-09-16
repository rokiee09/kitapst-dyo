import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageLayoutPreview } from "@/features/templates/PageLayoutPreview";
import { templateService } from "@/services";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
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

  async function apply(id: string) {
    if (!selectedChapterId) {
      toast.error("Önce bir bölüm seçin.");
      return;
    }
    try {
      const next = await templateService.apply(selectedChapterId, id);
      useEditorStore.getState().setBlocks(next);
      toast.success("Sayfa yapısı eklendi. Görselleri seçip değiştirebilirsiniz.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Yapı uygulanamadı.");
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-[#d6d0c4] bg-[#fbf8f1] p-4">
      <div className="mb-1 text-sm font-semibold text-[#152033]">Sayfa yapısı seçin</div>
      <p className="mb-3 text-xs text-[#5b6578]">
        Görsel alternatiflerden birini uygulayın; karelerin yerine kendi fotoğrafınızı koyun.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {templates.map((item) => (
          <button
            key={item.id}
            type="button"
            className="overflow-hidden rounded-lg border border-[#e4ddd0] bg-white text-left hover:border-blue-400"
            onClick={() => void apply(item.id)}
          >
            <PageLayoutPreview templateId={item.id} payload={item.payload} />
            <div className="px-2 py-1.5 text-[11px] font-medium text-[#152033]">{item.name}</div>
          </button>
        ))}
      </div>
      <Button className="mt-3" size="sm" variant="paper" onClick={() => void useEditorStore.getState().addBlock("paragraph")}>
        Boş metinle başla
      </Button>
    </div>
  );
}
