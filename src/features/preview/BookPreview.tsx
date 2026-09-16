import { useEffect, useMemo, useState } from "react";
import { BlockView } from "@/features/blocks/BlockView";
import { BlockWrapper } from "@/features/blocks/BlockWrapper";
import { DeviceFrame } from "@/features/preview/DeviceFrame";
import { isFree } from "@/features/blocks/blockStyle";
import { blockService } from "@/services";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { buildChapterTree, displayChapterLabel, flattenChapterTree } from "@/utils/chapterTree";
import { pageNumberAlignClass } from "@/utils/pageNumbers";
import { cn } from "@/lib/utils";
import type { Chapter, ContentBlock, PreviewMode } from "@/types/domain";

export function BookPreview({
  previewMode,
  dark = false,
}: {
  previewMode: PreviewMode;
  dark?: boolean;
}) {
  const book = useWorkspaceStore((state) => state.book);
  const chapters = useWorkspaceStore((state) => state.chapters);
  const selectedChapterId = useWorkspaceStore((state) => state.selectedChapterId);
  const liveBlocks = useEditorStore((state) => state.blocks);
  const [loaded, setLoaded] = useState<{ chapter: Chapter; blocks: ContentBlock[] }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const ordered = useMemo(() => flattenChapterTree(buildChapterTree(chapters)), [chapters]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await useEditorStore.getState().flushSave();
        const pages = await Promise.all(
          ordered.map(async (chapter) => ({
            chapter,
            blocks:
              chapter.id === selectedChapterId
                ? useEditorStore.getState().blocks
                : await blockService.list(chapter.id),
          })),
        );
        if (!cancelled) {
          setLoaded(pages);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Kitap önizlemesi yüklenemedi.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ordered, selectedChapterId]);

  const pageColor = book?.pageColor || "#ffffff";
  const inkColor = book?.inkColor || "#152033";
  const fontFamily = book?.fontFamily || "Segoe UI";
  const paperStyle = { background: pageColor, color: inkColor, fontFamily };
  const start = book?.pageNumberStart ?? 1;

  const sheets = useMemo(() => {
    const items: { key: string; kind: "cover" | "toc" | "chapter"; chapter?: Chapter; blocks: ContentBlock[]; number: number | null }[] =
      [];
    items.push({ key: "cover", kind: "cover", blocks: [], number: null });
    if (ordered.length > 0) {
      items.push({ key: "toc", kind: "toc", blocks: [], number: null });
    }
    let page = start;
    for (const entry of loaded) {
      const source = entry.chapter.id === selectedChapterId ? liveBlocks : entry.blocks;
      const slices = splitByPageBreak(source);
      slices.forEach((blocks, index) => {
        items.push({
          key: `${entry.chapter.id}-${index}`,
          kind: "chapter",
          chapter: entry.chapter,
          blocks,
          number: book?.pageNumbers ? page : null,
        });
        page += 1;
      });
    }
    return items;
  }, [book?.pageNumbers, loaded, liveBlocks, ordered.length, selectedChapterId, start]);

  const paperClass =
    previewMode === "phone"
      ? "min-h-[640px] px-5 pb-16 pt-8"
      : previewMode === "tablet"
        ? "min-h-[720px] px-8 pb-20 pt-10"
        : "min-h-[920px] max-w-[760px] px-16 pb-24 pt-14";

  const inner = (
    <div className="flex flex-col items-center gap-8 py-6">
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {sheets.map((sheet) => (
        <article
          key={sheet.key}
          id={sheet.kind === "chapter" && sheet.chapter ? `preview-${sheet.chapter.id}` : sheet.key}
          className={cn(
            "book-page relative w-full shadow-[0_18px_50px_rgba(0,0,0,0.35)]",
            previewMode === "phone" ? "rounded-none" : "rounded-sm",
            paperClass,
          )}
          style={paperStyle}
        >
          {sheet.kind === "cover" ? (
            <CoverPage dark={dark} />
          ) : sheet.kind === "toc" ? (
            <TocPage chapters={ordered} dark={dark} />
          ) : (
            <ChapterPage chapter={sheet.chapter!} blocks={sheet.blocks} first={sheet.key.endsWith("-0")} />
          )}
          {sheet.number != null ? (
            <div
              className={cn(
                "pointer-events-none absolute inset-x-8 bottom-7 text-xs tracking-widest opacity-70",
                pageNumberAlignClass(book?.pageNumberAlign),
              )}
            >
              {sheet.number}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );

  return (
    <DeviceFrame mode={previewMode} active scroll>
      {inner}
    </DeviceFrame>
  );
}

function CoverPage({ dark }: { dark: boolean }) {
  const book = useWorkspaceStore((state) => state.book);
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <p className="text-[11px] uppercase tracking-[0.28em] opacity-60">Kitap Stüdyosu</p>
      <h1 className={cn("mt-6 text-4xl font-semibold leading-tight", dark ? "text-inherit" : "")}>
        {book?.title || "Kitap"}
      </h1>
      {book?.subtitle ? <p className="mt-4 max-w-md text-lg opacity-75">{book.subtitle}</p> : null}
      {book?.author ? <p className="mt-10 text-sm tracking-wide opacity-80">{book.author}</p> : null}
      {book?.publisher ? <p className="mt-2 text-xs opacity-60">{book.publisher}</p> : null}
      {book?.pageNumbers ? (
        <p className="mt-16 text-[11px] opacity-50">Sayfa numaraları bölüm sayfalarının altında görünür.</p>
      ) : (
        <p className="mt-16 text-[11px] opacity-40">Üst çubuktan “Sayfa numarası”nı açarak numaralandırabilirsiniz.</p>
      )}
    </div>
  );
}

function TocPage({ chapters, dark }: { chapters: Chapter[]; dark: boolean }) {
  return (
    <div>
      <h2 className={cn("mb-6 text-2xl font-semibold", dark ? "text-inherit" : "")}>İçindekiler</h2>
      <ol className="space-y-2">
        {chapters.map((chapter) => (
          <li key={chapter.id}>
            <a href={`#preview-${chapter.id}`} className="text-sm underline-offset-2 hover:underline">
              {displayChapterLabel(chapter)}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ChapterPage({
  chapter,
  blocks,
  first,
}: {
  chapter: Chapter;
  blocks: ContentBlock[];
  first: boolean;
}) {
  const flow = blocks.filter((block) => !isFree(block.style));
  const free = blocks.filter((block) => isFree(block.style));
  return (
    <div className="relative">
      {first ? <h1 className="mb-6 text-2xl font-semibold">{displayChapterLabel(chapter)}</h1> : null}
      <div className="space-y-4">
        {flow.length === 0 && first ? <p className="text-sm opacity-60">Bu bölümde henüz içerik yok.</p> : null}
        {flow.map((block) => (
          <BlockWrapper key={block.id} block={block} editable={false}>
            <BlockView block={block} editable={false} />
          </BlockWrapper>
        ))}
      </div>
      {free.map((block) => (
        <BlockWrapper key={block.id} block={block} editable={false}>
          <BlockView block={block} editable={false} />
        </BlockWrapper>
      ))}
    </div>
  );
}

function splitByPageBreak(blocks: ContentBlock[]): ContentBlock[][] {
  const pages: ContentBlock[][] = [[]];
  for (const block of blocks) {
    if (block.type === "pageBreak") {
      pages.push([]);
      continue;
    }
    pages[pages.length - 1].push(block);
  }
  return pages.length ? pages : [[]];
}
