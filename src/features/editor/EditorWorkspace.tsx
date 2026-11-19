import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { BlockCanvas } from "@/features/blocks/BlockCanvas";
import { BookPreview } from "@/features/preview/BookPreview";
import { FormattingToolbar } from "@/features/editor/FormattingToolbar";
import { PageNumberControls } from "@/features/editor/PageNumberControls";
import { BOOK_PAGE_WIDTH } from "@/features/blocks/BookSheet";
import { tr } from "@/i18n/tr";
import { useUiStore } from "@/stores/uiStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { PreviewMode } from "@/types/domain";

function fitZoom(availableWidth: number, mode: PreviewMode): number {
  const needed =
    mode === "phone" ? 390 + 48 + 16 : mode === "tablet" ? 780 + 48 + 16 : BOOK_PAGE_WIDTH + 24 + 16;
  if (availableWidth <= 0 || needed <= 0) return 100;
  const pct = Math.floor((availableWidth / needed) * 100);
  return Math.min(100, Math.max(60, pct));
}

export function EditorWorkspace() {
  const selectedChapterId = useWorkspaceStore((state) => state.selectedChapterId);
  const previewMode = useUiStore((state) => state.previewMode);
  const previewing = useUiStore((state) => state.previewing);
  const zoom = useUiStore((state) => state.zoom);
  const zoomFit = useUiStore((state) => state.zoomFit);
  const paperDark = useUiStore((state) => state.paperDark);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const measure = () => setScrollWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [previewing, selectedChapterId]);

  const effectiveZoom = zoomFit
    ? fitZoom(scrollWidth, previewing ? previewMode : "book")
    : zoom;
  const scale = effectiveZoom / 100;

  if (!previewing && !selectedChapterId) {
    return (
      <div className="flex h-full items-center justify-center bg-[#07111f] text-sm text-[#8aa0b8]">
        {tr.editor.noChapter}
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-[#07111f]">
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
      <div ref={scrollRef} className="paper-scroll flex-1 overflow-auto">
        <div
          className="mx-auto origin-top"
          style={
            {
              width: scale < 1 ? `${100 / scale}%` : "100%",
              transform: scale === 1 ? undefined : `scale(${scale})`,
              transformOrigin: "top center",
            } as CSSProperties
          }
        >
          {previewing ? (
            <BookPreview previewMode={previewMode} dark={paperDark} />
          ) : (
            <BlockCanvas editable previewMode={previewMode} previewing={false} dark={paperDark} />
          )}
        </div>
      </div>
      {!previewing ? (
        <div className="pointer-events-none absolute bottom-10 right-4 rounded bg-[#0b1220]/80 px-2 py-0.5 text-[10px] text-[#8aa0b8]">
          {zoomFit ? `Sığdır · %${effectiveZoom}` : `%${effectiveZoom}`}
        </div>
      ) : null}
    </div>
  );
}
