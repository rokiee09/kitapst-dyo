import { toast } from "sonner";
import { create } from "zustand";
import { chapterService, projectService, statsService, versionService, bookService } from "@/services";
import type { DriveSyncSettings } from "@/services";
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

const DRIVE_POLL_MS = 8000;
let drivePollInFlight = false;

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
  driveSync: DriveSyncSettings | null;
  refreshDriveSync: () => Promise<void>;
  startDriveLiveSync: () => () => void;
  pollDriveLive: () => Promise<void>;
  pushDriveSync: () => Promise<void>;
  pullDriveSync: () => Promise<WorkspaceSnapshot | null>;
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
  driveSync: null,

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
      // Önsöz / Giriş / İçindekiler otomatik eklendiği için tüm ağacı yenile.
      const snapshot = await projectService.getWorkspace();
      set({
        chapters: snapshot.chapters,
        selectedChapterId: chapter.id,
        stats: snapshot.stats,
      });
      await get().refreshStats();
      void get().pushDriveSync();
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
      void get().pushDriveSync();
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
      void get().pushDriveSync();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bölüm silinemedi.");
    }
  },

  duplicateChapter: async (id) => {
    try {
      const copy = await chapterService.duplicate(id);
      set({ chapters: [...get().chapters, copy] });
      await get().refreshStats();
      void get().pushDriveSync();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bölüm kopyalanamadı.");
    }
  },

  moveChapter: async (id, direction) => {
    try {
      const chapters = await chapterService.move(id, direction);
      set({ chapters });
      void get().pushDriveSync();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bölüm taşınamadı.");
    }
  },

  reorderChapters: async (parentId, orderedIds) => {
    try {
      const chapters = await chapterService.reorder(parentId, orderedIds);
      set({ chapters });
      void get().pushDriveSync();
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
      void get().pushDriveSync();
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
      void get().pushDriveSync();
      return snapshot;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kitap açılamadı.");
      return null;
    }
  },

  refreshDriveSync: async () => {
    try {
      const settings = await projectService.getDriveSync();
      set({ driveSync: settings });
    } catch {
      // Ayar okunamazsa canlı senkron bekler.
    }
  },

  startDriveLiveSync: () => {
    void get().refreshDriveSync();
    const handle = window.setInterval(() => {
      void get().pollDriveLive();
    }, DRIVE_POLL_MS);
    return () => window.clearInterval(handle);
  },

  pollDriveLive: async () => {
    if (drivePollInFlight) return;
    const settings = get().driveSync;
    if (settings && !settings.enabled) return;
    const { useEditorStore } = await import("@/stores/editorStore");
    const editor = useEditorStore.getState();
    if (editor.saveStatus !== "saved") return;
    if (Object.keys(editor.pendingTimers).length > 0) return;
    drivePollInFlight = true;
    try {
      const result = await projectService.pollDriveSync();
      set({ driveSync: result.settings });
      if (!result.changed || !result.snapshot) return;
      const currentId = get().selectedChapterId;
      get().applySnapshot(result.snapshot);
      const keepId =
        currentId && result.snapshot.chapters.some((chapter) => chapter.id === currentId)
          ? currentId
          : result.snapshot.selectedChapterId;
      const applyBlocks = (blocks: typeof result.snapshot.selectedBlocks) => {
        const selectedId = editor.selectedBlockId;
        useEditorStore.getState().setBlocks(blocks);
        if (selectedId && blocks.some((block) => block.id === selectedId)) {
          useEditorStore.getState().selectBlock(selectedId);
        }
      };
      if (keepId && keepId !== result.snapshot.selectedChapterId) {
        const blocks = await chapterService.setActive(keepId);
        set({ selectedChapterId: keepId });
        applyBlocks(blocks);
      } else {
        applyBlocks(result.snapshot.selectedBlocks);
      }
      toast.success("Drive’dan canlı güncelleme alındı.");
    } catch {
      // Drive kapalıysa veya klasör henüz inmediyse sessiz geç.
    } finally {
      drivePollInFlight = false;
    }
  },

  pushDriveSync: async () => {
    try {
      const settings = await projectService.pushDriveSync();
      set({ driveSync: settings });
      if (settings.warning) toast.message(settings.warning);
    } catch {
      // Drive kapalıysa veya klasör yoksa sessiz geç.
    }
  },

  pullDriveSync: async () => {
    try {
      const snapshot = await projectService.pullDriveSync();
      get().applySnapshot(snapshot);
      await get().refreshDriveSync();
      return snapshot;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Drive senkronu alınamadı.");
      return null;
    }
  },
}));
