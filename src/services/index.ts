import { invokeCommand } from "@/services/tauri/invoke";
import type {
  Book,
  BookStats,
  BookVersion,
  Chapter,
  ContentBlock,
  WorkspaceSnapshot,
} from "@/types/domain";

export const projectService = {
  getWorkspace(): Promise<WorkspaceSnapshot> {
    return invokeCommand<WorkspaceSnapshot>("get_workspace");
  },
  createBackup(): Promise<string> {
    return invokeCommand<string>("create_backup");
  },
  restoreBackup(zipPath: string): Promise<void> {
    return invokeCommand<void>("restore_backup", { zipPath });
  },
  listLibrary(): Promise<import("@/types/domain").LibraryBook[]> {
    return invokeCommand("list_library_books");
  },
  createLibraryBook(title: string): Promise<WorkspaceSnapshot> {
    return invokeCommand("create_library_book", { title });
  },
  openLibraryBook(path: string): Promise<WorkspaceSnapshot> {
    return invokeCommand("open_library_book", { path });
  },
};

export const bookService = {
  update(payload: {
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
  }): Promise<Book> {
    return invokeCommand<Book>("update_book", { payload });
  },
};

export const chapterService = {
  create(payload: {
    bookId: string;
    parentId?: string | null;
    title: string;
    templateId?: string | null;
  }): Promise<Chapter> {
    return invokeCommand<Chapter>("create_chapter", { payload });
  },
  rename(id: string, title: string): Promise<Chapter> {
    return invokeCommand<Chapter>("rename_chapter", { id, title });
  },
  remove(id: string): Promise<void> {
    return invokeCommand<void>("delete_chapter", { id });
  },
  duplicate(id: string): Promise<Chapter> {
    return invokeCommand<Chapter>("duplicate_chapter", { id });
  },
  move(id: string, direction: "up" | "down"): Promise<Chapter[]> {
    return invokeCommand<Chapter[]>("move_chapter", { id, direction });
  },
  reorder(parentId: string | null, orderedIds: string[]): Promise<Chapter[]> {
    return invokeCommand<Chapter[]>("reorder_chapters", {
      payload: { parentId, orderedIds },
    });
  },
  setActive(chapterId: string): Promise<ContentBlock[]> {
    return invokeCommand<ContentBlock[]>("set_active_chapter", { chapterId });
  },
};

export const blockService = {
  list(chapterId: string): Promise<ContentBlock[]> {
    return invokeCommand<ContentBlock[]>("list_blocks", { chapterId });
  },
  create(payload: {
    chapterId: string;
    type: string;
    afterBlockId?: string | null;
    data?: unknown;
    style?: unknown;
  }): Promise<ContentBlock> {
    return invokeCommand<ContentBlock>("create_block", { payload });
  },
  update(payload: { id: string; data: unknown; style: unknown; type?: string }): Promise<ContentBlock> {
    return invokeCommand<ContentBlock>("update_block", { payload });
  },
  remove(id: string): Promise<void> {
    return invokeCommand<void>("delete_block", { id });
  },
  duplicate(id: string): Promise<ContentBlock> {
    return invokeCommand<ContentBlock>("duplicate_block", { id });
  },
  reorder(chapterId: string, orderedIds: string[]): Promise<ContentBlock[]> {
    return invokeCommand<ContentBlock[]>("reorder_blocks", {
      payload: { chapterId, orderedIds },
    });
  },
};

export const statsService = {
  get(bookId: string): Promise<BookStats> {
    return invokeCommand<BookStats>("get_stats", { bookId });
  },
};

export const versionService = {
  list(bookId: string): Promise<BookVersion[]> {
    return invokeCommand<BookVersion[]>("list_book_versions", { bookId });
  },
  create(payload: { bookId: string; version: string; changelog?: string | null }): Promise<BookVersion> {
    return invokeCommand<BookVersion>("create_book_version", { payload });
  },
  restore(versionId: string): Promise<void> {
    return invokeCommand<void>("restore_book_version", { versionId });
  },
};

export const exportService = {
  run(format: "html" | "epub" | "pdf" | "mobile"): Promise<{ format: string; outputPath: string }> {
    return invokeCommand("export_book", { payload: { format, includeToc: true } });
  },
};

export const folderService = {
  open(which: "project" | "exports" | "html" | "epub" | "pdf" | "mobile" | "backups"): Promise<string> {
    return invokeCommand<string>("open_folder", { which });
  },
};

export const noteService = {
  list(): Promise<import("@/types/domain").Note[]> {
    return invokeCommand("list_notes");
  },
  upsert(payload: {
    id?: string | null;
    chapterId?: string | null;
    title: string;
    body: string;
  }): Promise<import("@/types/domain").Note> {
    return invokeCommand("upsert_note", { payload });
  },
  remove(id: string): Promise<void> {
    return invokeCommand("delete_note", { id });
  },
};

export const templateService = {
  list(): Promise<import("@/types/domain").ChapterTemplate[]> {
    return invokeCommand("list_templates");
  },
  save(payload: { name: string; description?: string | null; payload: unknown }): Promise<import("@/types/domain").ChapterTemplate> {
    return invokeCommand("save_template", { payload });
  },
  apply(chapterId: string, templateId: string): Promise<ContentBlock[]> {
    return invokeCommand("apply_template", { payload: { chapterId, templateId } });
  },
  remove(id: string): Promise<void> {
    return invokeCommand("delete_template", { id });
  },
};

export const stylePresetService = {
  list(blockType?: string): Promise<import("@/types/domain").StylePreset[]> {
    return invokeCommand("list_style_presets", { blockType: blockType ?? null });
  },
  save(payload: {
    name: string;
    blockType: string;
    style: unknown;
  }): Promise<import("@/types/domain").StylePreset> {
    return invokeCommand("save_style_preset", { payload });
  },
  remove(id: string): Promise<void> {
    return invokeCommand("delete_style_preset", { id });
  },
};

export { assetService } from "@/services/assets";
