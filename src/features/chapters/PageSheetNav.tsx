import { Plus } from "lucide-react";
import { chapterService } from "@/services";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { displayChapterLabel, pageSheetFamily } from "@/utils/chapterTree";
import { cn } from "@/lib/utils";

export function PageSheetNav() {
  const chapters = useWorkspaceStore((state) => state.chapters);
  const selectedChapterId = useWorkspaceStore((state) => state.selectedChapterId);
  const family = pageSheetFamily(chapters, selectedChapterId);
  if (!family) return null;
  const parentId = family.parent.id;
  const nextLabel = family.nextLabel;
  const sheets = family.sheets;
  const currentId = family.current.id;

  async function openChapter(id: string) {
    const blocks = await useWorkspaceStore.getState().selectChapter(id);
    useEditorStore.getState().setBlocks(blocks);
  }

  async function addSheet() {
    const created = await useWorkspaceStore.getState().createChapter(parentId);
    if (!created) return;
    if (created.number) {
      await useWorkspaceStore.getState().renameChapter(created.id, `Sayfa ${created.number}`);
    }
    const blocks = await chapterService.setActive(created.id);
    useEditorStore.getState().setBlocks(blocks);
  }

  return (
    <div className="shrink-0 border-t border-[#1c314c] px-3 py-2.5">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#8aa0b8]">Sayfalar</p>
      <div className="flex flex-wrap items-center gap-1">
        {sheets.map((sheet) => {
          const active = sheet.id === currentId;
          return (
            <button
              key={sheet.id}
              type="button"
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px]",
                active ? "bg-blue-600 text-white" : "bg-[#102038] text-[#9fb3c9] hover:bg-[#163056] hover:text-white",
              )}
              onClick={() => void openChapter(sheet.id)}
            >
              {sheet.number || displayChapterLabel(sheet)}
            </button>
          );
        })}
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-[#2a4568] px-2 py-0.5 text-[11px] text-[#8aa0b8] hover:border-blue-400 hover:text-white"
          onClick={() => void addSheet()}
        >
          <Plus size={11} />
          {nextLabel} aç
        </button>
      </div>
    </div>
  );
}
