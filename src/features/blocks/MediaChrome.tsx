import type { ReactNode } from "react";
import { AlignCenter, AlignLeft, AlignRight, Trash2 } from "lucide-react";
import {
  MEDIA_LAYOUT_OPTIONS,
  applyLayoutMode,
  readLayoutMode,
  type MediaLayoutMode,
} from "@/features/blocks/mediaLayout";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { ContentBlock } from "@/types/domain";

export function MediaChrome({
  block,
  widthPercent,
  onWidth,
  onCaptionToggle,
  captionVisible,
  extra,
}: {
  block: ContentBlock;
  widthPercent: number;
  onWidth: (width: number) => void;
  onCaptionToggle?: () => void;
  captionVisible?: boolean;
  extra?: ReactNode;
}) {
  const mode = readLayoutMode(block.style);
  const book = useWorkspaceStore((state) => state.book);

  function setMode(next: MediaLayoutMode) {
    const blocks = useEditorStore.getState().blocks;
    const style = applyLayoutMode(block.style, next, blocks, block.id, book);
    useEditorStore.getState().updateBlockLocal(block.id, { style });
    useEditorStore.getState().scheduleSave(block.id);
  }

  function setAlign(align: "left" | "center" | "right") {
    const data =
      block.data && typeof block.data === "object"
        ? { ...(block.data as Record<string, unknown>), align }
        : { align };
    useEditorStore.getState().updateBlockLocal(block.id, { data });
    useEditorStore.getState().scheduleSave(block.id);
  }

  return (
    <div
      className="absolute left-1/2 top-0 z-20 flex -translate-x-1/2 -translate-y-[110%] flex-wrap items-center gap-1 rounded-md border border-[#1c314c] bg-[#0c1829] p-1 shadow-lg"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <select
        className="h-7 max-w-[140px] rounded border border-[#1c314c] bg-[#102038] px-1 text-[11px] text-white"
        value={mode}
        title="Yerleşim"
        onChange={(event) => setMode(event.target.value as MediaLayoutMode)}
      >
        {MEDIA_LAYOUT_OPTIONS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="rounded p-1 text-[#9fb3c9] hover:bg-[#163056] hover:text-white"
        title="Sola"
        onClick={() => setAlign("left")}
      >
        <AlignLeft size={13} />
      </button>
      <button
        type="button"
        className="rounded p-1 text-[#9fb3c9] hover:bg-[#163056] hover:text-white"
        title="Ortala"
        onClick={() => setAlign("center")}
      >
        <AlignCenter size={13} />
      </button>
      <button
        type="button"
        className="rounded p-1 text-[#9fb3c9] hover:bg-[#163056] hover:text-white"
        title="Sağa"
        onClick={() => setAlign("right")}
      >
        <AlignRight size={13} />
      </button>
      <label className="flex items-center gap-1 px-1 text-[10px] text-[#8aa0b8]">
        %{widthPercent}
        <input
          type="range"
          min={8}
          max={100}
          value={widthPercent}
          className="w-16 accent-blue-600"
          onChange={(event) => onWidth(Number(event.target.value))}
        />
      </label>
      {onCaptionToggle ? (
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-[10px] text-[#9fb3c9] hover:bg-[#163056] hover:text-white"
          onClick={onCaptionToggle}
        >
          {captionVisible ? "Alt yazı gizle" : "Alt yazı"}
        </button>
      ) : null}
      {extra}
      <button
        type="button"
        className="rounded p-1 text-red-300 hover:bg-red-600 hover:text-white"
        title="Sil"
        onClick={() => void useEditorStore.getState().removeBlock(block.id)}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
