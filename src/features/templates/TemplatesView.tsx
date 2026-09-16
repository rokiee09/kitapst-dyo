import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLayoutPreview } from "@/features/templates/PageLayoutPreview";
import { templateService } from "@/services";
import { useEditorStore } from "@/stores/editorStore";
import { useUiStore } from "@/stores/uiStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { ChapterTemplate } from "@/types/domain";

export function TemplatesView() {
  const selectedChapterId = useWorkspaceStore((state) => state.selectedChapterId);
  const blocks = useEditorStore((state) => state.blocks);
  const [templates, setTemplates] = useState<ChapterTemplate[]>([]);
  const [name, setName] = useState("");

  async function refresh() {
    try {
      setTemplates(await templateService.list());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Şablonlar yüklenemedi.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      try {
        const items = await templateService.list();
        if (!cancelled) setTemplates(items);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Şablonlar yüklenemedi.");
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
      useUiStore.getState().setView("book");
      toast.success("Sayfa yapısı bölüme eklendi. Görselleri tıklayıp değiştirebilirsiniz.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Şablon uygulanamadı.");
    }
  }

  const builtins = templates.filter((item) => item.builtin);
  const saved = templates.filter((item) => !item.builtin);

  return (
    <div className="h-full overflow-auto bg-[#0d1524] p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-xl font-semibold">Sayfa yapıları</h1>
          <p className="mt-1 text-sm text-[#8aa0bd]">
            Görsel alternatiflerden birini seçin. Yer tutucu karelerin yerine kendi fotoğrafınızı koyarsınız.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {builtins.map((item) => (
            <LayoutCard key={item.id} item={item} onApply={() => void apply(item.id)} />
          ))}
        </div>
        <div className="rounded-lg border border-[#1c314c] bg-[#102038] p-4">
          <p className="mb-3 text-sm text-[#8aa0b8]">Açık bölümdeki blokları kendi şablonunuz olarak kaydedin.</p>
          <div className="flex gap-2">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Şablon adı" />
            <Button
              onClick={() => {
                void templateService
                  .save({
                    name,
                    payload: blocks.map((block) => ({ type: block.type, data: block.data })),
                  })
                  .then(() => {
                    setName("");
                    return refresh();
                  })
                  .then(() => toast.success("Şablon kaydedildi."))
                  .catch((error: unknown) =>
                    toast.error(error instanceof Error ? error.message : "Şablon kaydedilemedi."),
                  );
              }}
            >
              Kaydet
            </Button>
          </div>
        </div>
        {saved.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((item) => (
              <LayoutCard
                key={item.id}
                item={item}
                onApply={() => void apply(item.id)}
                onRemove={() => {
                  if (!window.confirm("Şablon silinsin mi?")) return;
                  void templateService
                    .remove(item.id)
                    .then(() => refresh())
                    .then(() => toast.success("Şablon silindi."))
                    .catch((error: unknown) =>
                      toast.error(error instanceof Error ? error.message : "Şablon silinemedi."),
                    );
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LayoutCard({
  item,
  onApply,
  onRemove,
}: {
  item: ChapterTemplate;
  onApply: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#1c314c] bg-[#07111f]">
      <PageLayoutPreview templateId={item.id} payload={item.payload} />
      <div className="p-3">
        <div className="font-medium">{item.name}</div>
        <p className="mt-1 min-h-10 text-xs text-[#8aa0b8]">
          {item.description ?? (item.builtin ? "Hazır sayfa yapısı" : "Kayıtlı şablon")}
        </p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={onApply}>
            Bu yapıyı kullan
          </Button>
          {onRemove ? (
            <Button size="sm" variant="danger" onClick={onRemove}>
              Sil
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
