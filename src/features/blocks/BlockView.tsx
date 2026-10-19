import { Lightbulb } from "lucide-react";
import { CodeBlock } from "@/features/blocks/CodeBlock";
import { FileBlock } from "@/features/blocks/FileBlock";
import { ImageBlock } from "@/features/blocks/ImageBlock";
import { QrBlock } from "@/features/blocks/QrBlock";
import { RichTextEditor } from "@/features/blocks/RichTextEditor";
import { TableBlock } from "@/features/blocks/TableBlock";
import { VideoBlock } from "@/features/blocks/VideoBlock";
import { useEditorStore } from "@/stores/editorStore";
import { readBlockContent } from "@/utils/tiptap";
import type { ContentBlock } from "@/types/domain";

interface BlockViewProps {
  block: ContentBlock;
  editable: boolean;
}

export function BlockView({ block, editable }: BlockViewProps) {
  switch (block.type) {
    case "heading":
    case "paragraph":
    case "unorderedList":
      return (
        <RichTextEditor
          blockId={block.id}
          content={readBlockContent(block.data)}
          editable={editable}
        />
      );
    case "quote":
      return (
        <div className="rounded-lg border border-blue-100 bg-[#f8fafc] px-5 py-4">
          <div className="mb-1 text-3xl leading-none text-blue-400">“</div>
          <RichTextEditor
            blockId={block.id}
            content={readBlockContent(block.data)}
            editable={editable}
          />
        </div>
      );
    case "orderedList":
      return <StepsView block={block} editable={editable} />;
    case "infoBox":
      return <CalloutView block={block} editable={editable} variant="info" />;
    case "warningBox":
      return <CalloutView block={block} editable={editable} variant="warning" />;
    case "image":
      return <ImageBlock block={block} editable={editable} />;
    case "video":
      return <VideoBlock block={block} editable={editable} />;
    case "qr":
      return <QrBlock block={block} editable={editable} />;
    case "divider":
      return <hr className="my-4 border-[#d6d0c4]" />;
    case "pageBreak":
      return (
        <div className="my-4 border-t border-dashed border-[#b8b09f] pt-2 text-center text-xs tracking-wide text-[#8a8273]">
          SAYFA SONU
        </div>
      );
    case "table":
      return <TableBlock block={block} editable={editable} />;
    case "file":
      return <FileBlock block={block} editable={editable} />;
    case "code":
      return <CodeBlock block={block} editable={editable} />;
    default:
      return (
        <RichTextEditor
          blockId={block.id}
          content={readBlockContent(block.data)}
          editable={editable}
        />
      );
  }
}

function CalloutView({
  block,
  editable,
  variant,
}: {
  block: ContentBlock;
  editable: boolean;
  variant: "info" | "warning";
}) {
  const data = (block.data ?? {}) as { title?: string };
  const fallback = variant === "warning" ? "UYARI" : "ÖNEMLİ";

  return (
    <div
      className={
        variant === "warning"
          ? "flex gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3"
          : "flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
      }
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/80 text-amber-950">
        <Lightbulb size={16} />
      </div>
      <div className="min-w-0 flex-1">
        {editable ? (
          <input
            className="mb-1 w-full bg-transparent text-xs font-bold tracking-wide text-amber-800 outline-none"
            value={data.title ?? fallback}
            onChange={(event) => {
              const current = (useEditorStore.getState().blocks.find((item) => item.id === block.id)?.data ??
                {}) as Record<string, unknown>;
              useEditorStore.getState().updateBlockLocal(block.id, {
                data: { ...current, title: event.target.value },
              });
              useEditorStore.getState().scheduleSave(block.id);
            }}
          />
        ) : (
          <div className="mb-1 text-xs font-bold tracking-wide text-amber-800">{data.title ?? fallback}</div>
        )}
        <RichTextEditor
          blockId={block.id}
          content={readBlockContent(block.data)}
          editable={editable}
        />
      </div>
    </div>
  );
}

function StepsView({ block, editable }: { block: ContentBlock; editable: boolean }) {
  const data = (block.data ?? {}) as { title?: string };
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      {editable ? (
        <input
          className="mb-2 w-full bg-transparent text-sm font-semibold text-emerald-800 outline-none"
          value={data.title ?? "Uygulama Adımları"}
          onChange={(event) => {
            const current = (useEditorStore.getState().blocks.find((item) => item.id === block.id)?.data ??
              {}) as Record<string, unknown>;
            useEditorStore.getState().updateBlockLocal(block.id, {
              data: { ...current, title: event.target.value },
            });
            useEditorStore.getState().scheduleSave(block.id);
          }}
        />
      ) : (
        <div className="mb-2 text-sm font-semibold text-emerald-800">{data.title ?? "Uygulama Adımları"}</div>
      )}
      <RichTextEditor
        blockId={block.id}
        content={readBlockContent(block.data)}
        editable={editable}
      />
    </div>
  );
}
