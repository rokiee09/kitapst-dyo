import { toast } from "sonner";
import { chapterService, templateService } from "@/services";
import { useEditorStore } from "@/stores/editorStore";
import { useUiStore } from "@/stores/uiStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { BOOK_PAGE_STRUCTURES, type BookPageStructureId } from "@/features/templates/bookPages";

export async function addBookPage(templateId: BookPageStructureId) {
  const page = BOOK_PAGE_STRUCTURES.find((item) => item.id === templateId);
  if (!page) return;
  const store = useWorkspaceStore.getState();
  const chapter = await store.createChapter(null, { title: page.title, templateId });
  if (!chapter) return;
  const blocks = await chapterService.setActive(chapter.id);
  useEditorStore.getState().setBlocks(blocks);
  useUiStore.getState().setView("book");
  toast.success(`${page.title} sayfası eklendi.`);
}

export async function applyBookPageToCurrent(templateId: string) {
  const chapterId = useWorkspaceStore.getState().selectedChapterId;
  if (!chapterId) {
    toast.error("Önce bir bölüm seçin.");
    return;
  }
  const next = await templateService.apply(chapterId, templateId);
  useEditorStore.getState().setBlocks(next);
  const page = BOOK_PAGE_STRUCTURES.find((item) => item.id === templateId);
  if (page) {
    const current = useWorkspaceStore.getState().chapters.find((item) => item.id === chapterId);
    if (current && (current.title === "Yeni Bölüm" || current.title === "Yeni Alt Bölüm")) {
      await useWorkspaceStore.getState().renameChapter(chapterId, page.title);
    }
  }
  useUiStore.getState().setView("book");
  toast.success("Sayfa yapısı bu bölüme eklendi.");
}
