import type { Editor } from "@tiptap/react";
import { toast } from "sonner";
import { create } from "zustand";
import { blockService } from "@/services";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { BlockStyle, BlockType, ContentBlock, SaveStatus } from "@/types/domain";

const AUTOSAVE_MS = 800;

interface EditorState {
  blocks: ContentBlock[];
  selectedBlockId: string | null;
  saveStatus: SaveStatus;
  saveError: string | null;
  activeEditor: Editor | null;
  pendingTimers: Record<string, number>;
  locateQuery: { blockId: string; query: string; token: number } | null;
  setBlocks: (blocks: ContentBlock[]) => void;
  selectBlock: (id: string | null) => void;
  setActiveEditor: (editor: Editor | null) => void;
  locateInBlock: (blockId: string, query: string) => void;
  clearLocate: () => void;
  addBlock: (
    type: BlockType,
    afterBlockId?: string | null,
    data?: unknown,
    style?: BlockStyle,
  ) => Promise<void>;
  updateBlockLocal: (id: string, patch: { data?: unknown; style?: BlockStyle }) => void;
  scheduleSave: (id: string) => void;
  flushSave: (id?: string) => Promise<void>;
  removeBlock: (id: string) => Promise<void>;
  duplicateBlock: (id: string) => Promise<void>;
  reorder: (orderedIds: string[]) => Promise<void>;
  importDrafts: (drafts: { type: BlockType; data: unknown; style?: BlockStyle }[]) => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  blocks: [],
  selectedBlockId: null,
  saveStatus: "idle",
  saveError: null,
  activeEditor: null,
  pendingTimers: {},
  locateQuery: null,

  setBlocks: (blocks) =>
    set({
      blocks,
      selectedBlockId: blocks[0]?.id ?? null,
      saveStatus: "saved",
    }),

  selectBlock: (id) => set({ selectedBlockId: id }),
  setActiveEditor: (editor) => set({ activeEditor: editor }),
  locateInBlock: (blockId, query) => {
    set({
      selectedBlockId: blockId,
      locateQuery: { blockId, query, token: Date.now() },
    });
    window.setTimeout(() => {
      const current = get().locateQuery;
      if (current?.blockId === blockId) set({ locateQuery: null });
    }, 1400);
  },
  clearLocate: () => set({ locateQuery: null }),

  addBlock: async (type, afterBlockId = null, data, style) => {
    const chapterId =
      get().blocks[0]?.chapterId ?? useWorkspaceStore.getState().selectedChapterId;
    if (!chapterId) {
      toast.error("Blok eklemek için bir bölüm seçin.");
      return;
    }
    const selected = get().blocks.find((block) => block.id === get().selectedBlockId);
    try {
      const created = await blockService.create({
        chapterId,
        type,
        afterBlockId: afterBlockId ?? selected?.id ?? null,
        data,
        style,
      });
      const unique = Array.from(
        new Map([...get().blocks, created].map((block) => [block.id, block])).values(),
      ).sort((a, b) => a.order - b.order);
      set({ blocks: unique, selectedBlockId: created.id, saveStatus: "saved" });
      void useWorkspaceStore.getState().refreshStats();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Blok eklenemedi.");
    }
  },

  updateBlockLocal: (id, patch) => {
    set({
      blocks: get().blocks.map((block) =>
        block.id === id
          ? {
              ...block,
              data: patch.data ?? block.data,
              style: patch.style ?? block.style,
            }
          : block,
      ),
      saveStatus: "idle",
    });
  },

  scheduleSave: (id) => {
    const existing = get().pendingTimers[id];
    if (existing) window.clearTimeout(existing);
    const handle = window.setTimeout(() => {
      void get().flushSave(id);
    }, AUTOSAVE_MS);
    set({
      pendingTimers: { ...get().pendingTimers, [id]: handle },
      saveStatus: "idle",
    });
  },

  flushSave: async (id) => {
    const targets = id ? get().blocks.filter((block) => block.id === id) : get().blocks;
    if (targets.length === 0) return;
    set({ saveStatus: "saving", saveError: null });
    try {
      for (const block of targets) {
        const timer = get().pendingTimers[block.id];
        if (timer) window.clearTimeout(timer);
        await blockService.update({
          id: block.id,
          data: block.data,
          style: block.style,
          type: block.type,
        });
      }
      const pendingTimers = { ...get().pendingTimers };
      for (const block of targets) {
        delete pendingTimers[block.id];
      }
      set({ pendingTimers, saveStatus: "saved", saveError: null });
      void useWorkspaceStore.getState().refreshStats();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kaydetme hatası";
      set({ saveStatus: "error", saveError: message });
      toast.error(message);
    }
  },

  removeBlock: async (id) => {
    try {
      await get().flushSave(id);
      await blockService.remove(id);
      const blocks = get().blocks.filter((block) => block.id !== id);
      set({
        blocks,
        selectedBlockId: blocks[0]?.id ?? null,
      });
      void useWorkspaceStore.getState().refreshStats();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Blok silinemedi.");
    }
  },

  duplicateBlock: async (id) => {
    try {
      await get().flushSave(id);
      const copy = await blockService.duplicate(id);
      const blocks = [...get().blocks, copy].sort((a, b) => a.order - b.order);
      set({ blocks, selectedBlockId: copy.id });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Blok kopyalanamadı.");
    }
  },

  reorder: async (orderedIds) => {
    const chapterId = get().blocks[0]?.chapterId;
    if (!chapterId) return;
    const reordered = orderedIds
      .map((id, index) => {
        const block = get().blocks.find((item) => item.id === id);
        return block ? { ...block, order: index } : null;
      })
      .filter((block): block is ContentBlock => block !== null);
    set({ blocks: reordered, saveStatus: "saving" });
    try {
      const saved = await blockService.reorder(chapterId, orderedIds);
      set({ blocks: saved, saveStatus: "saved" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Blok sırası güncellenemedi.");
    }
  },

  importDrafts: async (drafts) => {
    if (drafts.length === 0) return;
    let afterId = get().selectedBlockId;
    for (const draft of drafts) {
      await get().addBlock(draft.type, afterId, draft.data, draft.style);
      afterId = get().selectedBlockId;
    }
  },
}));
