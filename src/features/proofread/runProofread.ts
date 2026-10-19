import { readBlockContent, jsonContentToPlainText, jsonHasType } from "@/utils/tiptap";
import { aiProofread } from "@/features/proofread/aiProofread";
import { localProofread, type ProofreadRole } from "@/features/proofread/localProofread";
import { effectiveHeadingSize } from "@/features/blocks/blockStyle";
import { hasProofreadAi } from "@/features/proofread/settings";
import type { ProofIssue } from "@/features/proofread/types";
import { blockService } from "@/services";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { buildChapterTree, displayChapterLabel, flattenChapterTree } from "@/utils/chapterTree";
import type { Chapter, ContentBlock } from "@/types/domain";

export async function proofreadPages(chapterIds: string[]): Promise<{
  issues: ProofIssue[];
  usedAi: boolean;
  aiError: string | null;
}> {
  const unique = [...new Set(chapterIds.filter(Boolean))];
  if (unique.length === 0) {
    return { issues: [], usedAi: false, aiError: null };
  }
  await useEditorStore.getState().flushSave();
  const pages = await loadPages(unique);
  const issues: ProofIssue[] = [];
  const combined: string[] = [];

  for (const page of pages) {
    for (const block of page.blocks) {
      const text = jsonContentToPlainText(readBlockContent(block.data)).trim();
      if (!text) continue;
      issues.push(...tagIssues(localProofread(text, blockRole(block)), page, block.id));
    }
    const chapterText = blocksToText(page.blocks);
    if (chapterText) {
      combined.push(`## ${displayChapterLabel(page.chapter)}\n${chapterText}`);
    }
  }

  let usedAi = false;
  let aiError: string | null = null;
  if (!hasProofreadAi()) {
    aiError = null;
  } else if (combined.length === 0) {
    aiError = "Taranacak metin yok. Önce sayfaya yazı ekleyin.";
  } else {
    try {
      const extra = await aiProofread(combined.join("\n\n"));
      usedAi = true;
      if (extra.length === 0) {
        aiError = "Yapay zeka yanıt verdi ama öneri çıkmadı. Model adını gpt-4o-mini yapıp tekrar deneyin.";
      } else {
        issues.push(
          ...extra.map((issue) => {
            const located = findAcrossPages(pages, issue.excerpt);
            return {
              ...issue,
              chapterId: located?.chapterId,
              pageTitle: located?.pageTitle,
              blockId: located?.blockId,
            };
          }),
        );
      }
    } catch (error) {
      aiError = error instanceof Error ? error.message : "Yapay zeka taraması yapılamadı.";
    }
  }

  return { issues: mergeIssues(issues).slice(0, 80), usedAi, aiError };
}

export function orderedChapterIds(): string[] {
  const chapters = useWorkspaceStore.getState().chapters;
  return flattenChapterTree(buildChapterTree(chapters)).map((item) => item.id);
}

async function loadPages(chapterIds: string[]): Promise<{ chapter: Chapter; blocks: ContentBlock[] }[]> {
  const store = useWorkspaceStore.getState();
  const selectedId = store.selectedChapterId;
  const liveBlocks = useEditorStore.getState().blocks;
  const pages: { chapter: Chapter; blocks: ContentBlock[] }[] = [];
  for (const id of chapterIds) {
    const chapter = store.chapters.find((item) => item.id === id);
    if (!chapter) continue;
    const blocks = id === selectedId ? liveBlocks : await blockService.list(id);
    pages.push({ chapter, blocks });
  }
  return pages;
}

function blocksToText(blocks: ContentBlock[]): string {
  return blocks
    .map((block) => {
      const text = jsonContentToPlainText(readBlockContent(block.data)).trim();
      if (!text) return "";
      const role = blockRole(block);
      const tag = role === "heading" ? "BAŞLIK" : role === "list" ? "MADDE LİSTESİ" : "METİN";
      return `[${tag}]\n${text}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function blockRole(block: ContentBlock): ProofreadRole {
  const content = readBlockContent(block.data);
  const hasList =
    jsonHasType(content, ["bulletList", "orderedList"]) || Boolean(block.style.listMarker?.trim());
  const hasHeading =
    block.type === "heading" ||
    jsonHasType(content, ["heading"]) ||
    Boolean(effectiveHeadingSize(block.style, block.data));
  if (hasHeading && block.type === "heading") return "heading";
  if (hasList) return "list";
  if (hasHeading) return "heading";
  return "text";
}

function tagIssues(
  issues: ProofIssue[],
  page: { chapter: Chapter },
  blockId: string,
): ProofIssue[] {
  const pageTitle = displayChapterLabel(page.chapter);
  return issues.map((issue) => ({
    ...issue,
    chapterId: page.chapter.id,
    pageTitle,
    blockId,
  }));
}

function findAcrossPages(
  pages: { chapter: Chapter; blocks: ContentBlock[] }[],
  excerpt: string,
): { chapterId: string; pageTitle: string; blockId?: string } | undefined {
  const needle = excerpt.replace(/…$/u, "").trim();
  for (const page of pages) {
    const blockId = needle
      ? page.blocks.find((block) =>
          jsonContentToPlainText(readBlockContent(block.data)).includes(needle),
        )?.id
      : page.blocks[0]?.id;
    if (blockId || (!needle && page.blocks[0])) {
      return {
        chapterId: page.chapter.id,
        pageTitle: displayChapterLabel(page.chapter),
        blockId: blockId ?? page.blocks[0]?.id,
      };
    }
  }
  const first = pages[0];
  if (!first) return undefined;
  return {
    chapterId: first.chapter.id,
    pageTitle: displayChapterLabel(first.chapter),
    blockId: first.blocks[0]?.id,
  };
}

function mergeIssues(issues: ProofIssue[]): ProofIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
  const key = `${issue.chapterId}:${issue.blockId}:${issue.kind}:${issue.excerpt}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
