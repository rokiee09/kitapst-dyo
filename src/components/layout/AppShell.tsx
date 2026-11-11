import { useEffect } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { IconNav } from "@/components/layout/IconNav";
import { BottomDock } from "@/components/layout/BottomDock";
import { NotesView } from "@/features/notes/NotesView";
import { TemplatesView } from "@/features/templates/TemplatesView";
import { MediaView } from "@/features/media/MediaView";
import { ResizeHandle } from "@/components/layout/ResizeHandle";
import { TopBar } from "@/components/layout/TopBar";
import { ChapterTree } from "@/features/chapters/ChapterTree";
import { RightPanel } from "@/features/blocks/RightPanel";
import { EditorWorkspace } from "@/features/editor/EditorWorkspace";
import { LibraryView } from "@/features/library/LibraryView";
import { ExportView } from "@/features/export/ExportView";
import { SettingsView } from "@/features/settings/SettingsView";
import { StatsView } from "@/features/stats/StatsView";
import { useEditorStore } from "@/stores/editorStore";
import { useUiStore } from "@/stores/uiStore";
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.ctrlKey || event.metaKey;
      if (event.key === "Escape") {
        useUiStore.getState().exitPreview();
      }
      if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void useEditorStore.getState().flushSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
              className="min-w-[120px] max-w-[240px] shrink-[4] grow-0 basis-0"
            >
              <ChapterTree />
            </aside>
            <ResizeHandle value={leftWidth} onChange={setLeftWidth} />
          </>
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
      {showEditorChrome && !previewing ? <BottomDock /> : null}
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
    case "notes":
      return <NotesView />;
    case "stats":
      return <StatsView />;
    case "export":
      return <ExportView />;
    case "settings":
      return <SettingsView />;
    default:
      return <EditorWorkspace />;
  }
}
