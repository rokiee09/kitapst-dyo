import { useEffect } from "react";
import type { JSONContent } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { useEditorStore } from "@/stores/editorStore";

interface RichTextEditorProps {
  blockId: string;
  content: JSONContent;
  editable?: boolean;
  placeholder?: string;
}

export function RichTextEditor({
  blockId,
  content,
  editable = true,
  placeholder = "Yazmaya başlayın…",
}: RichTextEditorProps) {
  const updateBlockLocal = useEditorStore((state) => state.updateBlockLocal);
  const scheduleSave = useEditorStore((state) => state.scheduleSave);
  const setActiveEditor = useEditorStore((state) => state.setActiveEditor);

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyleKit,
    ],
    content,
    editorProps: {
      attributes: {
        class: "tiptap",
      },
    },
    onUpdate: ({ editor: current }) => {
      const block = useEditorStore.getState().blocks.find((item) => item.id === blockId);
      if (!block) return;
      const data = { ...(block.data as Record<string, unknown>), content: current.getJSON() };
      updateBlockLocal(blockId, { data });
      scheduleSave(blockId);
    },
    onFocus: ({ editor: current }) => {
      setActiveEditor(current);
      useEditorStore.getState().selectBlock(blockId);
    },
  });

  useEffect(() => {
    return () => {
      if (useEditorStore.getState().activeEditor === editor) {
        setActiveEditor(null);
      }
    };
  }, [editor, setActiveEditor]);

  return <EditorContent editor={editor} />;
}
