import { toast } from "sonner";
import { create } from "zustand";
import { chapterService, projectService, statsService, versionService, bookService } from "@/services";
import type {
  Book,
  BookStats,
  BookVersion,
  Chapter,
  ContentBlock,
  Project,
  ProjectSettings,
  WorkspaceSnapshot,
} from "@/types/domain";

interface WorkspaceState {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  isDemo: boolean;
  project: Project | null;
  book: Book | null;
  chapters: Chapter[];
  settings: ProjectSettings | null;
  versions: BookVersion[];
  stats: BookStats | null;
  selectedChapterId: string | null;
  load: () => Promise<WorkspaceSnapshot | null>;
  selectChapter: (chapterId: string) => Promise<ContentBlock[]>;
  createChapter: (
    parentId?: string | null,
    options?: { title?: string; templateId?: string | null },
  ) => Promise<Chapter | null>;
  renameChapter: (id: string, title: string) => Promise<void>;
  deleteChapter: (id: string) => Promise<void>;
  duplicateChapter: (id: string) => Promise<void>;
  moveChapter: (id: string, direction: "up" | "down") => Promise<void>;
  reorderChapters: (parentId: string | null, orderedIds: string[]) => Promise<void>;
  refreshStats: () => Promise<void>;
  updateBook: (payload: {
    title: string;
    subtitle?: string | null;
    author?: string | null;
    description?: string | null;
    language: string;
    isbn?: string | null;
    publisher?: string | null;
    coverAssetId?: string | null;
    pageColor?: string;
    inkColor?: string;
    fontFamily?: string;
    pageNumbers?: boolean;
    pageNumberAlign?: "left" | "center" | "right";
    pageNumberStart?: number;
    lineHeight?: number;
  }, options?: { silent?: boolean }) => Promise<void>;
  createVersion: (version: string, changelog: string) => Promise<void>;
  restoreVersion: (versionId: string) => Promise<void>;
  applySnapshot: (snapshot: WorkspaceSnapshot) => void;
  createLibraryBook: (title: string) => Promise<WorkspaceSnapshot | null>;
  openLibraryBook: (path: string) => Promise<WorkspaceSnapshot | null>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  loaded: false,
  loading: false,
  error: null,
  isDemo: false,
  project: null,
  book: null,
  chapters: [],
  settings: null,
  versions: [],
  stats: null,
  selectedChapterId: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const snapshot = await projectService.getWorkspace();
      set({
        loaded: true,
        loading: false,
        isDemo: snapshot.isDemo,
        project: snapshot.project,
        book: snapshot.book,
        chapters: snapshot.chapters,
        settings: snapshot.settings,
        versions: snapshot.versions,
        stats: snapshot.stats,
        selectedChapterId: snapshot.selectedChapterId,
      });
      return snapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Çalışma alanı yüklenemedi.";
      set({ loading: false, error: message });
      toast.error(message);
      return null;
    }
  },

  selectChapter: async (chapterId) => {
    const blocks = await chapterService.setActive(chapterId);
    set({ selectedChapterId: chapterId });
    return blocks;
  },

  createChapter: async (parentId = null, options) => {
    const book = get().book;
    if (!book) return null;
    try {
      const chapter = await chapterService.create({
        bookId: book.id,
        parentId,
        title: options?.title?.trim() || (parentId ? "Yeni Alt Bölüm" : "Yeni Bölüm"),
        templateId: options?.templateId ?? null,
      });
      set({ chapters: [...get().chapters, chapter], selectedChapterId: chapter.id });
      await get().refreshStats();
      return chapter;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bölüm oluşturulamadı.");
      return null;
    }
  },

  renameChapter: async (id, title) => {
    try {
      const updated = await chapterService.rename(id, title);
      set({
        chapters: get().chapters.map((chapter) => (chapter.id === id ? updated : chapter)),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bölüm yeniden adlandırılamadı.");
    }
  },

  deleteChapter: async (id) => {
    try {
      await chapterService.remove(id);
      const snapshot = await projectService.getWorkspace();
      set({
        chapters: snapshot.chapters,
        selectedChapterId: snapshot.selectedChapterId,
        stats: snapshot.stats,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bölüm silinemedi.");
    }
  },

  duplicateChapter: async (id) => {
    try {
      const copy = await chapterService.duplicate(id);
      set({ chapters: [...get().chapters, copy] });
      await get().refreshStats();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bölüm kopyalanamadı.");
    }
  },

  moveChapter: async (id, direction) => {
    try {
      const chapters = await chapterService.move(id, direction);
      set({ chapters });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bölüm taşınamadı.");
    }
  },

  reorderChapters: async (parentId, orderedIds) => {
    try {
      const chapters = await chapterService.reorder(parentId, orderedIds);
      set({ chapters });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bölüm sırası güncellenemedi.");
    }
  },

  refreshStats: async () => {
    const book = get().book;
    if (!book) return;
    try {
      const stats = await statsService.get(book.id);
      set({ stats });
    } catch (error) {
      console.error("[kitap-studiosu] stats", error);
    }
  },

  updateBook: async (payload, options) => {
    try {
      const book = await bookService.update(payload);
      set({ book });
      if (!options?.silent) toast.success("Kitap bilgileri kaydedildi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kitap bilgileri kaydedilemedi.");
    }
  },

  createVersion: async (version, changelog) => {
    const book = get().book;
    if (!book) return;
    try {
      const created = await versionService.create({ bookId: book.id, version, changelog });
      set({ versions: [created, ...get().versions] });
      toast.success(`${created.version} sürümü oluşturuldu.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sürüm oluşturulamadı.");
    }
  },

  restoreVersion: async (versionId) => {
    try {
      await versionService.restore(versionId);
      const snapshot = await projectService.getWorkspace();
      set({
        chapters: snapshot.chapters,
        selectedChapterId: snapshot.selectedChapterId,
        versions: snapshot.versions,
        stats: snapshot.stats,
        book: snapshot.book,
      });
      toast.success("Sürüm geri yüklendi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sürüm geri yüklenemedi.");
    }
  },

  applySnapshot: (snapshot) => {
    set({
      loaded: true,
      loading: false,
      error: null,
      isDemo: snapshot.isDemo,
      project: snapshot.project,
      book: snapshot.book,
      chapters: snapshot.chapters,
      settings: snapshot.settings,
      versions: snapshot.versions,
      stats: snapshot.stats,
      selectedChapterId: snapshot.selectedChapterId,
    });
  },

  createLibraryBook: async (title) => {
    try {
      const snapshot = await projectService.createLibraryBook(title);
      get().applySnapshot(snapshot);
      toast.success(`“${snapshot.book.title}” oluşturuldu.`);
      return snapshot;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kitap oluşturulamadı.");
      return null;
    }
  },

  openLibraryBook: async (path) => {
    try {
      const snapshot = await projectService.openLibraryBook(path);
      get().applySnapshot(snapshot);
      toast.success(`“${snapshot.book.title}” açıldı.`);
      return snapshot;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kitap açılamadı.");
      return null;
    }
  },
}));
