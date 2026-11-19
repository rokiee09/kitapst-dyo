import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GripVertical,
  Search,
  Trash2,
} from "lucide-react";
import { tr } from "@/i18n/tr";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useEditorStore } from "@/stores/editorStore";
import { useUiStore } from "@/stores/uiStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import {
  buildChapterTree,
  displayChapterLabel,
  isFrontMatterTitle,
  type ChapterNode,
} from "@/utils/chapterTree";
import { mergeBookExtras } from "@/book/textStyles";
import { PageSheetNav } from "@/features/chapters/PageSheetNav";

export function ChapterTree() {
  const chapters = useWorkspaceStore((state) => state.chapters);
  const book = useWorkspaceStore((state) => state.book);
  const selectedChapterId = useWorkspaceStore((state) => state.selectedChapterId);
  const [query, setQuery] = useState("");
  const tree = useMemo(() => filterChapterTree(buildChapterTree(chapters), query), [chapters, query]);
  const frontMatterLocked = useMemo(
    () => mergeBookExtras(JSON.parse(book?.bookExtrasJson || "{}")).frontMatterLocked,
    [book?.bookExtrasJson],
  );

  return (
    <div className="flex h-full flex-col bg-[#0c1829]">
      <div className="flex items-center gap-2 px-3 py-2">
        <h2 className="flex-1 text-xs font-semibold tracking-wide text-[#8aa0b8]">{tr.chapter.title}</h2>
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-2.5 text-[#8aa0b8]" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ara"
            className="h-8 pl-8"
          />
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-[#6f849e]">
          Tutamacı sürükleyin veya numarayı yazıp Enter’a basın; sıra ve sayılar güncellenir.
        </p>
        {frontMatterLocked ? (
          <p className="mt-1 text-[10px] leading-snug text-amber-400/90">
            Ön bölümler kilitli; Kapak, Önsöz, İçindekiler ve Giriş sırası değiştirilemez.
          </p>
        ) : null}
      </div>
      <div className="app-scroll flex-1 overflow-auto px-1 pb-3">
        {tree.length === 0 ? (
          <p className="px-3 text-xs text-[#8aa0b8]">{tr.chapter.empty}</p>
        ) : (
          <ChapterSiblingList
            nodes={tree}
            parentId={null}
            depth={0}
            selectedId={selectedChapterId}
            allowDrag={!query.trim()}
            frontMatterLocked={frontMatterLocked}
          />
        )}
      </div>
      <PageSheetNav />
    </div>
  );
}

function filterChapterTree(nodes: ChapterNode[], query: string): ChapterNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return nodes;
  function walk(node: ChapterNode): ChapterNode | null {
    const children = node.children.map(walk).filter((item): item is ChapterNode => item !== null);
    const self = displayChapterLabel(node).toLowerCase().includes(needle);
    if (self || children.length > 0) return { ...node, children };
    return null;
  }
  return nodes.map(walk).filter((item): item is ChapterNode => item !== null);
}

function ChapterSiblingList({
  nodes,
  parentId,
  depth,
  selectedId,
  allowDrag,
  frontMatterLocked,
}: {
  nodes: ChapterNode[];
  parentId: string | null;
  depth: number;
  selectedId: string | null;
  allowDrag: boolean;
  frontMatterLocked: boolean;
}) {
  const reorderChapters = useWorkspaceStore((state) => state.reorderChapters);
  const [dragId, setDragId] = useState<string | null>(null);
  const frontCount =
    parentId === null && frontMatterLocked
      ? nodes.filter((node) => isFrontMatterTitle(node.title)).length
      : 0;

  return (
    <>
      {nodes.map((node, index) => (
        <ChapterTreeItem
          key={node.id}
          node={node}
          depth={depth}
          selectedId={selectedId}
          allowDrag={allowDrag}
          frontMatterLocked={parentId === null && frontMatterLocked}
          canMoveUp={
            index > 0 &&
            !(
              parentId === null &&
              frontMatterLocked &&
              (isFrontMatterTitle(node.title) || isFrontMatterTitle(nodes[index - 1]!.title))
            )
          }
          canMoveDown={
            index < nodes.length - 1 &&
            !(
              parentId === null &&
              frontMatterLocked &&
              (isFrontMatterTitle(node.title) || isFrontMatterTitle(nodes[index + 1]!.title))
            )
          }
          dragging={dragId === node.id}
          onDragStart={() => setDragId(node.id)}
          onDragEnd={() => setDragId(null)}
          onDrop={() => {
            if (!dragId || dragId === node.id) return;
            const dragNode = nodes.find((item) => item.id === dragId);
            if (parentId === null && frontMatterLocked) {
              if (!dragNode || isFrontMatterTitle(dragNode.title) || isFrontMatterTitle(node.title)) {
                setDragId(null);
                return;
              }
            }
            const ids = nodes.map((item) => item.id);
            const from = ids.indexOf(dragId);
            const to = ids.indexOf(node.id);
            if (from < 0 || to < 0) return;
            ids.splice(from, 1);
            ids.splice(to, 0, dragId);
            if (parentId === null && frontMatterLocked) {
              const nextFrom = ids.indexOf(dragId);
              if (nextFrom < frontCount) {
                setDragId(null);
                return;
              }
            }
            void reorderChapters(parentId, ids);
            setDragId(null);
          }}
        />
      ))}
    </>
  );
}

function ChapterTreeItem({
  node,
  depth,
  selectedId,
  allowDrag,
  frontMatterLocked,
  canMoveUp,
  canMoveDown,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  node: ChapterNode;
  depth: number;
  selectedId: string | null;
  allowDrag: boolean;
  frontMatterLocked: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}) {
  const collapsed = useUiStore((state) => state.collapsedChapterIds.includes(node.id));
  const toggleCollapsed = useUiStore((state) => state.toggleChapterCollapsed);
  const selectedChapterId = useWorkspaceStore((state) => state.selectedChapterId);
  const createChapter = useWorkspaceStore((state) => state.createChapter);
  const renameChapter = useWorkspaceStore((state) => state.renameChapter);
  const deleteChapter = useWorkspaceStore((state) => state.deleteChapter);
  const duplicateChapter = useWorkspaceStore((state) => state.duplicateChapter);
  const moveChapter = useWorkspaceStore((state) => state.moveChapter);
  const setChapterNumber = useWorkspaceStore((state) => state.setChapterNumber);
  const selectChapter = useWorkspaceStore((state) => state.selectChapter);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(node.title);
  const [numberDraft, setNumberDraft] = useState(node.number ?? "");
  const [editingNumber, setEditingNumber] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const selected = selectedId === node.id;
  const frontMatter = isFrontMatterTitle(node.title);

  useEffect(() => {
    if (!renaming) setDraft(node.title);
  }, [node.title, renaming]);

  useEffect(() => {
    if (!editingNumber) setNumberDraft(node.number ?? "");
  }, [node.number, editingNumber]);

  async function activate(id: string) {
    const blocks = await selectChapter(id);
    useEditorStore.getState().setBlocks(blocks);
  }

  async function commitNumber() {
    setEditingNumber(false);
    const next = numberDraft.trim();
    if (!next || next === (node.number ?? "")) {
      setNumberDraft(node.number ?? "");
      return;
    }
    await setChapterNumber(node.id, next);
  }

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            onDragOver={(event) => {
              if (!allowDrag) return;
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              onDrop();
            }}
            className={cn(
              "group flex items-center gap-1 rounded-md py-1.5 pr-1 text-[13px] hover:bg-[#152844]",
              selected && "bg-blue-600 text-white",
              dragging && "opacity-40",
            )}
            style={{ paddingLeft: 8 + depth * 14 }}
          >
            {allowDrag && !(frontMatterLocked && frontMatter) ? (
              <span
                draggable={!renaming && !editingNumber}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  onDragStart();
                }}
                onDragEnd={onDragEnd}
                className="cursor-grab text-[#8aa0bd] active:cursor-grabbing"
                title="Sürükleyerek sırala"
              >
                <GripVertical size={12} />
              </span>
            ) : null}
            {node.children.length > 0 ? (
              <button
                type="button"
                className="flex h-4 w-4 items-center justify-center text-[#8aa0bd]"
                onClick={() => toggleCollapsed(node.id)}
                aria-label={collapsed ? "Genişlet" : "Daralt"}
              >
                {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </button>
            ) : (
              <span className="inline-block w-4" />
            )}
            {!frontMatter ? (
              editingNumber ? (
                <input
                  className={cn(
                    "h-6 w-14 shrink-0 rounded border border-blue-500 bg-[#070b14] px-1 text-center text-[12px] outline-none",
                    selected && "border-white/70",
                  )}
                  value={numberDraft}
                  autoFocus
                  title="Sayfa numarası"
                  onChange={(event) => setNumberDraft(event.target.value)}
                  onBlur={() => void commitNumber()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      (event.target as HTMLInputElement).blur();
                    }
                    if (event.key === "Escape") {
                      setNumberDraft(node.number ?? "");
                      setEditingNumber(false);
                    }
                  }}
                  onClick={(event) => event.stopPropagation()}
                />
              ) : (
                <button
                  type="button"
                  className={cn(
                    "h-6 min-w-10 shrink-0 rounded px-1 text-center text-[12px] font-semibold tabular-nums",
                    selected ? "bg-white/15 text-white" : "bg-[#102038] text-[#9ec0ea] hover:bg-[#163056]",
                  )}
                  title="Numarayı değiştir"
                  onClick={(event) => {
                    event.stopPropagation();
                    setNumberDraft(node.number ?? "");
                    setEditingNumber(true);
                  }}
                >
                  {node.number || "—"}
                </button>
              )
            ) : null}
            {renaming ? (
              <input
                className="h-6 flex-1 rounded border border-blue-500 bg-[#070b14] px-1 text-[13px] outline-none"
                value={draft}
                autoFocus
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => {
                  setRenaming(false);
                  if (draft.trim() && draft !== node.title) {
                    void renameChapter(node.id, draft);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    (event.target as HTMLInputElement).blur();
                  }
                  if (event.key === "Escape") {
                    setDraft(node.title);
                    setRenaming(false);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => void activate(node.id)}
                onDoubleClick={() => {
                  setDraft(node.title);
                  setRenaming(true);
                }}
              >
                {frontMatter || !node.number
                  ? node.title
                  : node.title.trim().startsWith("Sayfa ")
                    ? `Sayfa ${node.number}`
                    : node.title}
              </button>
            )}
            <div
              className={cn(
                "ml-auto hidden shrink-0 items-center gap-0.5 group-hover:flex",
                selected && "flex",
              )}
            >
              <button
                type="button"
                className={cn(
                  "flex h-6 w-5 items-center justify-center rounded text-[#8aa0bd] hover:bg-[#1c314c] hover:text-white disabled:opacity-30",
                  selected && "text-white/80 hover:bg-white/15",
                )}
                title={tr.chapter.moveUp}
                disabled={!canMoveUp}
                onClick={(event) => {
                  event.stopPropagation();
                  void moveChapter(node.id, "up");
                }}
              >
                <ChevronUp size={12} />
              </button>
              <button
                type="button"
                className={cn(
                  "flex h-6 w-5 items-center justify-center rounded text-[#8aa0bd] hover:bg-[#1c314c] hover:text-white disabled:opacity-30",
                  selected && "text-white/80 hover:bg-white/15",
                )}
                title={tr.chapter.moveDown}
                disabled={!canMoveDown}
                onClick={(event) => {
                  event.stopPropagation();
                  void moveChapter(node.id, "down");
                }}
              >
                <ChevronDown size={12} />
              </button>
              {renaming ? null : (
                <button
                  type="button"
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded text-[#8aa0bd] hover:bg-red-600 hover:text-white",
                    selected && "text-white/80",
                  )}
                  title={tr.chapter.remove}
                  aria-label={tr.chapter.remove}
                  onClick={(event) => {
                    event.stopPropagation();
                    setConfirming(true);
                  }}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onSelect={() => {
              void (async () => {
                const chapter = await createChapter(node.id);
                if (chapter) await activate(chapter.id);
              })();
            }}
          >
            {tr.chapter.newChild}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              setDraft(node.title);
              setRenaming(true);
            }}
          >
            {tr.chapter.rename}
          </ContextMenuItem>
          {!frontMatter ? (
            <ContextMenuItem
              onSelect={() => {
                setNumberDraft(node.number ?? "");
                setEditingNumber(true);
              }}
            >
              Numarayı değiştir
            </ContextMenuItem>
          ) : null}
          <ContextMenuItem onSelect={() => void duplicateChapter(node.id)}>{tr.chapter.duplicate}</ContextMenuItem>
          <ContextMenuItem onSelect={() => void moveChapter(node.id, "up")}>{tr.chapter.moveUp}</ContextMenuItem>
          <ContextMenuItem onSelect={() => void moveChapter(node.id, "down")}>{tr.chapter.moveDown}</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => setConfirming(true)}>{tr.chapter.remove}</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {confirming ? (
        <div className="mx-2 mb-1 rounded border border-[#1c2a44] bg-[#070b14] p-2 text-xs">
          <p className="mb-2">{tr.chapter.confirmDelete}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                setConfirming(false);
                void (async () => {
                  await deleteChapter(node.id);
                  const nextId = useWorkspaceStore.getState().selectedChapterId;
                  if (nextId) await activate(nextId);
                })();
              }}
            >
              {tr.chapter.confirmYes}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
              {tr.chapter.confirmNo}
            </Button>
          </div>
        </div>
      ) : null}
      {!collapsed && node.children.length > 0 ? (
        <ChapterSiblingList
          nodes={node.children}
          parentId={node.id}
          depth={depth + 1}
          selectedId={selectedChapterId}
          allowDrag={allowDrag}
          frontMatterLocked={false}
        />
      ) : null}
    </div>
  );
}
