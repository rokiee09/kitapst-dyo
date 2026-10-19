import type { JSONContent } from "@tiptap/react";

export type AppView =
  | "library"
  | "book"
  | "chapters"
  | "media"
  | "templates"
  | "notes"
  | "stats"
  | "export"
  | "settings";

export type PreviewMode = "book" | "tablet" | "phone";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type BlockType =
  | "heading"
  | "paragraph"
  | "image"
  | "video"
  | "qr"
  | "infoBox"
  | "warningBox"
  | "quote"
  | "orderedList"
  | "unorderedList"
  | "table"
  | "divider"
  | "file"
  | "pageBreak"
  | "code";

export interface BlockStyle {
  align?: "left" | "center" | "right" | "justify";
  padding?: "sm" | "md" | "lg";
  color?: string;
  background?: string;
  fontFamily?: string;
  fontSize?: number;
  headingSize?: 1 | 2 | 3;
  lineHeight?: number;
  listMarker?: string;
  placement?: "flow" | "free";
  x?: number;
  y?: number;
  width?: number;
}

export interface ContentBlock {
  id: string;
  chapterId: string;
  type: BlockType;
  order: number;
  data: unknown;
  style: BlockStyle;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  rootPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface Book {
  id: string;
  projectId: string;
  title: string;
  subtitle: string | null;
  author: string | null;
  description: string | null;
  language: string;
  isbn: string | null;
  publisher: string | null;
  coverAssetId: string | null;
  pageColor: string;
  inkColor: string;
  fontFamily: string;
  pageNumbers: boolean;
  pageNumberAlign: "left" | "center" | "right";
  pageNumberStart: number;
  lineHeight: number;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  bookId: string;
  parentId: string | null;
  title: string;
  number: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookVersion {
  id: string;
  bookId: string;
  version: string;
  changelog: string | null;
  createdAt: string;
  hasSnapshot: boolean;
}

export interface ProjectSettings {
  id: string;
  projectId: string;
  autosaveMs: number;
  lastOpenedChapterId: string | null;
  theme: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookStats {
  chapterCount: number;
  wordCount: number;
  characterCount: number;
  imageCount: number;
  videoCount: number;
  qrCount: number;
  fileCount: number;
  estimatedPages: number;
}

export interface WorkspaceSnapshot {
  project: Project;
  book: Book;
  chapters: Chapter[];
  settings: ProjectSettings;
  versions: BookVersion[];
  selectedChapterId: string | null;
  selectedBlocks: ContentBlock[];
  stats: BookStats;
  isDemo: boolean;
}

export interface RichTextData {
  content: JSONContent;
}

export interface HeadingBlockData extends RichTextData {
  level: 1 | 2 | 3;
}

export interface CalloutBlockData extends RichTextData {
  icon: string;
  title: string;
  variant: "info" | "warning";
  padding: "sm" | "md" | "lg";
}

export interface QuoteBlockData extends RichTextData {
  attribution?: string;
}

export interface Asset {
  id: string;
  projectId: string;
  type: "image" | "video" | "file" | string;
  filename: string;
  relativePath: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface ImageBlockData {
  assetId: string | null;
  relativePath: string | null;
  alt: string;
  caption: string;
  captionCustom: boolean;
  captionVisible: boolean;
  description: string;
  width: number;
  align: "left" | "center" | "right";
  borderRadius: number;
  showInEpub: boolean;
  showInPdf: boolean;
  showInHtml: boolean;
}

export interface VideoBlockData {
  sourceType: "local" | "external";
  assetId: string | null;
  relativePath: string | null;
  title: string;
  caption: string;
  captionCustom: boolean;
  captionVisible: boolean;
  description: string;
  url: string;
  thumbnailAssetId: string | null;
  thumbnailPath: string | null;
  duration: string;
  generateQr: boolean;
  showInEpub: boolean;
  showInPdf: boolean;
  showInHtml: boolean;
  previewAsPdf: boolean;
  tile: boolean;
  width: number;
  align: "left" | "center" | "right";
  fit: "contain" | "cover";
}

export type QrTarget = "video" | "chapter" | "url" | "text";

export interface QrBlockData {
  target: QrTarget;
  mode: "url" | "text";
  value: string;
  chapterId: string | null;
  title: string;
  caption: string;
  captionCustom: boolean;
  captionVisible: boolean;
  description: string;
  size: number;
  errorCorrection: "L" | "M" | "Q" | "H";
  margin: number;
}

export const INSERTABLE_BLOCK_TYPES = [
  "paragraph",
  "heading",
  "image",
  "video",
  "qr",
  "infoBox",
  "warningBox",
  "quote",
  "orderedList",
  "unorderedList",
  "divider",
  "pageBreak",
  "table",
  "file",
  "code",
] as const satisfies readonly BlockType[];

export interface Note {
  id: string;
  projectId: string;
  chapterId: string | null;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterTemplate {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  payload: unknown;
  createdAt: string;
  builtin: boolean;
}

export interface StylePreset {
  id: string;
  projectId: string;
  name: string;
  blockType: string;
  style: BlockStyle;
  createdAt: string;
}

export interface LibraryBook {
  title: string;
  path: string;
  updatedAt: string;
  isCurrent: boolean;
}

export interface ExportResult {
  format: string;
  outputPath: string;
}
