import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BlockView } from "@/features/blocks/BlockView";
import { BlockWrapper } from "@/features/blocks/BlockWrapper";
import { DeviceFrame } from "@/features/preview/DeviceFrame";
import { BOOK_PAGE_HEIGHT, BookSheet } from "@/features/blocks/BookSheet";
import { PageFitNotice } from "@/features/blocks/PageFitNotice";
import {
  blockKindLabel,
  fitBlocksToPages,
  measureFlowHeights,
  measureHeader,
  sheetContentHeight,
  textExcerpt,
  type FitResult,
  type FitWarning,
} from "@/features/blocks/pageFit";
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fits, setFits] = useState<Record<string, FitResult>>({});
  const sheetRefs = useRef<(HTMLElement | null)[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);
  const fitsRef = useRef<Record<string, FitResult>>({});
  const fitSignature = useRef("");

  const ordered = useMemo(() => flattenChapterTree(buildChapterTree(chapters)), [chapters]);
  const chapterSources = useMemo(
    () =>
      loaded.map((entry) => ({
        id: entry.chapter.id,
        blocks: entry.chapter.id === selectedChapterId ? liveBlocks : entry.blocks,
      })),
    [loaded, liveBlocks, selectedChapterId],
  );

  useLayoutEffect(() => {
    if (previewMode !== "book") return;
    const root = previewRef.current;
    if (!root) return;
    const measure = () => {
      const article = root.querySelector("article");
      const pageHeight = article ? sheetContentHeight(article) : BOOK_PAGE_HEIGHT - 56 - 96;
      const heights = measureFlowHeights(root);
      const next: Record<string, FitResult> = {};
      for (const source of chapterSources) {
        const section = root.querySelector<HTMLElement>(`[data-chapter-flow="${source.id}"]`);
        const items = source.blocks
          .filter((block) => !isFree(block.style))
          .map((block) => ({
            id: block.id,
            height: heights.get(block.id) ?? 0,
            kind: block.type === "pageBreak" ? ("break" as const) : ("block" as const),
            label: textExcerpt(block.data, blockKindLabel(block.type)),
          }));
        next[source.id] = fitBlocksToPages(items, pageHeight, section ? measureHeader(section) : 0, fitsRef.current[source.id]?.pages);
      }
      const signature = JSON.stringify(next);
      if (signature === fitSignature.current) return;
      fitSignature.current = signature;
      fitsRef.current = next;
      setFits(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [chapterSources, previewMode]);

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
  const paperStyle = dark
    ? {
        background: "#111827",
        color: "#e5e7eb",
        fontFamily,
        ["--ks-line-height" as string]: String(book?.lineHeight ?? 1.15),
      }
    : {
        background: pageColor,
        color: inkColor,
        fontFamily,
        ["--ks-line-height" as string]: String(book?.lineHeight ?? 1.15),
      };
  const start = book?.pageNumberStart ?? 1;

  const sheets = useMemo(() => {
    const items: {
      key: string;
      kind: "cover" | "toc" | "chapter";
      chapter?: Chapter;
      blocks: ContentBlock[];
      number: number;
      label: string;
      warnings: FitWarning[];
      first: boolean;
    }[] = [];
    let page = start;
    items.push({ key: "cover", kind: "cover", blocks: [], number: page, label: "Kapak", warnings: [], first: true });
    page += 1;
    if (ordered.length > 0) {
      items.push({ key: "toc", kind: "toc", blocks: [], number: page, label: "İçindekiler", warnings: [], first: true });
      page += 1;
    }
    for (const entry of loaded) {
      const source = entry.chapter.id === selectedChapterId ? liveBlocks : entry.blocks;
      const flow = source.filter((block) => !isFree(block.style));
      const free = source.filter((block) => isFree(block.style));
      const byId = new Map(flow.map((block) => [block.id, block]));
      const fit = fits[entry.chapter.id];
      const fitIds = new Set(fit?.pages.flat() ?? []);
      const ready = Boolean(fit) && flow.length > 0 && flow.every((block) => fitIds.has(block.id)) && fitIds.size === flow.length;
      const idPages = ready && fit ? fit.pages : splitByPageBreak(flow).map((pageBlocks) => pageBlocks.map((block) => block.id));
      idPages.forEach((ids, index) => {
        const pageFlow = ids.flatMap((id) => {
          const block = byId.get(id);
          return block ? [block] : [];
        });
        items.push({
          key: `${entry.chapter.id}-${index}`,
          kind: "chapter",
          chapter: entry.chapter,
          blocks: index === 0 ? [...pageFlow, ...free] : pageFlow,
          number: page,
          label: displayChapterLabel(entry.chapter),
          warnings: index === 0 && ready && fit ? fit.warnings : [],
          first: index === 0,
        });
        page += 1;
      });
    }
    return items;
  }, [fits, loaded, liveBlocks, ordered.length, selectedChapterId, start]);

  useEffect(() => {
    const nodes = sheetRefs.current.filter((node): node is HTMLElement => Boolean(node));
    if (nodes.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = nodes.findIndex((node) => node === visible.target);
        if (index >= 0) setCurrentIndex(index);
      },
      { threshold: [0.35, 0.55, 0.75] },
    );
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [sheets.length, previewMode]);

  const paperClass =
    previewMode === "phone"
      ? "min-h-[640px] px-5 pb-16 pt-8"
      : previewMode === "tablet"
        ? "min-h-[720px] px-8 pb-20 pt-10"
        : "min-h-[920px] max-w-[760px] px-16 pb-24 pt-14";

  const current = sheets[currentIndex];

  const inner = (
    <div ref={previewRef} className="relative flex flex-col items-center gap-8 py-6">
      <div className="sticky top-2 z-20 rounded-full bg-[#0b1220]/90 px-3 py-1 text-[11px] text-white shadow">
        Sayfa {current?.number ?? start} / {sheets.at(-1)?.number ?? start}
        {current?.label ? ` — ${current.label}` : ""}
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {sheets.map((sheet, index) => {
        const body =
          sheet.kind === "cover" ? (
            <CoverPage dark={dark} />
          ) : sheet.kind === "toc" ? (
            <TocPage chapters={ordered} dark={dark} />
          ) : (
            <ChapterPage chapter={sheet.chapter!} blocks={sheet.blocks} first={sheet.first} warnings={sheet.warnings} />
          );
        const footer = (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-8 bottom-7 text-xs tracking-widest opacity-70",
              pageNumberAlignClass(book?.pageNumberAlign),
            )}
          >
            {sheet.number}
          </div>
        );
        const sheetId = sheet.kind === "chapter" && sheet.chapter ? `preview-${sheet.chapter.id}` : sheet.key;
        if (previewMode === "book") {
          return (
            <div key={sheet.key} className="flex w-full flex-col items-center gap-2">
              <PageFitNotice warnings={sheet.warnings} />
              <BookSheet
                id={sheetId}
                dark={dark}
                clip={false}
                quietOverflow
                showGuide
                style={paperStyle}
                footer={footer}
                sheetRef={(node) => {
                  sheetRefs.current[index] = node;
                }}
              >
                {body}
              </BookSheet>
            </div>
          );
        }
        return (
          <article
            key={sheet.key}
            ref={(node) => {
              sheetRefs.current[index] = node;
            }}
            id={sheetId}
            className={cn(
              "book-page relative w-full shadow-[0_18px_50px_rgba(0,0,0,0.35)]",
              dark && "book-page-dark",
              previewMode === "phone" ? "rounded-none" : "rounded-sm",
              paperClass,
            )}
            style={paperStyle}
          >
            {body}
            {footer}
          </article>
        );
      })}
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
  warnings,
}: {
  chapter: Chapter;
  blocks: ContentBlock[];
  first: boolean;
  warnings: FitWarning[];
}) {
  const flow = blocks.filter((block) => !isFree(block.style));
  const free = blocks.filter((block) => isFree(block.style));
  const warningById = new Map(warnings.map((warning) => [warning.id, warning.action]));
  return (
    <div className="relative">
      <div data-chapter-flow={chapter.id}>
      {first ? (
        <h1 data-page-header="" className="mb-6 text-2xl font-semibold">
          {displayChapterLabel(chapter)}
        </h1>
      ) : null}
      <div className="space-y-4" data-flow-stack="">
        {flow.length === 0 && first ? <p className="text-sm opacity-60">Bu bölümde henüz içerik yok.</p> : null}
        {flow.map((block) => (
          <BlockWrapper key={block.id} block={block} editable={false} pageFit={warningById.get(block.id)}>
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
    </div>
  );
}

function splitByPageBreak(blocks: ContentBlock[]): ContentBlock[][] {
  const pages: ContentBlock[][] = [[]];
  for (const block of blocks) {
    pages[pages.length - 1].push(block);
    if (block.type === "pageBreak") pages.push([]);
  }
  while (pages.length > 1 && pages[pages.length - 1].length === 0) pages.pop();
  return pages.length ? pages : [[]];
}
