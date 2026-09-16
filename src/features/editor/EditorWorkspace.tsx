import { BookOpen, Smartphone, Tablet } from "lucide-react";
import { BlockCanvas } from "@/features/blocks/BlockCanvas";
import { BookPreview } from "@/features/preview/BookPreview";
import { FormattingToolbar } from "@/features/editor/FormattingToolbar";
import { tr } from "@/i18n/tr";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/uiStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { CSSProperties } from "react";
import type { PreviewMode } from "@/types/domain";
import { PageNumberControls } from "@/features/editor/PageNumberControls";

const PREVIEW_MODES: { id: PreviewMode; label: string; icon: typeof BookOpen }[] = [
  { id: "book", label: "Kitap", icon: BookOpen },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "phone", label: "Telefon", icon: Smartphone },
];

export function EditorWorkspace() {
  const selectedChapterId = useWorkspaceStore((state) => state.selectedChapterId);
  const previewMode = useUiStore((state) => state.previewMode);
  const previewing = useUiStore((state) => state.previewing);
  const setPreviewMode = useUiStore((state) => state.setPreviewMode);
  const exitPreview = useUiStore((state) => state.exitPreview);
  const zoom = useUiStore((state) => state.zoom);
  const paperDark = useUiStore((state) => state.paperDark);

  if (!previewing && !selectedChapterId) {
    return (
      <div className="flex h-full items-center justify-center bg-[#07111f] text-sm text-[#8aa0b8]">
        {tr.editor.noChapter}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#07111f]">
      {previewing ? (
        <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-[#1c314c] bg-[#0c1829] px-3">
          <p className="min-w-0 truncate text-xs text-[#9fb3c9]">
            <span className="mr-2 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Önizleme
            </span>
            Tüm kitap — kapak, içindekiler ve bölümler
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <PageNumberControls compact />
            {PREVIEW_MODES.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  type="button"
                  title={mode.label}
                  className={cn(
                    "flex h-7 items-center gap-1 rounded px-2 text-[11px] text-[#9fb3c9] hover:bg-[#163056] hover:text-white",
                    previewMode === mode.id && "bg-blue-600/30 text-white",
                  )}
                  onClick={() => setPreviewMode(mode.id)}
                >
                  <Icon size={13} />
                  {mode.label}
                </button>
              );
            })}
            <button
              type="button"
              className="ml-2 rounded-md border border-[#1c314c] bg-[#102038] px-2.5 py-1 text-xs text-white hover:bg-[#163056]"
              onClick={exitPreview}
            >
              Düzenlemeye dön
            </button>
          </div>
        </div>
      ) : (
        <FormattingToolbar />
      )}
      <div className="paper-scroll flex-1 overflow-auto">
        <div style={{ zoom: `${zoom}%` } as CSSProperties}>
          {previewing ? (
            <BookPreview previewMode={previewMode} dark={paperDark} />
          ) : (
            <BlockCanvas editable previewMode={previewMode} previewing={false} dark={paperDark} />
          )}
        </div>
      </div>
    </div>
  );
}
