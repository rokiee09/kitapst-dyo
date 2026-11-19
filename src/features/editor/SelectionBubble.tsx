import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Bold, Italic, Link2, Underline as UnderlineIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyLink } from "@/utils/links";
import { useEditorStore } from "@/stores/editorStore";

/** Metin seçilince yanında çıkan küçük biçim çubuğu. */
export function SelectionBubble() {
  const editor = useEditorStore((state) => state.activeEditor);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!editor) {
      setBox(null);
      return;
    }

    function sync() {
      if (!editor || editor.isDestroyed || !editor.isEditable) {
        setBox(null);
        return;
      }
      const { from, to, empty } = editor.state.selection;
      if (empty || from === to) {
        setBox(null);
        return;
      }
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      const top = Math.min(start.top, end.top) - 44;
      const left = (start.left + end.right) / 2;
      setBox({ top: Math.max(8, top), left });
    }

    sync();
    editor.on("selectionUpdate", sync);
    editor.on("blur", () => setBox(null));
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      editor.off("selectionUpdate", sync);
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [editor]);

  if (!editor || !box) return null;

  return (
    <div
      className="pointer-events-auto fixed z-[60] flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-[#1c314c] bg-[#0c1829] p-1 shadow-xl"
      style={{ top: box.top, left: box.left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <BubbleBtn
        label="Kalın"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={14} />
      </BubbleBtn>
      <BubbleBtn
        label="İtalik"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={14} />
      </BubbleBtn>
      <BubbleBtn
        label="Altı çizili"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon size={14} />
      </BubbleBtn>
      <BubbleBtn label="Bağlantı" onClick={() => applyLink(editor as Editor)}>
        <Link2 size={14} />
      </BubbleBtn>
    </div>
  );
}

function BubbleBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded text-[#9fb3c9] hover:bg-[#163056] hover:text-white",
        active && "bg-blue-600/30 text-white",
      )}
    >
      {children}
    </button>
  );
}
