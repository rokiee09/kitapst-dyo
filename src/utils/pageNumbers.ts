import type { Chapter } from "@/types/domain";
import { toRoman } from "@/book/textStyles";
import { isFrontMatterTitle } from "@/utils/chapterTree";

export type PageNumberAlign = "left" | "center" | "right";

export interface ChapterPageNumber {
  n: number;
  roman: boolean;
}

function sortedRoots(chapters: Chapter[]): Chapter[] {
  return chapters.filter((chapter) => !chapter.parentId).sort((a, b) => a.order - b.order);
}

function rootOf(chapters: Chapter[], chapterId: string): Chapter | null {
  let current = chapters.find((chapter) => chapter.id === chapterId);
  if (!current) return null;
  while (current.parentId) {
    const parent = chapters.find((chapter) => chapter.id === current!.parentId);
    if (!parent) break;
    current = parent;
  }
  return current;
}

export function chapterPageNumber(
  chapters: Chapter[],
  chapterId: string | null,
  start = 1,
): ChapterPageNumber {
  if (!chapterId) return { n: Math.max(0, start), roman: false };
  const root = rootOf(chapters, chapterId);
  if (!root) return { n: Math.max(0, start), roman: false };
  const roots = sortedRoots(chapters);
  if (isFrontMatterTitle(root.title)) {
    const front = roots.filter((chapter) => isFrontMatterTitle(chapter.title));
    const index = front.findIndex((chapter) => chapter.id === root.id);
    return { n: index >= 0 ? index + 1 : 1, roman: true };
  }
  const body = roots.filter((chapter) => !isFrontMatterTitle(chapter.title));
  const index = body.findIndex((chapter) => chapter.id === root.id);
  if (index < 0) return { n: start, roman: false };
  return { n: start + index, roman: false };
}

export function formatPageNumber(n: number, roman: boolean): string {
  if (roman) return toRoman(n);
  return String(n);
}

export function pageNumberAlignClass(align?: string): string {
  if (align === "left") return "text-left";
  if (align === "right") return "text-right";
  return "text-center";
}