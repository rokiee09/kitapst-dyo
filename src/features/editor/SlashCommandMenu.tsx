import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { matchSlashItems, type BlockInsertItem } from "@/features/blocks/blockInsertItems";
import { useEditorStore } from "@/stores/editorStore";
import { cn } from "@/lib/utils";

interface SlashState {
  query: string;
  from: number;
  to: number;
  top: number;
  left: number;
}

/** Editörde / ile blok ekleme. */
export function useSlashCommands(editor: Editor | null, blockId: string) {
  const [state, setState] = useState<SlashState | null>(null);
  const [index, setIndex] = useState(0);
  const stateRef = useRef(state);
  const indexRef = useRef(index);
  const items = useMemo(() => (state ? matchSlashItems(state.query) : []), [state]);
  const itemsRef = useRef(items);
  stateRef.current = state;
  indexRef.current = index;
  itemsRef.current = items;

  useEffect(() => {
    if (!editor) return;

    function onUpdate() {
      if (!editor || editor.isDestroyed) return;
      const { from, empty } = editor.state.selection;
      if (!empty) {
        setState(null);
        return;
      }
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 40), from, "\n", "\n");
      const match = textBefore.match(/(?:^|\s)\/([^\s/]*)$/);
      if (!match) {
        setState(null);
        return;
      }
      const query = match[1] ?? "";
      const start = from - query.length - 1;
      const coords = editor.view.coordsAtPos(from);
      setState({
        query,
        from: start,
        to: from,
        top: coords.bottom + 6,
        left: coords.left,
      });
      setIndex(0);
    }

    function pick(item: BlockInsertItem, slash: SlashState) {
      if (!editor) return;
      editor.chain().focus().deleteRange({ from: slash.from, to: slash.to }).run();
      setState(null);
      void useEditorStore.getState().addBlock(item.type, blockId);
    }

    function onKeyDown(event: KeyboardEvent) {
      const slash = stateRef.current;
      const list = itemsRef.current;
      if (!slash || !list.length) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setState(null);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setIndex((value) => Math.min(list.length - 1, value + 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setIndex((value) => Math.max(0, value - 1));
        return;
      }
      if (event.key === "Enter") {
        const item = list[indexRef.current];
        if (!item) return;
        event.preventDefault();
        pick(item, slash);
      }
    }

    editor.on("update", onUpdate);
    editor.on("selectionUpdate", onUpdate);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      editor.off("update", onUpdate);
      editor.off("selectionUpdate", onUpdate);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [editor, blockId]);

  if (!state || items.length === 0) return null;

  return (
    <div
      className="fixed z-[70] max-h-64 w-56 overflow-auto rounded-md border border-[#1c314c] bg-[#0c1829] p-1 shadow-xl"
      style={{ top: state.top, left: state.left }}
    >
      <p className="px-2 py-1 text-[10px] text-[#6b7f9a]">Blok ekle — /komut</p>
      {items.map((item, i) => (
        <button
          key={item.type}
          type="button"
          className={cn(
            "flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-[#d7e3f4] hover:bg-[#163056]",
            i === index && "bg-[#163056]",
          )}
          onMouseDown={(event) => {
            event.preventDefault();
            if (!editor) return;
            editor.chain().focus().deleteRange({ from: state.from, to: state.to }).run();
            setState(null);
            void useEditorStore.getState().addBlock(item.type, blockId);
          }}
        >
          {item.label}
          <span className="ml-auto text-[10px] text-[#6b7f9a]">/{item.aliases[0]}</span>
        </button>
      ))}
    </div>
  );
}
