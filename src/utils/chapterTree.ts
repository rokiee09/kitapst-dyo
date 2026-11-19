import type { Chapter } from "@/types/domain";

export interface ChapterNode extends Chapter {
  children: ChapterNode[];
}

export function buildChapterTree(chapters: Chapter[]): ChapterNode[] {
  const byId = new Map<string, ChapterNode>();
  for (const chapter of chapters) {
    byId.set(chapter.id, { ...chapter, children: [] });
  }

  const roots: ChapterNode[] = [];
  const sorted = [...chapters].sort((a, b) => a.order - b.order);
  for (const chapter of sorted) {
    const node = byId.get(chapter.id);
    if (!node) continue;
    if (chapter.parentId && byId.has(chapter.parentId)) {
      byId.get(chapter.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }
  for (const node of byId.values()) {
    node.children.sort((a, b) => a.order - b.order);
  }
  return roots.sort((a, b) => a.order - b.order);
}

export function flattenChapterTree(nodes: ChapterNode[]): ChapterNode[] {
  const out: ChapterNode[] = [];
  function walk(node: ChapterNode) {
    out.push(node);
    for (const child of node.children) walk(child);
  }
  for (const node of nodes) walk(node);
  return out;
}

export function displayChapterLabel(chapter: Pick<Chapter, "number" | "title">): string {
  const title = chapter.title.trim();
  if (!chapter.number) return chapter.title;
  if (isAutoPageTitle(title)) return `Sayfa ${chapter.number}`;
  if (title === chapter.number || title.startsWith(`${chapter.number} `)) return title;
  return `${chapter.number}  ${chapter.title}`;
}

export function isAutoPageTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed.startsWith("Sayfa ")) return false;
  const rest = trimmed.slice("Sayfa ".length);
  return rest.length > 0 && /^[\d.]+$/.test(rest);
}

export function isFrontMatterTitle(title: string): boolean {
  return title === "Kapak" || title === "Önsöz" || title === "Giriş" || title === "İçindekiler";
}

export function pageSheetFamily(chapters: Chapter[], currentId: string | null) {
  const current = chapters.find((item) => item.id === currentId);
  if (!current) return null;
  const parent =
    current.parentId != null
      ? (chapters.find((item) => item.id === current.parentId) ?? current)
      : current;
  const children = chapters
    .filter((item) => item.parentId === parent.id)
    .sort((a, b) => a.order - b.order);
  const sheets = [parent, ...children];
  const nextIndex = children.length + 1;
  const nextLabel = parent.number?.trim() ? `${parent.number}.${nextIndex}` : String(nextIndex);
  return { parent, sheets, current, nextLabel };
}

export function collectDescendantIds(nodes: ChapterNode[], id: string): string[] {
  const target = findNode(nodes, id);
  if (!target) return [];
  const ids: string[] = [];
  walk(target, (node) => ids.push(node.id));
  return ids;
}

function findNode(nodes: ChapterNode[], id: string): ChapterNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findNode(node.children, id);
    if (nested) return nested;
  }
  return null;
}

function walk(node: ChapterNode, visit: (node: ChapterNode) => void): void {
  visit(node);
  for (const child of node.children) {
    walk(child, visit);
  }
}
