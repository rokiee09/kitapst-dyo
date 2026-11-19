import type { ReactNode } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  MoreHorizontal,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { tr } from "@/i18n/tr";
import { cn } from "@/lib/utils";
import { applyLink } from "@/utils/links";
import {
  PAGE_FONTS,
  LINE_SPACINGS,
  LIST_MARKER_OPTIONS,
  HEADING_SIZE_OPTIONS,
  effectiveHeadingSize,
  parseHeadingSize,
} from "@/features/blocks/blockStyle";
import { InsertBlockButton } from "@/features/blocks/InsertBlockButton";
import { SpecialCharsButton } from "@/features/editor/SpecialCharsButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEditorStore } from "@/stores/editorStore";
import { useUiStore } from "@/stores/uiStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { emptyDoc } from "@/utils/tiptap";
import { PageNumberControls } from "@/features/editor/PageNumberControls";
import { Button } from "@/components/ui/button";

export function FormattingToolbar() {
  const editor = useEditorStore((state) => state.activeEditor);
  const selected = useEditorStore((state) =>
    state.blocks.find((block) => block.id === state.selectedBlockId),
  );
  const zoom = useUiStore((state) => state.zoom);
  const zoomFit = useUiStore((state) => state.zoomFit);
  const setZoom = useUiStore((state) => state.setZoom);
  const setZoomFit = useUiStore((state) => state.setZoomFit);
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
        block.id === selected.id
          ? {
              ...block,
              type: "heading" as const,
              data,
              style: { ...block.style, headingSize: level, listMarker: undefined },
            }
          : block,
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
      <InsertBlockButton afterBlockId={selected?.id ?? null} />
      <span className="mx-1 h-4 w-px bg-[#1c314c]" />
      <select
        className="h-8 rounded-md border border-[#1c314c] bg-[#102038] px-2 text-xs text-white"
        title="Başlık boyutu"
        value={headingValue}
        onChange={(event) => applyHeadingSize(parseHeadingSize(event.target.value))}
      >
        {HEADING_SIZE_OPTIONS.map((item) => (
          <option key={item.value || "default"} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
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
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <List size={15} />
      </ToolButton>
      <ToolButton
        label={tr.editor.numberedList}
        active={editor?.isActive("orderedList")}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={15} />
      </ToolButton>
      <ToolButton label="Sola" active={editor?.isActive({ textAlign: "left" })} onClick={() => applyPageAlign("left")}>
        <AlignLeft size={15} />
      </ToolButton>
      <ToolButton label="Ortala" active={editor?.isActive({ textAlign: "center" })} onClick={() => applyPageAlign("center")}>
        <AlignCenter size={15} />
      </ToolButton>
      <ToolButton label="Sağa" active={editor?.isActive({ textAlign: "right" })} onClick={() => applyPageAlign("right")}>
        <AlignRight size={15} />
      </ToolButton>
      <ToolButton
        label="İki yana"
        active={editor?.isActive({ textAlign: "justify" })}
        onClick={() => applyPageAlign("justify")}
      >
        <AlignJustify size={15} />
      </ToolButton>
      <ToolButton label={tr.editor.link} onClick={() => applyLink(editor)}>
        <Link2 size={15} />
      </ToolButton>
      <ToolButton label={tr.editor.undo} onClick={() => editor?.chain().focus().undo().run()}>
        <Undo2 size={15} />
      </ToolButton>
      <ToolButton label={tr.editor.redo} onClick={() => editor?.chain().focus().redo().run()}>
        <Redo2 size={15} />
      </ToolButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="secondary" title="Diğer">
            <MoreHorizontal size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Diğer biçimler</DropdownMenuLabel>
          <div className="space-y-2 p-2" onClick={(event) => event.stopPropagation()}>
            <label className="flex items-center justify-between gap-2 text-xs text-[#8aa0b8]">
              Yazı rengi
              <input
                type="color"
                className="h-7 w-7 cursor-pointer rounded border border-[#1c314c] bg-[#102038] p-0"
                value={
                  typeof editor?.getAttributes("textStyle").color === "string" &&
                  String(editor.getAttributes("textStyle").color).startsWith("#")
                    ? String(editor.getAttributes("textStyle").color)
                    : "#152033"
                }
                onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()}
              />
            </label>
            <label className="block text-xs text-[#8aa0b8]">
              Yazı boyutu
              <select
                className="mt-1 h-8 w-full rounded-md border border-[#1c314c] bg-[#102038] px-1 text-[11px] text-white"
                value={String(editor?.getAttributes("textStyle").fontSize ?? "")}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) editor?.chain().focus().unsetFontSize().run();
                  else editor?.chain().focus().setFontSize(value).run();
                }}
              >
                <option value="">Varsayılan</option>
                <option value="12px">12</option>
                <option value="14px">14</option>
                <option value="16px">16</option>
                <option value="18px">18</option>
                <option value="22px">22</option>
                <option value="28px">28</option>
              </select>
            </label>
            <label className="block text-xs text-[#8aa0b8]">
              Satır aralığı
              <select
                className="mt-1 h-8 w-full rounded-md border border-[#1c314c] bg-[#102038] px-1 text-[11px] text-white"
                value={String(selected?.style.lineHeight ?? book?.lineHeight ?? 1.15)}
                onChange={(event) => {
                  const lineHeight = Number(event.target.value);
                  if (selected) {
                    useEditorStore.getState().updateBlockLocal(selected.id, {
                      style: { ...selected.style, lineHeight },
                    });
                    useEditorStore.getState().scheduleSave(selected.id);
                  }
                  if (book) void updateBook({ ...book, lineHeight }, { silent: true });
                }}
              >
                {LINE_SPACINGS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-[#8aa0b8]">
              Madde işareti
              <select
                className="mt-1 h-8 w-full rounded-md border border-[#1c314c] bg-[#102038] px-1 text-[11px] text-white"
                disabled={selected?.type === "heading"}
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
            </label>
            <SpecialCharsButton editor={editor} />
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Sayfa</DropdownMenuLabel>
          <div className="space-y-2 p-2" onClick={(event) => event.stopPropagation()}>
            <label className="flex items-center justify-between gap-2 text-xs text-[#8aa0b8]">
              Sayfa rengi
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
            <label className="flex items-center justify-between gap-2 text-xs text-[#8aa0b8]">
              Metin rengi
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
            <label className="block text-xs text-[#8aa0b8]">
              Yazı tipi
              <select
                className="mt-1 h-8 w-full rounded-md border border-[#1c314c] bg-[#102038] px-1 text-[11px] text-white"
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
            </label>
            <PageNumberControls compact />
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => useUiStore.getState().openBookSettings()}
          >
            Kitap ayarları…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden text-[10px] text-[#8aa0b8] sm:inline" title="Sayfa her zaman 760px; dar alanda Sığdır küçültür">
          Sayfa 760px
        </span>
        <select
          className="h-8 rounded-md border border-[#1c314c] bg-[#102038] px-2 text-xs text-white"
          value={zoomFit ? "fit" : String(zoom)}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "fit") {
              setZoomFit(true);
              return;
            }
            setZoom(Number(value));
          }}
          title="Yakınlaştırma — Sığdır: sayfayı yazma alanına sığdırır"
        >
          <option value="fit">Sığdır</option>
          <option value="50">%50</option>
          <option value="75">%75</option>
          <option value="90">%90</option>
          <option value="100">%100</option>
          <option value="125">%125</option>
          <option value="150">%150</option>
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
