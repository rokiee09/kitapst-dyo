import { create } from "zustand";
import type { AppView, PreviewMode } from "@/types/domain";

interface UiState {
  view: AppView;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  leftWidth: number;
  rightWidth: number;
  previewMode: PreviewMode;
  previewing: boolean;
  collapsedChapterIds: string[];
  zoom: number;
  paperDark: boolean;
  setView: (view: AppView) => void;
  toggleLeft: () => void;
  toggleRight: () => void;
  setLeftWidth: (width: number) => void;
  setRightWidth: (width: number) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  enterPreview: (mode?: PreviewMode) => void;
  exitPreview: () => void;
  togglePreview: () => void;
  toggleChapterCollapsed: (id: string) => void;
  setZoom: (zoom: number) => void;
  togglePaperDark: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  view: "book",
  leftCollapsed: false,
  rightCollapsed: false,
  leftWidth: 268,
  rightWidth: 320,
  previewMode: "book",
  previewing: false,
  collapsedChapterIds: [],
  zoom: 100,
  paperDark: false,
  setView: (view) => set({ view, previewing: view === "book" || view === "chapters" ? get().previewing : false }),
  toggleLeft: () => set({ leftCollapsed: !get().leftCollapsed }),
  toggleRight: () => set({ rightCollapsed: !get().rightCollapsed }),
  setLeftWidth: (width) => set({ leftWidth: Math.min(420, Math.max(200, width)) }),
  setRightWidth: (width) => set({ rightWidth: Math.min(420, Math.max(240, width)) }),
  setPreviewMode: (previewMode) => set({ previewMode, previewing: true, view: "book" }),
  enterPreview: (mode) =>
    set({
      previewing: true,
      previewMode: mode ?? get().previewMode,
      view: "book",
    }),
  exitPreview: () => set({ previewing: false }),
  togglePreview: () => {
    const current = get();
    if (current.previewing) {
      set({ previewing: false });
      return;
    }
    set({ previewing: true, view: "book" });
  },
  setZoom: (zoom) => set({ zoom: Math.min(150, Math.max(75, zoom)) }),
  togglePaperDark: () => set({ paperDark: !get().paperDark }),
  toggleChapterCollapsed: (id) => {
    const current = get().collapsedChapterIds;
    set({
      collapsedChapterIds: current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    });
  },
}));
