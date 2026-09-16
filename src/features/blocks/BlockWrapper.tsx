import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useEffect } from "react";
import { Copy, GripVertical, Move, Plus, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  blockBoxStyle,
  canFloat,
  clampBox,
  defaultFreeStyle,
  isFree,
  snapPercent,
} from "@/features/blocks/blockStyle";
import { useEditorStore } from "@/stores/editorStore";
import type { BlockStyle, ContentBlock } from "@/types/domain";

interface BlockWrapperProps {
  block: ContentBlock;
  children: ReactNode;
  editable: boolean;
}

export function BlockWrapper({ block, children, editable }: BlockWrapperProps) {
  const selected = useEditorStore((state) => state.selectedBlockId === block.id);
  const free = isFree(block.style);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: !editable || free,
  });

  const style: CSSProperties = {
    ...blockBoxStyle(block.style, free),
    transform: free ? undefined : CSS.Transform.toString(transform),
    transition: free ? undefined : transition,
    zIndex: free ? (selected ? 12 : 6) : undefined,
  };

  function currentStyle(): BlockStyle {
    return useEditorStore.getState().blocks.find((item) => item.id === block.id)?.style ?? block.style;
  }

  function patchStyle(next: BlockStyle) {
    useEditorStore.getState().updateBlockLocal(block.id, { style: next });
    useEditorStore.getState().scheduleSave(block.id);
  }

  function enableFree() {
    const index = useEditorStore.getState().blocks.findIndex((item) => item.id === block.id);
    patchStyle({ ...currentStyle(), ...defaultFreeStyle(block.type, Math.max(0, index)) });
  }

  function disableFree() {
    const styleNow = currentStyle();
    patchStyle({ ...styleNow, placement: "flow", x: undefined, y: undefined, width: undefined });
  }

  function startMove(event: ReactPointerEvent<HTMLElement>) {
    if (!editable || !free) return;
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, button, a, [contenteditable='true']")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const page = event.currentTarget.closest(".book-page");
    if (!page) return;
    const surface = page;
    const startX = event.clientX;
    const startY = event.clientY;
    const orig = currentStyle();
    const origX = orig.x ?? 6;
    const origY = orig.y ?? 8;
    const origW = orig.width ?? 88;

    function onMove(moveEvent: PointerEvent) {
      const rect = surface.getBoundingClientRect();
      const dx = ((moveEvent.clientX - startX) / Math.max(rect.width, 1)) * 100;
      const dy = ((moveEvent.clientY - startY) / Math.max(rect.height, 1)) * 100;
      const boxed = clampBox(snapPercent(origX + dx), snapPercent(origY + dy), origW);
      const styleNow = currentStyle();
      useEditorStore.getState().updateBlockLocal(block.id, {
        style: { ...styleNow, placement: "free", ...boxed },
      });
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      useEditorStore.getState().scheduleSave(block.id);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startResize(event: ReactPointerEvent<HTMLButtonElement>, edge: "e" | "w" | "se") {
    if (!editable || !free) return;
    event.preventDefault();
    event.stopPropagation();
    const page = event.currentTarget.closest(".book-page");
    if (!page) return;
    const surface = page;
    const startX = event.clientX;
    const orig = currentStyle();
    const origX = orig.x ?? 6;
    const origY = orig.y ?? 8;
    const origW = orig.width ?? 88;

    function onMove(moveEvent: PointerEvent) {
      const rect = surface.getBoundingClientRect();
      const dx = ((moveEvent.clientX - startX) / Math.max(rect.width, 1)) * 100;
      let x = origX;
      let width = origW;
      if (edge === "w") {
        width = origW - dx;
        x = origX + dx;
      } else {
        width = origW + dx;
      }
      const boxed = clampBox(snapPercent(x), origY, snapPercent(width));
      const styleNow = currentStyle();
      useEditorStore.getState().updateBlockLocal(block.id, {
        style: { ...styleNow, placement: "free", ...boxed },
      });
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      useEditorStore.getState().scheduleSave(block.id);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  useEffect(() => {
    if (!editable || !selected || !free) return;
    function onKey(event: KeyboardEvent) {
      if (!event.altKey) return;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const step = event.shiftKey ? 5 : 1;
      const styleNow = currentStyle();
      let x = styleNow.x ?? 6;
      let y = styleNow.y ?? 8;
      const width = styleNow.width ?? 88;
      if (event.key === "ArrowLeft") x -= step;
      if (event.key === "ArrowRight") x += step;
      if (event.key === "ArrowUp") y -= step;
      if (event.key === "ArrowDown") y += step;
      patchStyle({ ...styleNow, ...clampBox(x, y, width) });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editable, selected, free, block.id]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-md px-2 py-1",
        selected && !free && "ring-2 ring-blue-500",
        isDragging && "opacity-70",
        free && "cursor-grab rounded-sm p-0 active:cursor-grabbing",
        selected && free && "outline outline-1 outline-blue-500/80",
        block.style.align === "center" && "text-center",
        block.style.align === "right" && "text-right",
        block.style.align === "justify" && "text-justify",
        block.style.padding === "sm" && "py-0.5",
        block.style.padding === "lg" && "py-4",
      )}
      onClick={() => useEditorStore.getState().selectBlock(block.id)}
      onPointerDown={free && editable ? startMove : undefined}
    >
      {editable && !free ? (
        <div className="absolute -left-7 top-2 hidden flex-col items-center gap-1 group-hover:flex">
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-[#94a3b8] hover:bg-[#e8e0d0]"
            aria-label="Sıralamayı değiştir"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </button>
        </div>
      ) : null}

      <div>{children}</div>

      {editable && free && selected ? (
        <>
          <button
            type="button"
            aria-label="Soldan boyut"
            className="absolute top-1/2 left-0 z-20 h-6 w-1.5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-sm border border-blue-500 bg-white"
            onPointerDown={(event) => startResize(event, "w")}
          />
          <button
            type="button"
            aria-label="Sağdan boyut"
            className="absolute top-1/2 right-0 z-20 h-6 w-1.5 -translate-y-1/2 translate-x-1/2 cursor-ew-resize rounded-sm border border-blue-500 bg-white"
            onPointerDown={(event) => startResize(event, "e")}
          />
          <button
            type="button"
            aria-label="Köşeden boyut"
            className="absolute right-0 bottom-0 z-20 h-2.5 w-2.5 translate-x-1/2 translate-y-1/2 cursor-nwse-resize rounded-sm border border-blue-500 bg-white"
            onPointerDown={(event) => startResize(event, "se")}
          />
        </>
      ) : null}

      {editable && selected ? (
        <div className="absolute -top-9 left-0 z-30 flex gap-1 rounded bg-white/95 p-0.5 shadow">
          {canFloat(block.type) ? (
            <Button
              size="sm"
              variant="paper"
              title={free ? "Standart akışa al" : "Sayfada serbest taşı"}
              onClick={() => (free ? disableFree() : enableFree())}
            >
              <Move size={12} />
              {free ? "Akış" : "Taşı"}
            </Button>
          ) : null}
          <Button
            size="icon"
            variant="paper"
            onClick={() => void useEditorStore.getState().addBlock("paragraph", block.id)}
            aria-label="Blok ekle"
          >
            <Plus size={12} />
          </Button>
          <Button
            size="icon"
            variant="paper"
            onClick={() => void useEditorStore.getState().duplicateBlock(block.id)}
            aria-label="Çoğalt"
          >
            <Copy size={12} />
          </Button>
          <Button
            size="icon"
            variant="paper"
            onClick={() => void useEditorStore.getState().removeBlock(block.id)}
            aria-label="Sil"
          >
            <Trash2 size={12} />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
