import { useEffect, useRef } from "react";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { IconNav } from "@/components/layout/IconNav";
import { BottomDock } from "@/components/layout/BottomDock";
import { StatusBar } from "@/components/layout/StatusBar";
import { SideDrawer } from "@/components/layout/SideDrawer";
import { ResizeHandle } from "@/components/layout/ResizeHandle";
import { TopBar } from "@/components/layout/TopBar";
import { ChapterTree } from "@/features/chapters/ChapterTree";
import { RightPanel } from "@/features/blocks/RightPanel";
import { EditorWorkspace } from "@/features/editor/EditorWorkspace";
import { SelectionBubble } from "@/features/editor/SelectionBubble";
import { LibraryView } from "@/features/library/LibraryView";
import { ExportView } from "@/features/export/ExportView";
import { SettingsView } from "@/features/settings/SettingsView";
import { TemplatesView } from "@/features/templates/TemplatesView";
import { MediaView } from "@/features/media/MediaView";
import { BookSettingsDialog } from "@/features/books/BookSettingsDialog";
import { useEditorStore } from "@/stores/editorStore";
import {
  COMPACT_DOCK_BREAKPOINT,
  COMPACT_LEFT_BREAKPOINT,
  COMPACT_RIGHT_BREAKPOINT,
  useUiStore,
} from "@/stores/uiStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function AppShell() {
  const view = useUiStore((state) => state.view);
  const leftCollapsed = useUiStore((state) => state.leftCollapsed);
  const rightCollapsed = useUiStore((state) => state.rightCollapsed);
  const leftWidth = useUiStore((state) => state.leftWidth);
  const rightWidth = useUiStore((state) => state.rightWidth);
  const setLeftWidth = useUiStore((state) => state.setLeftWidth);
  const setRightWidth = useUiStore((state) => state.setRightWidth);
  const previewing = useUiStore((state) => state.previewing);
  const loading = useWorkspaceStore((state) => state.loading);
  const loaded = useWorkspaceStore((state) => state.loaded);
  const error = useWorkspaceStore((state) => state.error);
  const prevSize = useRef({
    width: typeof window !== "undefined" ? window.innerWidth : 1920,
    height: typeof window !== "undefined" ? window.innerHeight : 1080,
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.ctrlKey || event.metaKey;
      if (event.key === "Escape") {
        useUiStore.getState().exitPreview();
        useUiStore.getState().closeDrawer();
        useUiStore.getState().closeBookSettings();
      }
      if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void useEditorStore.getState().flushSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const prev = prevSize.current;
      const ui = useUiStore.getState();
      if (prev.width >= COMPACT_RIGHT_BREAKPOINT && width < COMPACT_RIGHT_BREAKPOINT && !ui.rightCollapsed) {
        useUiStore.setState({ rightCollapsed: true });
      }
      if (prev.width >= COMPACT_LEFT_BREAKPOINT && width < COMPACT_LEFT_BREAKPOINT && !ui.leftCollapsed) {
        useUiStore.setState({ leftCollapsed: true });
      }
      if (prev.height >= COMPACT_DOCK_BREAKPOINT && height < COMPACT_DOCK_BREAKPOINT && !ui.dockCollapsed) {
        useUiStore.setState({ dockCollapsed: true });
      }
      prevSize.current = { width, height };
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const showEditorChrome = view === "chapters" || view === "book";

  return (
    <div className="flex h-full w-full flex-col bg-[#07111f] text-[#e6eef8]">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        {!previewing ? <IconNav /> : null}
        {showEditorChrome && !leftCollapsed && !previewing ? (
          <>
            <aside
              style={{ flexBasis: leftWidth }}
              className="flex min-w-[120px] max-w-[240px] shrink-[4] grow-0 basis-0 flex-col"
            >
              <button
                type="button"
                title="Bölüm panelini kapat"
                aria-label="Bölüm panelini kapat"
                className="flex h-7 shrink-0 items-center justify-end gap-1 border-b border-[#1c314c] bg-[#0c1829] px-2 text-[11px] text-[#8aa0b8] hover:bg-[#163056] hover:text-white"
                onClick={() => useUiStore.getState().toggleLeft()}
              >
                Kapat
                <PanelLeftClose size={14} />
              </button>
              <div className="min-h-0 flex-1">
                <ChapterTree />
              </div>
            </aside>
            <ResizeHandle value={leftWidth} onChange={setLeftWidth} />
          </>
        ) : showEditorChrome && leftCollapsed && !previewing ? (
          <button
            type="button"
            title="Bölüm panelini aç"
            aria-label="Bölüm panelini aç"
            className="flex w-8 shrink-0 items-center justify-center border-r border-[#1c314c] bg-[#0c1829] text-[#8aa0b8] hover:bg-[#13233a] hover:text-white"
            onClick={() => useUiStore.getState().toggleLeft()}
          >
            <PanelLeftOpen size={16} />
          </button>
        ) : null}
        <main className="min-w-0 flex-[1_1_68%] bg-[#07111f]">
          {loading && !loaded ? (
            <div className="flex h-full items-center justify-center text-sm text-[#8aa0b8]">Yükleniyor…</div>
          ) : error && !loaded ? (
            <div className="flex h-full items-center justify-center text-sm text-red-400">{error}</div>
          ) : (
            <ViewRouter view={view} />
          )}
        </main>
        {showEditorChrome && !rightCollapsed && !previewing ? (
          <>
            <ResizeHandle value={rightWidth} onChange={setRightWidth} reverse />
            <aside
              style={{ flexBasis: rightWidth }}
              className="flex min-h-0 min-w-[140px] max-w-[280px] shrink-[4] grow-0 basis-0 flex-col"
            >
              <button
                type="button"
                title="Paneli kapat"
                aria-label="Paneli kapat"
                className="flex h-7 shrink-0 items-center justify-end gap-1 border-b border-[#1c314c] bg-[#0c1829] px-2 text-[11px] text-[#8aa0b8] hover:bg-[#163056] hover:text-white"
                onClick={() => useUiStore.getState().toggleRight()}
              >
                Kapat
                <PanelRightClose size={14} />
              </button>
              <div className="min-h-0 flex-1">
                <RightPanel />
              </div>
            </aside>
          </>
        ) : showEditorChrome && rightCollapsed && !previewing ? (
          <button
            type="button"
            title="Özellik panelini aç"
            aria-label="Özellik panelini aç"
            className="flex w-8 shrink-0 items-center justify-center border-l border-[#1c314c] bg-[#0c1829] text-[#8aa0b8] hover:bg-[#13233a] hover:text-white"
            onClick={() => useUiStore.getState().toggleRight()}
          >
            <PanelRightOpen size={16} />
          </button>
        ) : null}
      </div>
      {showEditorChrome && !previewing ? <StatusBar /> : null}
      {/* Alt panel: dar/kısa ekranda kapalı (28px); açıkken 158px. StatusBar ince kalır. */}
      {showEditorChrome && !previewing ? <BottomDock /> : null}
      <SelectionBubble />
      <SideDrawer />
      <BookSettingsDialog />
    </div>
  );
}

function ViewRouter({ view }: { view: string }) {
  switch (view) {
    case "library":
      return <LibraryView />;
    case "book":
    case "chapters":
      return <EditorWorkspace />;
    case "media":
      return <MediaView />;
    case "templates":
      return <TemplatesView />;
    case "export":
      return <ExportView />;
    case "settings":
      return <SettingsView />;
    default:
      return <EditorWorkspace />;
  }
}
