import type {
  Asset,
  Book,
  BookStats,
  BookVersion,
  Chapter,
  ChapterTemplate,
  ContentBlock,
  LibraryBook,
  Note,
  Project,
  ProjectSettings,
  StylePreset,
  WorkspaceSnapshot,
} from "@/types/domain";
import { getPreviewFile } from "@/services/browser/previewFiles";
import { allowedBlockType, builtinTemplates, defaultBlockData } from "@/services/browser/previewTemplates";

const STORAGE_KEY = "kitap-studiosu-browser-preview-v1";
const DEMO_PATH = "Tarayıcı/Kitaplar/TAKTİK EĞİTİM";

interface VersionRecord extends BookVersion {
  snapshot: { chapters: Chapter[]; blocks: ContentBlock[] } | null;
}

interface StoredBook {
  project: Project;
  book: Book;
  chapters: Chapter[];
  blocks: ContentBlock[];
  settings: ProjectSettings;
  versions: VersionRecord[];
  notes: Note[];
  templates: ChapterTemplate[];
  presets: StylePreset[];
  assets: Asset[];
}

interface LibraryState {
  currentPath: string;
  books: Record<string, StoredBook>;
}

const assetData = new Map<string, string>();

const library = loadLibrary();
persist();

export async function previewInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const result = await dispatch(command, args ?? {});
  return result as T;
}

async function dispatch(command: string, args: Record<string, unknown>): Promise<unknown> {
  switch (command) {
    case "get_workspace":
      return snapshot(current());
    case "update_book":
      return updateBook(payload(args));
    case "create_chapter":
      return createChapter(payload(args));
    case "rename_chapter":
      return renameChapter(str(args.id), str(args.title));
    case "delete_chapter":
      deleteChapter(str(args.id));
      return undefined;
    case "duplicate_chapter":
      return duplicateChapter(str(args.id));
    case "move_chapter":
      return moveChapter(str(args.id), str(args.direction));
    case "reorder_chapters":
      return reorderChapters(payload(args));
    case "set_active_chapter":
      return setActiveChapter(str(args.chapterId));
    case "list_blocks":
      return blocksOf(current(), str(args.chapterId));
    case "create_block":
      return createBlock(payload(args));
    case "update_block":
      return updateBlock(payload(args));
    case "delete_block":
      deleteBlock(str(args.id));
      return undefined;
    case "duplicate_block":
      return duplicateBlock(str(args.id));
    case "reorder_blocks":
      return reorderBlocks(payload(args));
    case "get_stats":
      return statsFor(current(), str(args.bookId));
    case "create_book_version":
      return createVersion(payload(args));
    case "list_book_versions":
      return current().versions.map(publicVersion);
    case "restore_book_version":
      restoreVersion(str(args.versionId));
      return undefined;
    case "create_backup":
      return downloadBackup();
    case "restore_backup":
      throw new Error("Tarayıcı önizlemesinde ZIP yedek geri yüklenmez. Kitap bu sekmede durur.");
    case "list_library_books":
      return listLibrary();
    case "create_library_book":
      return createLibraryBook(str(args.title));
    case "open_library_book":
      return openLibraryBook(str(args.path));
    case "list_notes":
      return [...current().notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case "upsert_note":
      return upsertNote(payload(args));
    case "delete_note":
      current().notes = current().notes.filter((note) => note.id !== str(args.id));
      persist();
      return undefined;
    case "list_templates":
      return [...builtinTemplates(), ...current().templates];
    case "save_template":
      return saveTemplate(payload(args));
    case "apply_template":
      return applyTemplate(payload(args));
    case "delete_template":
      deleteTemplate(str(args.id));
      return undefined;
    case "list_style_presets":
      return listPresets(args.blockType);
    case "save_style_preset":
      return savePreset(payload(args));
    case "delete_style_preset":
      current().presets = current().presets.filter((item) => item.id !== str(args.id));
      persist();
      return undefined;
    case "list_assets":
      return listAssets(args.assetType);
    case "import_asset":
      return importAsset(payload(args));
    case "import_asset_bytes":
      return importAssetBytes(payload(args));
    case "read_asset_data_url":
      return readAssetDataUrl(str(args.relativePath));
    case "resolve_asset_path":
      return readAssetDataUrl(str(args.relativePath));
    case "delete_asset":
      deleteAsset(str(args.id));
      return undefined;
    case "open_asset":
      openAsset(str(args.relativePath));
      return undefined;
    case "read_import_bytes":
      return readImportBytes(str(args.path));
    case "export_book":
      return exportBook(payload(args));
    case "open_folder":
      return `Tarayıcı/${str(args.which)}`;
    case "load_proofread_settings":
      return { endpoint: "", apiKey: "", model: "gpt-4o-mini" };
    case "save_proofread_settings":
      return undefined;
    case "proofread_ai":
      throw new Error("Yapay zeka denetimi tarayıcı önizlemesinde kapalı. Yerel denetim çalışır.");
    default:
      throw new Error(`Bu işlem tarayıcı önizlemesinde yok: ${command}`);
  }
}

function current(): StoredBook {
  const book = library.books[library.currentPath];
  if (!book) throw new Error("Açık kitap bulunamadı.");
  return book;
}

function snapshot(book: StoredBook): WorkspaceSnapshot {
  const selectedChapterId =
    book.settings.lastOpenedChapterId && book.chapters.some((chapter) => chapter.id === book.settings.lastOpenedChapterId)
      ? book.settings.lastOpenedChapterId
      : (book.chapters[0]?.id ?? null);
  return {
    project: book.project,
    book: book.book,
    chapters: [...book.chapters].sort(compareChapters),
    settings: { ...book.settings, lastOpenedChapterId: selectedChapterId },
    versions: book.versions.map(publicVersion),
    selectedChapterId,
    selectedBlocks: selectedChapterId ? blocksOf(book, selectedChapterId) : [],
    stats: statsFor(book, book.book.id),
    isDemo: library.currentPath === DEMO_PATH,
  };
}

function updateBook(raw: Record<string, unknown>): Book {
  const book = current().book;
  const title = str(raw.title).trim();
  if (!title) throw new Error("Kitap adı boş olamaz.");
  book.title = title;
  book.subtitle = emptyToNull(raw.subtitle);
  book.author = emptyToNull(raw.author);
  book.description = emptyToNull(raw.description);
  book.language = str(raw.language).trim() || book.language;
  book.isbn = emptyToNull(raw.isbn);
  book.publisher = emptyToNull(raw.publisher);
  book.coverAssetId = emptyToNull(raw.coverAssetId);
  book.pageColor = nonempty(raw.pageColor) ?? book.pageColor;
  book.inkColor = nonempty(raw.inkColor) ?? book.inkColor;
  book.fontFamily = nonempty(raw.fontFamily) ?? book.fontFamily;
  if (typeof raw.pageNumbers === "boolean") book.pageNumbers = raw.pageNumbers;
  const align = nonempty(raw.pageNumberAlign);
  if (align === "left" || align === "center" || align === "right") book.pageNumberAlign = align;
  if (typeof raw.pageNumberStart === "number") book.pageNumberStart = clamp(Math.round(raw.pageNumberStart), 0, 9999);
  if (typeof raw.lineHeight === "number") book.lineHeight = clamp(raw.lineHeight, 1, 3);
  book.updatedAt = now();
  current().project.name = title;
  current().project.updatedAt = book.updatedAt;
  persist();
  return book;
}

function createChapter(raw: Record<string, unknown>): Chapter {
  const book = current();
  const title = str(raw.title).trim();
  if (!title) throw new Error("Bölüm başlığı boş olamaz.");
  const parentId = emptyToNull(raw.parentId);
  if (parentId && !book.chapters.some((chapter) => chapter.id === parentId && chapter.bookId === book.book.id)) {
    throw new Error("Üst bölüm bu kitaba ait değil.");
  }
  const siblings = book.chapters.filter((chapter) => chapter.parentId === parentId);
  const order = siblings.reduce((max, chapter) => Math.max(max, chapter.order), -1) + 1;
  const ts = now();
  const chapter: Chapter = {
    id: crypto.randomUUID(),
    bookId: book.book.id,
    parentId,
    title,
    number: chapterNumber(book, parentId, order),
    order,
    createdAt: ts,
    updatedAt: ts,
  };
  book.chapters.push(chapter);
  const templateId = nonempty(raw.templateId);
  if (templateId) insertTemplateSpecs(book, chapter.id, templateSpecs(book, templateId));
  book.settings.lastOpenedChapterId = chapter.id;
  persist();
  return chapter;
}

function renameChapter(id: string, title: string): Chapter {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Bölüm başlığı boş olamaz.");
  const chapter = requireChapter(id);
  chapter.title = trimmed;
  chapter.updatedAt = now();
  persist();
  return chapter;
}

function deleteChapter(id: string) {
  const book = current();
  requireChapter(id);
  if (book.chapters.length <= 1) throw new Error("Kitapta en az bir bölüm bulunmalıdır.");
  const drop = new Set(descendantIds(book, id));
  book.chapters = book.chapters.filter((chapter) => !drop.has(chapter.id));
  book.blocks = book.blocks.filter((block) => !drop.has(block.chapterId));
  if (book.settings.lastOpenedChapterId && drop.has(book.settings.lastOpenedChapterId)) {
    book.settings.lastOpenedChapterId = book.chapters[0]?.id ?? null;
  }
  persist();
}

function duplicateChapter(id: string): Chapter {
  const book = current();
  const source = requireChapter(id);
  const siblings = book.chapters.filter((chapter) => chapter.parentId === source.parentId);
  const order = siblings.reduce((max, chapter) => Math.max(max, chapter.order), -1) + 1;
  const ts = now();
  const copy: Chapter = {
    id: crypto.randomUUID(),
    bookId: source.bookId,
    parentId: source.parentId,
    title: `${source.title} (kopya)`,
    number: chapterNumber(book, source.parentId, order),
    order,
    createdAt: ts,
    updatedAt: ts,
  };
  book.chapters.push(copy);
  for (const block of blocksOf(book, source.id)) {
    book.blocks.push({ ...structuredClone(block), id: crypto.randomUUID(), chapterId: copy.id, createdAt: ts, updatedAt: ts });
  }
  persist();
  return copy;
}

function moveChapter(id: string, direction: string): Chapter[] {
  const book = current();
  const chapter = requireChapter(id);
  const siblings = book.chapters
    .filter((item) => item.parentId === chapter.parentId)
    .sort((a, b) => a.order - b.order);
  const index = siblings.findIndex((item) => item.id === id);
  const target = direction === "up" ? index - 1 : direction === "down" ? index + 1 : -2;
  if (target === -2) throw new Error("Geçersiz taşıma yönü.");
  const other = siblings[target];
  if (other && index >= 0) {
    const currentOrder = chapter.order;
    chapter.order = other.order;
    other.order = currentOrder;
    const ts = now();
    chapter.updatedAt = ts;
    other.updatedAt = ts;
  }
  persist();
  return [...book.chapters].sort(compareChapters);
}

function reorderChapters(raw: Record<string, unknown>): Chapter[] {
  const book = current();
  const parentId = emptyToNull(raw.parentId);
  const orderedIds = stringList(raw.orderedIds);
  const siblings = book.chapters.filter((chapter) => chapter.parentId === parentId);
  const existing = new Set(siblings.map((chapter) => chapter.id));
  if (existing.size !== orderedIds.length || orderedIds.some((id) => !existing.has(id))) {
    throw new Error("Bölüm sırası geçersiz.");
  }
  const ts = now();
  orderedIds.forEach((id, index) => {
    const chapter = siblings.find((item) => item.id === id);
    if (!chapter) return;
    chapter.order = index;
    chapter.updatedAt = ts;
  });
  persist();
  return [...book.chapters].sort(compareChapters);
}

function setActiveChapter(chapterId: string): ContentBlock[] {
  const book = current();
  requireChapter(chapterId);
  book.settings.lastOpenedChapterId = chapterId;
  book.settings.updatedAt = now();
  persist();
  return blocksOf(book, chapterId);
}

function createBlock(raw: Record<string, unknown>): ContentBlock {
  const book = current();
  const chapterId = str(raw.chapterId);
  const type = str(raw.type);
  if (!allowedBlockType(type)) throw new Error("Desteklenmeyen blok türü.");
  requireChapter(chapterId);
  const afterId = emptyToNull(raw.afterBlockId);
  let order = blocksOf(book, chapterId).reduce((max, block) => Math.max(max, block.order), -1) + 1;
  if (afterId) {
    const after = book.blocks.find((block) => block.id === afterId);
    if (!after) throw new Error("Blok bulunamadı.");
    order = after.order + 1;
    for (const block of book.blocks) {
      if (block.chapterId === chapterId && block.order >= order) block.order += 1;
    }
  }
  const ts = now();
  const block: ContentBlock = {
    id: crypto.randomUUID(),
    chapterId,
    type: type as ContentBlock["type"],
    order,
    data: raw.data ?? defaultBlockData(type),
    style: (raw.style as ContentBlock["style"]) ?? {},
    createdAt: ts,
    updatedAt: ts,
  };
  book.blocks.push(block);
  persist();
  return block;
}

function updateBlock(raw: Record<string, unknown>): ContentBlock {
  const block = requireBlock(str(raw.id));
  const nextType = nonempty(raw.type);
  if (nextType) {
    if (!allowedBlockType(nextType)) throw new Error("Desteklenmeyen blok türü.");
    block.type = nextType as ContentBlock["type"];
  }
  block.data = raw.data;
  block.style = (raw.style as ContentBlock["style"]) ?? {};
  block.updatedAt = now();
  persist();
  return block;
}

function deleteBlock(id: string) {
  const book = current();
  const block = requireBlock(id);
  const remaining = book.blocks.filter((item) => item.chapterId === block.chapterId).length;
  if (remaining <= 1) throw new Error("Bölümde en az bir blok bulunmalıdır.");
  book.blocks = book.blocks.filter((item) => item.id !== id);
  persist();
}

function duplicateBlock(id: string): ContentBlock {
  const book = current();
  const source = requireBlock(id);
  const ts = now();
  for (const block of book.blocks) {
    if (block.chapterId === source.chapterId && block.order > source.order) block.order += 1;
  }
  const copy: ContentBlock = {
    ...structuredClone(source),
    id: crypto.randomUUID(),
    order: source.order + 1,
    createdAt: ts,
    updatedAt: ts,
  };
  book.blocks.push(copy);
  persist();
  return copy;
}

function reorderBlocks(raw: Record<string, unknown>): ContentBlock[] {
  const book = current();
  const chapterId = str(raw.chapterId);
  const orderedIds = stringList(raw.orderedIds);
  const existing = blocksOf(book, chapterId);
  const ids = new Set(existing.map((block) => block.id));
  if (ids.size !== orderedIds.length || orderedIds.some((id) => !ids.has(id))) {
    throw new Error("Blok sırası geçersiz.");
  }
  const ts = now();
  orderedIds.forEach((id, index) => {
    const block = book.blocks.find((item) => item.id === id);
    if (!block) return;
    block.order = index;
    block.updatedAt = ts;
  });
  persist();
  return blocksOf(book, chapterId);
}

function createVersion(raw: Record<string, unknown>): BookVersion {
  const version = str(raw.version).trim();
  if (!version) throw new Error("Sürüm numarası boş olamaz.");
  const book = current();
  const record: VersionRecord = {
    id: crypto.randomUUID(),
    bookId: book.book.id,
    version,
    changelog: emptyToNull(raw.changelog),
    createdAt: now(),
    hasSnapshot: true,
    snapshot: {
      chapters: structuredClone(book.chapters),
      blocks: structuredClone(book.blocks),
    },
  };
  book.versions.unshift(record);
  persist();
  return publicVersion(record);
}

function restoreVersion(versionId: string) {
  const book = current();
  const record = book.versions.find((item) => item.id === versionId);
  if (!record?.snapshot) throw new Error("Bu sürümün anlık kopyası yok.");
  book.chapters = structuredClone(record.snapshot.chapters);
  book.blocks = structuredClone(record.snapshot.blocks);
  if (!book.chapters.some((chapter) => chapter.id === book.settings.lastOpenedChapterId)) {
    book.settings.lastOpenedChapterId = book.chapters[0]?.id ?? null;
  }
  persist();
}

function upsertNote(raw: Record<string, unknown>): Note {
  const title = str(raw.title).trim();
  if (!title) throw new Error("Not başlığı boş olamaz.");
  const book = current();
  const id = nonempty(raw.id) ?? crypto.randomUUID();
  const ts = now();
  const existing = book.notes.find((note) => note.id === id);
  if (existing) {
    existing.title = title;
    existing.body = str(raw.body);
    existing.chapterId = emptyToNull(raw.chapterId);
    existing.updatedAt = ts;
    persist();
    return existing;
  }
  const note: Note = {
    id,
    projectId: book.project.id,
    chapterId: emptyToNull(raw.chapterId),
    title,
    body: str(raw.body),
    createdAt: ts,
    updatedAt: ts,
  };
  book.notes.unshift(note);
  persist();
  return note;
}

function saveTemplate(raw: Record<string, unknown>): ChapterTemplate {
  const name = str(raw.name).trim();
  if (!name) throw new Error("Şablon adı boş olamaz.");
  const template: ChapterTemplate = {
    id: crypto.randomUUID(),
    projectId: current().project.id,
    name,
    description: emptyToNull(raw.description),
    payload: raw.payload,
    createdAt: now(),
    builtin: false,
  };
  current().templates.unshift(template);
  persist();
  return template;
}

function applyTemplate(raw: Record<string, unknown>): ContentBlock[] {
  const book = current();
  const chapterId = str(raw.chapterId);
  requireChapter(chapterId);
  insertTemplateSpecs(book, chapterId, templateSpecs(book, str(raw.templateId)));
  persist();
  return blocksOf(book, chapterId);
}

function deleteTemplate(id: string) {
  if (id.startsWith("builtin-")) throw new Error("Hazır şablon silinemez.");
  const book = current();
  const before = book.templates.length;
  book.templates = book.templates.filter((item) => item.id !== id);
  if (book.templates.length === before) throw new Error("Şablon bulunamadı.");
  persist();
}

function listPresets(blockType: unknown): StylePreset[] {
  const kind = nonempty(blockType);
  return current().presets.filter((item) => !kind || item.blockType === kind);
}

function savePreset(raw: Record<string, unknown>): StylePreset {
  const name = str(raw.name).trim();
  if (!name) throw new Error("Stil şablonu adı boş olamaz.");
  const preset: StylePreset = {
    id: crypto.randomUUID(),
    projectId: current().project.id,
    name,
    blockType: str(raw.blockType),
    style: (raw.style as StylePreset["style"]) ?? {},
    createdAt: now(),
  };
  current().presets.unshift(preset);
  persist();
  return preset;
}

function listAssets(assetType: unknown): Asset[] {
  const kind = nonempty(assetType);
  return current().assets.filter((asset) => !kind || asset.type === kind);
}

async function importAsset(raw: Record<string, unknown>): Promise<Asset> {
  const file = getPreviewFile(str(raw.sourcePath));
  if (!file) throw new Error("Dosya seçilemedi. Tarayıcı önizlemesinde dosyayı yeniden seçin.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  return storeAsset(file.name, file.type || "application/octet-stream", bytes, str(raw.assetType));
}

function importAssetBytes(raw: Record<string, unknown>): Asset {
  const bytes = toBytes(raw.bytes);
  const filename = str(raw.filename) || "gorsel.png";
  const mime = filename.toLowerCase().endsWith(".png")
    ? "image/png"
    : filename.toLowerCase().endsWith(".jpg") || filename.toLowerCase().endsWith(".jpeg")
      ? "image/jpeg"
      : "application/octet-stream";
  return storeAsset(filename, mime, bytes, str(raw.assetType));
}

function storeAsset(filename: string, mimeType: string, bytes: Uint8Array, assetType: string): Asset {
  const book = current();
  const id = crypto.randomUUID();
  const relativePath = `assets/${id}-${filename.replace(/[\\/]/g, "_")}`;
  const dataUrl = `data:${mimeType};base64,${bytesToBase64(bytes)}`;
  assetData.set(relativePath, dataUrl);
  const asset: Asset = {
    id,
    projectId: book.project.id,
    type: assetType || "file",
    filename,
    relativePath,
    mimeType,
    size: bytes.byteLength,
    createdAt: now(),
  };
  book.assets.unshift(asset);
  persist();
  return asset;
}

function readAssetDataUrl(relativePath: string): string {
  const url = assetData.get(relativePath);
  if (!url) throw new Error("Dosya bu oturumda yok. Tarayıcı önizlemesinde görseller sayfa yenilenince silinir.");
  return url;
}

function deleteAsset(id: string) {
  const book = current();
  const asset = book.assets.find((item) => item.id === id);
  if (asset) assetData.delete(asset.relativePath);
  book.assets = book.assets.filter((item) => item.id !== id);
  persist();
}

function openAsset(relativePath: string) {
  const url = assetData.get(relativePath);
  if (!url) throw new Error("Dosya bu oturumda açılamıyor.");
  window.open(url, "_blank", "noopener,noreferrer");
}

async function readImportBytes(path: string): Promise<Uint8Array> {
  const file = getPreviewFile(path);
  if (!file) throw new Error("Dosya seçilemedi.");
  return new Uint8Array(await file.arrayBuffer());
}

function exportBook(raw: Record<string, unknown>): { format: string; outputPath: string } {
  const format = str(raw.format) || "html";
  const book = current();
  const html = renderHtml(book);
  const filename = `${safeName(book.book.title)}.${format === "pdf" || format === "epub" ? "html" : format === "mobile" ? "html" : "html"}`;
  download(filename, new Blob([html], { type: "text/html;charset=utf-8" }));
  return { format, outputPath: `Tarayıcı/indirilenler/${filename}` };
}

function downloadBackup(): string {
  const book = current();
  const filename = `${safeName(book.book.title)}-yedek.json`;
  download(filename, new Blob([JSON.stringify(book, null, 2)], { type: "application/json" }));
  return `Tarayıcı/yedekler/${filename}`;
}

function listLibrary(): LibraryBook[] {
  return Object.entries(library.books)
    .map(([path, book]) => ({
      title: book.book.title,
      path,
      updatedAt: book.book.updatedAt,
      isCurrent: path === library.currentPath,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function createLibraryBook(title: string): WorkspaceSnapshot {
  const name = title.trim() || "Adsız Kitap";
  const path = uniquePath(name);
  library.books[path] = emptyBook(name, path);
  library.currentPath = path;
  persist();
  return snapshot(current());
}

function openLibraryBook(path: string): WorkspaceSnapshot {
  if (!library.books[path]) throw new Error("Kitap bulunamadı.");
  library.currentPath = path;
  persist();
  return snapshot(current());
}

function insertTemplateSpecs(book: StoredBook, chapterId: string, specs: unknown[]) {
  for (const spec of specs) {
    if (!spec || typeof spec !== "object") continue;
    const record = spec as { type?: string; data?: unknown; style?: ContentBlock["style"] };
    const type = record.type || "paragraph";
    if (!allowedBlockType(type)) continue;
    const order = blocksOf(book, chapterId).reduce((max, block) => Math.max(max, block.order), -1) + 1;
    const ts = now();
    book.blocks.push({
      id: crypto.randomUUID(),
      chapterId,
      type: type as ContentBlock["type"],
      order,
      data: record.data ?? defaultBlockData(type),
      style: record.style ?? {},
      createdAt: ts,
      updatedAt: ts,
    });
  }
}

function templateSpecs(book: StoredBook, templateId: string): unknown[] {
  const builtin = builtinTemplates().find((item) => item.id === templateId);
  const saved = book.templates.find((item) => item.id === templateId);
  const payload = builtin?.payload ?? saved?.payload;
  if (!payload) throw new Error("Şablon bulunamadı.");
  return Array.isArray(payload) ? payload : [];
}

function statsFor(book: StoredBook, bookId: string): BookStats {
  const chapters = book.chapters.filter((chapter) => chapter.bookId === bookId);
  const ids = new Set(chapters.map((chapter) => chapter.id));
  const blocks = book.blocks.filter((block) => ids.has(block.chapterId));
  let wordCount = 0;
  let characterCount = 0;
  for (const block of blocks) {
    const text = collectText(block.data);
    characterCount += [...text].filter((char) => !/\s/.test(char)).length;
    wordCount += text.split(/\s+/).filter(Boolean).length;
  }
  return {
    chapterCount: chapters.length,
    wordCount,
    characterCount,
    imageCount: blocks.filter((block) => block.type === "image").length,
    videoCount: blocks.filter((block) => block.type === "video").length,
    qrCount: blocks.filter((block) => block.type === "qr").length,
    fileCount: blocks.filter((block) => block.type === "file").length,
    estimatedPages: wordCount === 0 ? 0 : Math.ceil(wordCount / 250),
  };
}

function blocksOf(book: StoredBook, chapterId: string): ContentBlock[] {
  return book.blocks.filter((block) => block.chapterId === chapterId).sort((a, b) => a.order - b.order);
}

function requireChapter(id: string): Chapter {
  const chapter = current().chapters.find((item) => item.id === id);
  if (!chapter) throw new Error("Bölüm bulunamadı.");
  return chapter;
}

function requireBlock(id: string): ContentBlock {
  const block = current().blocks.find((item) => item.id === id);
  if (!block) throw new Error("Blok bulunamadı.");
  return block;
}

function descendantIds(book: StoredBook, id: string): string[] {
  const ids = [id];
  for (const chapter of book.chapters) {
    if (chapter.parentId && ids.includes(chapter.parentId) && !ids.includes(chapter.id)) ids.push(chapter.id);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const chapter of book.chapters) {
      if (chapter.parentId && ids.includes(chapter.parentId) && !ids.includes(chapter.id)) {
        ids.push(chapter.id);
        grew = true;
      }
    }
  }
  return ids;
}

function chapterNumber(book: StoredBook, parentId: string | null, order: number): string {
  const siblings = book.chapters.filter((chapter) => chapter.parentId === parentId && chapter.order <= order);
  const index = siblings.length + 1;
  if (!parentId) return String(index);
  const parent = book.chapters.find((chapter) => chapter.id === parentId);
  return parent?.number ? `${parent.number}.${index}` : String(index);
}

function compareChapters(a: Chapter, b: Chapter): number {
  if (a.parentId === b.parentId) return a.order - b.order;
  return a.order - b.order;
}

function publicVersion(record: VersionRecord): BookVersion {
  return {
    id: record.id,
    bookId: record.bookId,
    version: record.version,
    changelog: record.changelog,
    createdAt: record.createdAt,
    hasSnapshot: record.hasSnapshot,
  };
}

function renderHtml(book: StoredBook): string {
  const chapters = [...book.chapters].sort(compareChapters);
  const body = chapters
    .map((chapter) => {
      const blocks = blocksOf(book, chapter.id)
        .map((block) => `<section><p>${escapeHtml(collectText(block.data) || block.type)}</p></section>`)
        .join("\n");
      return `<article><h1>${escapeHtml(chapter.number ? `${chapter.number} ${chapter.title}` : chapter.title)}</h1>${blocks}</article>`;
    })
    .join("\n");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(book.book.title)}</title></head><body><h1>${escapeHtml(book.book.title)}</h1>${body}</body></html>`;
}

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function loadLibrary(): LibraryState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LibraryState;
      if (parsed.currentPath && parsed.books?.[parsed.currentPath]) return parsed;
    }
  } catch {
    // Bozuk kayıtta örnek kitaba dön.
  }
  return { currentPath: DEMO_PATH, books: { [DEMO_PATH]: seedDemo() } };
}

function persist() {
  try {
    const slim: LibraryState = {
      currentPath: library.currentPath,
      books: Object.fromEntries(
        Object.entries(library.books).map(([path, book]) => [
          path,
          {
            ...book,
            assets: book.assets.map((asset) => ({ ...asset })),
          },
        ]),
      ),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
  } catch {
    // Kota dolarsa oturum bellekte sürer.
  }
}

function seedDemo(): StoredBook {
  const ts = now();
  const projectId = "demo-project";
  const bookId = "demo-book";
  const preface = "ch-onsoz";
  const breathing = "ch-nefes";
  const sources = "ch-kaynakca";
  const book = emptyShell(projectId, bookId, "TAKTİK EĞİTİM", DEMO_PATH, ts);
  book.book.subtitle = "Hayatta Kalma Bakış Açısı";
  book.book.author = "Kitap Stüdyosu";
  book.book.description = "Geliştirme ortamı için örnek kitap içeriği.";
  book.book.publisher = "Kitap Stüdyosu Yayınları";
  book.chapters = [
    chapter(bookId, preface, null, "Önsöz", null, 0, ts),
    chapter(bookId, "ch-giris", null, "Giriş", "1", 1, ts),
    chapter(bookId, "ch-kavram", null, "Temel Kavramlar", "2", 2, ts),
    chapter(bookId, "ch-risk", null, "Risk ve Tehdit", "3", 3, ts),
    chapter(bookId, "ch-hayatta", null, "Hayatta Kalma Bakış Açısı", "4", 4, ts),
    chapter(bookId, "ch-genel", "ch-hayatta", "Genel Bakış", "4.1", 0, ts),
    chapter(bookId, "ch-prensip", "ch-hayatta", "Uygulama Prensipleri", "4.2", 1, ts),
    chapter(bookId, "ch-durum", "ch-prensip", "Durumu Değerlendirin", "4.2.1", 0, ts),
    chapter(bookId, "ch-oncelik", "ch-prensip", "Öncelikleri Belirleyin", "4.2.2", 1, ts),
    chapter(bookId, "ch-kaynak", "ch-prensip", "Kaynakları Yönetin", "4.2.3", 2, ts),
    chapter(bookId, "ch-iletisim", "ch-prensip", "İletişimi Sürdürün", "4.2.4", 3, ts),
    chapter(bookId, "ch-enerji", "ch-prensip", "Enerjinizi Koruyun", "4.2.5", 4, ts),
    chapter(bookId, breathing, "ch-prensip", "Doğru Bir Teknikle Nefes Alıp Verin", "4.2.6", 5, ts),
    chapter(bookId, "ch-olay", null, "Örnek Olaylar", "5", 5, ts),
    chapter(bookId, "ch-sonuc", null, "Sonuç", "6", 6, ts),
    chapter(bookId, sources, null, "Kaynakça", null, 7, ts),
  ];
  book.blocks = [
    block(preface, "heading", 0, { level: 1, content: richHeading(1, "Önsöz") }, ts),
    block(
      preface,
      "paragraph",
      1,
      { content: richParagraph("Bu kitap, baskı altında sakin kalmayı ve doğru tekniği otomatik hale getirmeyi öğretir.") },
      ts,
    ),
    block(breathing, "heading", 0, { level: 1, content: richHeading(1, "Doğru Bir Teknikle Nefes Alıp Verin") }, ts),
    block(
      breathing,
      "paragraph",
      1,
      {
        content: richParagraph(
          "Stres altında ilk kaybedilen becerilerden biri düzgün nefes almaktır. Kontrolsüz nefes, kalp ritmini yükseltir, karar kalitesini düşürür ve bedeni gereksiz yere yorar. Bilinçli bir teknik, birkaç saniye içinde sistemi yeniden dengeleyebilir.",
        ),
      },
      ts,
    ),
    block(
      breathing,
      "image",
      2,
      {
        assetId: null,
        alt: "Nefes tekniği diyagramı",
        caption: "Kutu nefesi adımları — görseli Medya panelinden ekleyin",
        description: "",
        width: 100,
        align: "center",
        borderRadius: 8,
        showInEpub: true,
        showInPdf: true,
        showInHtml: true,
        placeholder: true,
      },
      ts,
    ),
    block(
      breathing,
      "infoBox",
      3,
      {
        icon: "info",
        title: "ÖNEMLİ",
        content: richParagraph("Nefes egzersizlerini düzenli olarak uygulamak, stresli durumlarda otomatik olarak doğru tepki vermenizi sağlar."),
        variant: "info",
        padding: "md",
      },
      ts,
    ),
    block(
      breathing,
      "video",
      4,
      {
        sourceType: "external",
        title: "Kutu nefesi uygulaması",
        description: "Yerel video dosyası veya harici bağlantı ekleyebilirsiniz",
        url: "",
        thumbnailAssetId: null,
        duration: null,
        generateQr: false,
        showInEpub: true,
        showInPdf: true,
        showInHtml: true,
        placeholder: true,
      },
      ts,
    ),
    block(
      breathing,
      "qr",
      5,
      {
        mode: "url",
        value: "https://example.com/nefes-teknigi",
        title: "Uygulama videosu",
        description: "Telefonda açılacak bağlantı için QR kod",
        size: 160,
        errorCorrection: "M",
        margin: 4,
        placeholder: true,
      },
      ts,
    ),
    block(
      breathing,
      "orderedList",
      6,
      {
        content: {
          type: "doc",
          content: [
            {
              type: "orderedList",
              content: [
                listItem("Burnunuzdan dört saniye nefes alın."),
                listItem("Dört saniye nefesi tutun."),
                listItem("Ağzınızdan dört saniye nefes verin."),
                listItem("Dört saniye bekleyin ve döngüyü tekrarlayın."),
              ],
            },
          ],
        },
      },
      ts,
    ),
    block(
      breathing,
      "quote",
      7,
      {
        content: richQuote("Sakin bir nefes, karmaşık bir kararın ilk adımıdır."),
        attribution: "",
      },
      ts,
    ),
    block(sources, "paragraph", 0, { content: richParagraph("Kaynakça bu örnekte yer tutucu olarak bırakılmıştır.") }, ts),
  ];
  book.settings.lastOpenedChapterId = breathing;
  book.versions = [
    {
      id: "demo-version",
      bookId,
      version: "1.0.0",
      changelog: "Geliştirme demo içeriği oluşturuldu.",
      createdAt: ts,
      hasSnapshot: false,
      snapshot: null,
    },
  ];
  return book;
}

function emptyBook(title: string, path: string): StoredBook {
  const ts = now();
  const projectId = crypto.randomUUID();
  const bookId = crypto.randomUUID();
  const chapterId = crypto.randomUUID();
  const book = emptyShell(projectId, bookId, title, path, ts);
  book.book.subtitle = "Yaz • Tasarla • Yayınla";
  book.book.description = "Bu kitap Kitap Stüdyosu ile oluşturuldu.";
  book.chapters = [chapter(bookId, chapterId, null, "Giriş", "1", 0, ts)];
  book.blocks = [block(chapterId, "paragraph", 0, { content: richParagraph("Yazmaya buradan başlayın.") }, ts)];
  book.settings.lastOpenedChapterId = chapterId;
  book.versions = [
    {
      id: crypto.randomUUID(),
      bookId,
      version: "1.0.0",
      changelog: "İlk sürüm",
      createdAt: ts,
      hasSnapshot: false,
      snapshot: null,
    },
  ];
  return book;
}

function emptyShell(projectId: string, bookId: string, title: string, path: string, ts: string): StoredBook {
  const project: Project = { id: projectId, name: title, rootPath: path, createdAt: ts, updatedAt: ts };
  const book: Book = {
    id: bookId,
    projectId,
    title,
    subtitle: null,
    author: "",
    description: null,
    language: "tr",
    isbn: null,
    publisher: null,
    coverAssetId: null,
    pageColor: "#ffffff",
    inkColor: "#152033",
    fontFamily: "Segoe UI",
    pageNumbers: false,
    pageNumberAlign: "center",
    pageNumberStart: 1,
    lineHeight: 1.15,
    createdAt: ts,
    updatedAt: ts,
  };
  const settings: ProjectSettings = {
    id: crypto.randomUUID(),
    projectId,
    autosaveMs: 800,
    lastOpenedChapterId: null,
    theme: "system",
    createdAt: ts,
    updatedAt: ts,
  };
  return {
    project,
    book,
    chapters: [],
    blocks: [],
    settings,
    versions: [],
    notes: [],
    templates: [],
    presets: [],
    assets: [],
  };
}

function chapter(
  bookId: string,
  id: string,
  parentId: string | null,
  title: string,
  number: string | null,
  order: number,
  ts: string,
): Chapter {
  return { id, bookId, parentId, title, number, order, createdAt: ts, updatedAt: ts };
}

function block(chapterId: string, type: ContentBlock["type"], order: number, data: unknown, ts: string): ContentBlock {
  return {
    id: `${chapterId}-${type}-${order}`,
    chapterId,
    type,
    order,
    data,
    style: {},
    createdAt: ts,
    updatedAt: ts,
  };
}

function richParagraph(text: string) {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

function richHeading(level: number, text: string) {
  return {
    type: "doc",
    content: [{ type: "heading", attrs: { level }, content: [{ type: "text", text }] }],
  };
}

function richQuote(text: string) {
  return {
    type: "doc",
    content: [
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text }] }],
      },
    ],
  };
}

function listItem(text: string) {
  return { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

function collectText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(collectText).filter(Boolean).join(" ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const own = typeof record.text === "string" ? record.text : "";
    const nested = Object.entries(record)
      .filter(([key]) => key !== "text")
      .map(([, nestedValue]) => collectText(nestedValue))
      .filter(Boolean)
      .join(" ");
    return [own, nested].filter(Boolean).join(" ");
  }
  return "";
}

function payload(args: Record<string, unknown>): Record<string, unknown> {
  const value = args.payload;
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nonempty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function emptyToNull(value: unknown): string | null {
  if (value == null) return null;
  return nonempty(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function now(): string {
  return new Date().toISOString();
}

function uniquePath(title: string): string {
  const base = `Tarayıcı/Kitaplar/${title.trim() || "Adsız Kitap"}`;
  if (!library.books[base]) return base;
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

function safeName(title: string): string {
  return title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "kitap";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function toBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return Uint8Array.from(value.filter((item): item is number => typeof item === "number"));
  return new Uint8Array();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}
