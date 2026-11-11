import { BlockCanvas } from "@/features/blocks/BlockCanvas";
import { BookPreview } from "@/features/preview/BookPreview";
import { FormattingToolbar } from "@/features/editor/FormattingToolbar";
import { tr } from "@/i18n/tr";
import { useUiStore } from "@/stores/uiStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { CSSProperties } from "react";
import { PageNumberControls } from "@/features/editor/PageNumberControls";

export function EditorWorkspace() {
  const selectedChapterId = useWorkspaceStore((state) => state.selectedChapterId);
  const previewMode = useUiStore((state) => state.previewMode);
  const previewing = useUiStore((state) => state.previewing);
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
          <PageNumberControls compact />
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
