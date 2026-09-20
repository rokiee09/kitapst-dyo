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

  const page = (
    <article
      className={cn(
        "book-page relative w-full shadow-[0_18px_50px_rgba(0,0,0,0.35)]",
        dark ? "book-page-dark" : "bg-white",
        previewing && previewMode === "phone"
          ? "min-h-[640px] rounded-none px-5 pb-16 pt-8"
          : previewing && previewMode === "tablet"
            ? "min-h-[720px] rounded-md px-10 pb-24 pt-10"
            : previewing
              ? "min-h-[calc(100vh-220px)] max-w-[760px] rounded-sm px-16 pb-28 pt-14"
              : "min-h-[calc(100vh-280px)] max-w-[820px] rounded-xl px-12 pb-40 pt-12",
      )}
      style={paperStyle}
    >
      {previewing ? (
        <header className={cn("mb-8 border-b pb-4", dark ? "border-white/10" : "border-[#e8e0d4]")}>
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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={flowBlocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {blocks.length === 0 && editable ? <PageStructurePicker /> : null}
            {blocks.length === 0 && previewing ? (
              <p className="text-sm text-[#5b6578]">Bu bölümde henüz içerik yok.</p>
            ) : null}
            {flowBlocks.map((block) => (
              <BlockWrapper key={block.id} block={block} editable={editable}>
                <BlockView block={block} editable={editable} />
              </BlockWrapper>
            ))}
          </div>
        </SortableContext>
      {freeBlocks.map((block) => (
        <BlockWrapper key={block.id} block={block} editable={editable}>
          <BlockView block={block} editable={editable} />
        </BlockWrapper>
      ))}
      </DndContext>
      {book?.pageNumbers ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-10 bottom-8 text-xs tracking-widest opacity-70",
            pageNumberAlignClass(book.pageNumberAlign),
          )}
        >
          {chapterPageNumber(chapters, selectedChapterId, book.pageNumberStart ?? 1)}
        </div>
      ) : null}
    </article>
  );

  return (
    <DeviceFrame mode={previewMode} active={previewing}>
      {previewing && previewMode === "book" ? (
        <div className="flex justify-center">{page}</div>
      ) : previewing ? (
        page
      ) : (
        <div className="flex justify-center px-8 py-8">{page}</div>
      )}
    </DeviceFrame>
  );
}
