import type { Chapter } from "@/types/domain";

export type PageNumberAlign = "left" | "center" | "right";

export function chapterPageNumber(
  chapters: Chapter[],
  chapterId: string | null,
  start = 1,
): number {
  const index = chapters.findIndex((chapter) => chapter.id === chapterId);
  if (index < 0) return Math.max(0, start);
  return start + index;
}

export function pageNumberAlignClass(align?: string): string {
  if (align === "left") return "text-left";
  if (align === "right") return "text-right";
  return "text-center";
}
