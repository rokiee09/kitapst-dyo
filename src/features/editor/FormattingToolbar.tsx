import type { ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  FileInput,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { tr } from "@/i18n/tr";
import { cn } from "@/lib/utils";
import { applyLink } from "@/utils/links";
import { PAGE_FONTS } from "@/features/blocks/blockStyle";
import { useEditorStore } from "@/stores/editorStore";
import { useUiStore } from "@/stores/uiStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { emptyDoc } from "@/utils/tiptap";
import { importWordIntoChapter } from "@/features/import/importWord";
import { PageNumberControls } from "@/features/editor/PageNumberControls";

export function FormattingToolbar() {
  const editor = useEditorStore((state) => state.activeEditor);
  const selected = useEditorStore((state) =>
    state.blocks.find((block) => block.id === state.selectedBlockId),
  );
  const zoom = useUiStore((state) => state.zoom);
  const setZoom = useUiStore((state) => state.setZoom);
  const book = useWorkspaceStore((state) => state.book);
  const updateBook = useWorkspaceStore((state) => state.updateBook);

  function convertToHeading(level: 1 | 2 | 3) {
    if (!selected) return;
    const data = {
      ...((selected.data as Record<string, unknown> | null) ?? {}),
      level,
      content: editor?.getJSON() ?? emptyDoc(),
    };
    useEditorStore.getState().updateBlockLocal(selected.id, { data });
    const blocks = useEditorStore.getState().blocks.map((block) =>
      block.id === selected.id ? { ...block, type: "heading" as const, data } : block,
    );
    useEditorStore.setState({ blocks });
    void useEditorStore.getState().flushSave(selected.id);
    editor?.chain().focus().setHeading({ level }).run();
  }

  function convertToParagraph() {
    if (!selected) return;
    const data = {
      ...((selected.data as Record<string, unknown> | null) ?? {}),
      content: editor?.getJSON() ?? emptyDoc(),
    };
    const blocks = useEditorStore.getState().blocks.map((block) =>
      block.id === selected.id ? { ...block, type: "paragraph" as const, data } : block,
    );
    useEditorStore.setState({ blocks });
    void useEditorStore.getState().flushSave(selected.id);
    editor?.chain().focus().setParagraph().run();
  }

  const headingValue =
    selected?.type === "heading"
      ? String(((selected.data as { level?: number } | null)?.level ?? 2) as number)
      : "p";

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 border-b border-[#1c314c] bg-[#0c1829] px-3">
      <select
        className="h-8 rounded-md border border-[#1c314c] bg-[#102038] px-2 text-xs text-white"
        value={headingValue}
        onChange={(event) => {
          const value = event.target.value;
          if (value === "p") convertToParagraph();
          else convertToHeading(Number(value) as 1 | 2 | 3);
        }}
      >
        <option value="p">{tr.editor.paragraph}</option>
        <option value="1">{tr.editor.heading1}</option>
        <option value="2">{tr.editor.heading2}</option>
        <option value="3">{tr.editor.heading3}</option>
      </select>
      <span className="mx-1 h-4 w-px bg-[#1c314c]" />
      <ToolButton label={tr.editor.bold} active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
        <Bold size={15} />
      </ToolButton>
      <ToolButton label={tr.editor.italic} active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
        <Italic size={15} />
      </ToolButton>
      <ToolButton
        label={tr.editor.underline}
        active={editor?.isActive("underline")}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon size={15} />
      </ToolButton>
      <span className="mx-1 h-4 w-px bg-[#1c314c]" />
      <ToolButton label={tr.editor.bulletList} active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
        <List size={15} />
      </ToolButton>
      <ToolButton
        label={tr.editor.numberedList}
        active={editor?.isActive("orderedList")}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={15} />
      </ToolButton>
      <ToolButton label="Sola hizala" active={editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()}>
        <AlignLeft size={15} />
      </ToolButton>
      <ToolButton label="Ortala" active={editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()}>
        <AlignCenter size={15} />
      </ToolButton>
      <ToolButton label="Sağa hizala" active={editor?.isActive({ textAlign: "right" })} onClick={() => editor?.chain().focus().setTextAlign("right").run()}>
        <AlignRight size={15} />
      </ToolButton>
      <ToolButton label={tr.editor.link} onClick={() => applyLink(editor)}>
        <Link2 size={15} />
      </ToolButton>
      <input
        type="color"
        title="Yazı rengi"
        className="h-7 w-7 cursor-pointer rounded border border-[#1c314c] bg-[#102038] p-0"
        value={
          typeof editor?.getAttributes("textStyle").color === "string" &&
          String(editor.getAttributes("textStyle").color).startsWith("#")
            ? String(editor.getAttributes("textStyle").color)
            : "#152033"
        }
        onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()}
      />
      <select
        className="h-8 max-w-[88px] rounded-md border border-[#1c314c] bg-[#102038] px-1 text-[11px] text-white"
        title="Yazı boyutu"
        value={String(editor?.getAttributes("textStyle").fontSize ?? "")}
        onChange={(event) => {
          const value = event.target.value;
          if (!value) editor?.chain().focus().unsetFontSize().run();
          else editor?.chain().focus().setFontSize(value).run();
        }}
      >
        <option value="">Boyut</option>
        <option value="12px">12</option>
        <option value="14px">14</option>
        <option value="16px">16</option>
        <option value="18px">18</option>
        <option value="22px">22</option>
        <option value="28px">28</option>
      </select>
      <ToolButton label="Word’den içe aktar" onClick={() => void importWordIntoChapter()}>
        <FileInput size={15} />
      </ToolButton>
      <ToolButton label="Görsel" onClick={() => void useEditorStore.getState().addBlock("image")}>
        <ImageIcon size={15} />
      </ToolButton>
      <span className="mx-1 h-4 w-px bg-[#1c314c]" />
      <ToolButton label={tr.editor.undo} onClick={() => editor?.chain().focus().undo().run()}>
        <Undo2 size={15} />
      </ToolButton>
      <ToolButton label={tr.editor.redo} onClick={() => editor?.chain().focus().redo().run()}>
        <Redo2 size={15} />
      </ToolButton>
      <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-1 text-[10px] text-[#8aa0b8]" title="Sayfa rengi">
          Sayfa
          <input
            type="color"
            className="h-7 w-7 cursor-pointer rounded border border-[#1c314c] bg-[#102038] p-0"
            value={book?.pageColor || "#ffffff"}
            onChange={(event) => {
              if (!book) return;
              void updateBook({ ...book, pageColor: event.target.value }, { silent: true });
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-[10px] text-[#8aa0b8]" title="Yazı rengi">
          Metin
          <input
            type="color"
            className="h-7 w-7 cursor-pointer rounded border border-[#1c314c] bg-[#102038] p-0"
            value={book?.inkColor || "#152033"}
            onChange={(event) => {
              if (!book) return;
              void updateBook({ ...book, inkColor: event.target.value }, { silent: true });
            }}
          />
        </label>
        <PageNumberControls compact />
        <select
          className="h-8 max-w-[110px] rounded-md border border-[#1c314c] bg-[#102038] px-1 text-[11px] text-white"
          title="Sayfa yazı tipi"
          value={book?.fontFamily || "Segoe UI"}
          onChange={(event) => {
            if (!book) return;
            void updateBook({ ...book, fontFamily: event.target.value }, { silent: true });
          }}
        >
          {PAGE_FONTS.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded-md border border-[#1c314c] bg-[#102038] px-2 text-xs text-white"
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
        >
          <option value={75}>%75</option>
          <option value={100}>%100</option>
          <option value={125}>%125</option>
          <option value={150}>%150</option>
        </select>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
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
