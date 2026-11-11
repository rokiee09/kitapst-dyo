import { useLayoutEffect, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { BlockView } from "@/features/blocks/BlockView";
import { BlockWrapper } from "@/features/blocks/BlockWrapper";
import { DeviceFrame } from "@/features/preview/DeviceFrame";
import { BookSheet, BOOK_PAGE_HEIGHT } from "@/features/blocks/BookSheet";
import { PageFitNotice } from "@/features/blocks/PageFitNotice";
import {
  fitBlocksToPages,
  measureFlowHeights,
  measureHeader,
  sheetContentHeight,
  blockKindLabel,
  textExcerpt,
  type FitResult,
} from "@/features/blocks/pageFit";
import { PageStructurePicker } from "@/features/templates/PageStructurePicker";
import { isFree } from "@/features/blocks/blockStyle";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { cn } from "@/lib/utils";
import { chapterPageNumber, pageNumberAlignClass } from "@/utils/pageNumbers";
import type { PreviewMode } from "@/types/domain";

interface BlockCanvasProps {
  editable: boolean;
  previewMode: PreviewMode;
  previewing?: boolean;
  dark?: boolean;
}

export function BlockCanvas({
  editable,
  previewMode,
  previewing = false,
  dark = false,
}: BlockCanvasProps) {
  const blocks = useEditorStore((state) => state.blocks);
  const book = useWorkspaceStore((state) => state.book);
  const selectedChapterId = useWorkspaceStore((state) => state.selectedChapterId);
  const chapters = useWorkspaceStore((state) => state.chapters);
  const chapter = useWorkspaceStore((state) =>
    state.chapters.find((item) => item.id === selectedChapterId),
  );
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const rootRef = useRef<HTMLDivElement>(null);
  const fitSignature = useRef("");
  const fitRef = useRef<FitResult | null>(null);
  const [fit, setFit] = useState<FitResult | null>(null);
  const flowBlocks = blocks.filter((block) => !isFree(block.style));
  const freeBlocks = blocks.filter((block) => isFree(block.style));
  const pageColor = book?.pageColor || "#ffffff";
  const inkColor = book?.inkColor || "#152033";
  const fontFamily = book?.fontFamily || "Segoe UI";
  const paperStyle = dark
    ? {
        background: "#111827",
        color: "#e5e7eb",
        fontFamily,
        ["--ks-line-height" as string]: String(book?.lineHeight ?? 1.15),
      }
    : {
        background: pageColor,
        color: inkColor,
        fontFamily,
        ["--ks-line-height" as string]: String(book?.lineHeight ?? 1.15),
      };

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const article = root.querySelector("article");
      const pageHeight = article ? sheetContentHeight(article) : BOOK_PAGE_HEIGHT - 40 - 72;
      const heights = measureFlowHeights(root);
      const items = blocks
        .filter((block) => !isFree(block.style))
        .map((block) => ({
          id: block.id,
          height: heights.get(block.id) ?? 0,
          kind: block.type === "pageBreak" ? ("break" as const) : ("block" as const),
          label: textExcerpt(block.data, blockKindLabel(block.type)),
        }));
      const next = fitBlocksToPages(items, pageHeight, measureHeader(root), fitRef.current?.pages);
      const signature = JSON.stringify(next);
      if (signature === fitSignature.current) return;
      fitSignature.current = signature;
      fitRef.current = next;
      setFit(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [blocks]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = blocks.map((block) => block.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void useEditorStore.getState().reorder(next);
  }

  const fitIds = new Set(fit?.pages.flat() ?? []);
  const fitReady =
    Boolean(fit) &&
    flowBlocks.length > 0 &&
    flowBlocks.every((block) => fitIds.has(block.id)) &&
    fitIds.size === flowBlocks.length;
  const pageIds = fitReady && fit ? fit.pages : [flowBlocks.map((block) => block.id)];
  const warnings = fitReady && fit ? fit.warnings : [];
  const warningById = new Map(warnings.map((warning) => [warning.id, warning.action]));
  const flowById = new Map(flowBlocks.map((block) => [block.id, block]));
  const pageNumberBase = chapterPageNumber(chapters, selectedChapterId, book?.pageNumberStart ?? 1);

  const blockList = (ids: string[]) => (
    <div className="space-y-4" data-flow-stack="">
      {ids.map((id) => {
        const block = flowById.get(id);
        if (!block) return null;
        return (
          <BlockWrapper key={block.id} block={block} editable={editable} pageFit={warningById.get(block.id)}>
            <BlockView block={block} editable={editable} />
          </BlockWrapper>
        );
      })}
    </div>
  );

  const useSheet = !previewing || previewMode === "book";
  const sheets = (
    <div ref={rootRef} className={cn("flex w-full flex-col gap-6", !previewing && "px-3 py-6")}>
      <PageFitNotice warnings={warnings} />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={flowBlocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
          {pageIds.map((ids, index) => {
            const footer = book?.pageNumbers ? (
              <div
                className={cn(
                  "pointer-events-none absolute inset-x-10 bottom-8 text-xs tracking-widest opacity-70",
                  pageNumberAlignClass(book.pageNumberAlign),
                )}
              >
                {pageNumberBase + index}
              </div>
            ) : null;
            const body = (
              <>
                {index === 0 && previewing ? (
                  <header data-page-header="" className={cn("mb-8 border-b pb-4", dark ? "border-white/10" : "border-[#e8e0d4]")}>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#8aa0b8]">
                      {previewMode === "phone" ? "Telefon önizlemesi" : previewMode === "tablet" ? "Tablet önizlemesi" : "Kitap önizlemesi"}
                    </div>
                    <h1 className={cn("mt-1 text-xl font-semibold", dark ? "text-[#e5e7eb]" : "text-[#152033]")}>
                      {book?.title || "Kitap"}
                    </h1>
                    {chapter?.title ? (
                      <p className={cn("mt-1 text-sm", dark ? "text-[#94a3b8]" : "text-[#5b6578]")}>{chapter.title}</p>
                    ) : null}
                  </header>
                ) : null}
                {index === 0 && blocks.length === 0 && editable ? <PageStructurePicker /> : null}
                {index === 0 && blocks.length === 0 && previewing ? (
                  <p className="text-sm text-[#5b6578]">Bu bölümde henüz içerik yok.</p>
                ) : null}
                {blockList(ids)}
                {index === 0
                  ? freeBlocks.map((block) => (
                      <BlockWrapper key={block.id} block={block} editable={editable}>
                        <BlockView block={block} editable={editable} />
                      </BlockWrapper>
                    ))
                  : null}
              </>
            );
            if (!useSheet) {
              return (
                <article
                  key={`${index}-${ids[0] ?? "empty"}`}
                  className={cn(
                    "book-page relative w-full shadow-[0_18px_50px_rgba(0,0,0,0.35)]",
                    dark ? "book-page-dark" : "bg-white",
                    previewMode === "phone" ? "min-h-[640px] rounded-none px-5 pb-16 pt-8" : "min-h-[720px] rounded-md px-10 pb-24 pt-10",
                  )}
                  style={paperStyle}
                >
                  {body}
                  {footer}
                </article>
              );
            }
            return (
              <BookSheet
                key={`${index}-${ids[0] ?? "empty"}`}
                dark={dark}
                clip={false}
                fluid={!previewing}
                quietOverflow
                showGuide
                style={paperStyle}
                footer={footer}
              >
                {body}
              </BookSheet>
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );

  return (
    <DeviceFrame mode={previewMode} active={previewing}>
      {previewing && previewMode === "book" ? <div className="flex justify-center">{sheets}</div> : sheets}
    </DeviceFrame>
  );
}

