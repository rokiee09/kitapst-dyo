import type { ReactNode } from "react";
import {
  AlignCenter,
  AlignJustify,
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
import { PAGE_FONTS, LINE_SPACINGS, LIST_MARKER_OPTIONS, HEADING_SIZE_OPTIONS, effectiveHeadingSize, parseHeadingSize } from "@/features/blocks/blockStyle";
import { SpecialCharsButton } from "@/features/editor/SpecialCharsButton";
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

  function applyHeadingSize(level: 1 | 2 | 3 | undefined) {
    if (!selected) return;
    const data = { ...((selected.data as Record<string, unknown> | null) ?? {}) };
    if (level) data.level = level;
    else delete data.level;
    data.content = editor?.getJSON() ?? emptyDoc();
    useEditorStore.getState().updateBlockLocal(selected.id, {
      data,
      style: { ...selected.style, headingSize: level },
    });
    if (level) {
      const blocks = useEditorStore.getState().blocks.map((block) =>
        block.id === selected.id ? { ...block, type: "heading" as const, data, style: { ...block.style, headingSize: level, listMarker: undefined } } : block,
      );
      useEditorStore.setState({ blocks });
      editor?.chain().focus().liftListItem("listItem").setHeading({ level }).run();
    } else {
      editor?.chain().focus().setParagraph().run();
    }
    void useEditorStore.getState().flushSave(selected.id);
  }

  function applyPageAlign(align: "left" | "center" | "right" | "justify") {
    editor?.chain().focus().setTextAlign(align).run();
    if (!selected) return;
    useEditorStore.getState().updateBlockLocal(selected.id, {
      style: { ...selected.style, align },
    });
    useEditorStore.getState().scheduleSave(selected.id);
  }

  const headingValue = String(effectiveHeadingSize(selected?.style, selected?.data) ?? "");

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-[#1c314c] bg-[#0c1829] px-3">
      <select
        className="h-8 rounded-md border border-[#1c314c] bg-[#102038] px-2 text-xs text-white"
        title="Başlık boyutu (isteğe bağlı)"
        value={headingValue}
        onChange={(event) => applyHeadingSize(parseHeadingSize(event.target.value))}
      >
        {HEADING_SIZE_OPTIONS.map((item) => (
          <option key={item.value || "default"} value={item.value}>
            {item.label}
          </option>
        ))}
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
      <ToolButton
        label={tr.editor.bulletList}
        active={editor?.isActive("bulletList")}
        onClick={() => {
          if (editor?.isActive("heading")) {
            editor.chain().focus().setParagraph().toggleBulletList().run();
            if (selected) {
              const blocks = useEditorStore.getState().blocks.map((block) =>
                block.id === selected.id
                  ? { ...block, type: "paragraph" as const, style: { ...selected.style, headingSize: undefined } }
                  : block,
              );
              useEditorStore.setState({ blocks });
            }
            return;
          }
          editor?.chain().focus().toggleBulletList().run();
        }}
      >
        <List size={15} />
      </ToolButton>
      <ToolButton
        label={tr.editor.numberedList}
        active={editor?.isActive("orderedList")}
        onClick={() => {
          if (editor?.isActive("heading")) {
            editor.chain().focus().setParagraph().toggleOrderedList().run();
            if (selected) {
              const blocks = useEditorStore.getState().blocks.map((block) =>
                block.id === selected.id
                  ? { ...block, type: "paragraph" as const, style: { ...selected.style, headingSize: undefined } }
                  : block,
              );
              useEditorStore.setState({ blocks });
            }
            return;
          }
          editor?.chain().focus().toggleOrderedList().run();
        }}
      >
        <ListOrdered size={15} />
      </ToolButton>
      <select
        className="h-8 max-w-[118px] rounded-md border border-[#1c314c] bg-[#102038] px-1 text-[11px] text-white"
        disabled={selected?.type === "heading"}
        title={selected?.type === "heading" ? "Başlıklarda madde işareti yok" : "Madde işareti (isteğe bağlı)"}
        value={selected?.style.listMarker ?? ""}
        onChange={(event) => {
          if (!selected || selected.type === "heading") return;
          const listMarker = event.target.value || undefined;
          useEditorStore.getState().updateBlockLocal(selected.id, {
            style: { ...selected.style, listMarker },
          });
          useEditorStore.getState().scheduleSave(selected.id);
        }}
      >
        {LIST_MARKER_OPTIONS.map((item) => (
          <option key={item.value || "default"} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <SpecialCharsButton editor={editor} />
      <ToolButton
        label="Sola yasla"
        active={editor?.isActive({ textAlign: "left" }) || selected?.style.align === "left"}
        onClick={() => applyPageAlign("left")}
      >
        <AlignLeft size={15} />
      </ToolButton>
      <ToolButton
        label="Ortala"
        active={editor?.isActive({ textAlign: "center" }) || selected?.style.align === "center"}
        onClick={() => applyPageAlign("center")}
      >
        <AlignCenter size={15} />
      </ToolButton>
      <ToolButton
        label="Sağa yasla"
        active={editor?.isActive({ textAlign: "right" }) || selected?.style.align === "right"}
        onClick={() => applyPageAlign("right")}
      >
        <AlignRight size={15} />
      </ToolButton>
      <ToolButton
        label="İki yana yasla"
        active={editor?.isActive({ textAlign: "justify" }) || selected?.style.align === "justify"}
        onClick={() => applyPageAlign("justify")}
      >
        <AlignJustify size={15} />
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
      <select
        className="h-8 max-w-[92px] rounded-md border border-[#1c314c] bg-[#102038] px-1 text-[11px] text-white"
        title="Satır aralığı"
        value={String(selected?.style.lineHeight ?? book?.lineHeight ?? 1.15)}
        onChange={(event) => {
          const lineHeight = Number(event.target.value);
          if (selected) {
            useEditorStore.getState().updateBlockLocal(selected.id, {
              style: { ...selected.style, lineHeight },
            });
            useEditorStore.getState().scheduleSave(selected.id);
          }
          if (book) {
            void updateBook({ ...book, lineHeight }, { silent: true });
          }
        }}
      >
        {LINE_SPACINGS.map((item) => (
          <option key={item.value} value={item.value}>
            Aralık {item.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        title="Yazım ve basit hataları bul"
        onClick={() => useUiStore.getState().openProofread()}
        className="flex h-7 shrink-0 items-center rounded bg-amber-600/80 px-2 text-[11px] font-semibold text-white hover:bg-amber-500"
      >
        Denetle
      </button>
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
