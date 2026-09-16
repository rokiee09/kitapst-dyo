import { z } from "zod";

export const blockStyleSchema = z.object({
  align: z.enum(["left", "center", "right", "justify"]).optional(),
  padding: z.enum(["sm", "md", "lg"]).optional(),
  color: z.string().optional(),
  background: z.string().optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  placement: z.enum(["flow", "free"]).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
});

export const blockTypeSchema = z.enum([
  "heading",
  "paragraph",
  "image",
  "video",
  "qr",
  "infoBox",
  "warningBox",
  "quote",
  "orderedList",
  "unorderedList",
  "table",
  "divider",
  "file",
  "pageBreak",
]);

export const updateBookSchema = z.object({
  title: z.string().min(1, "Kitap adı boş olamaz."),
  subtitle: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  language: z.string().min(2),
  isbn: z.string().nullable().optional(),
  publisher: z.string().nullable().optional(),
  pageColor: z.string().optional(),
  inkColor: z.string().optional(),
  fontFamily: z.string().optional(),
  pageNumbers: z.boolean().optional(),
  pageNumberAlign: z.enum(["left", "center", "right"]).optional(),
  pageNumberStart: z.number().int().min(0).max(9999).optional(),
});

export const imageBlockSchema = z.object({
  assetId: z.string().nullable(),
  relativePath: z.string().nullable(),
  alt: z.string(),
  caption: z.string(),
  captionCustom: z.boolean().optional(),
  captionVisible: z.boolean().optional(),
  description: z.string(),
  width: z.number().min(8).max(100),
  align: z.enum(["left", "center", "right"]),
  borderRadius: z.number().min(0).max(48),
  showInEpub: z.boolean(),
  showInPdf: z.boolean(),
  showInHtml: z.boolean(),
});

export const videoBlockSchema = z.object({
  sourceType: z.enum(["local", "external"]),
  assetId: z.string().nullable(),
  relativePath: z.string().nullable(),
  title: z.string(),
  caption: z.string().optional(),
  captionCustom: z.boolean().optional(),
  captionVisible: z.boolean().optional(),
  description: z.string(),
  url: z.string(),
  thumbnailAssetId: z.string().nullable(),
  thumbnailPath: z.string().nullable(),
  duration: z.string(),
  generateQr: z.boolean(),
  showInEpub: z.boolean(),
  showInPdf: z.boolean(),
  showInHtml: z.boolean(),
  previewAsPdf: z.boolean(),
});

export const qrBlockSchema = z.object({
  target: z.enum(["video", "chapter", "url", "text"]),
  mode: z.enum(["url", "text"]),
  value: z.string(),
  chapterId: z.string().nullable(),
  title: z.string(),
  caption: z.string().optional(),
  captionCustom: z.boolean().optional(),
  captionVisible: z.boolean().optional(),
  description: z.string(),
  size: z.number().min(64).max(512),
  errorCorrection: z.enum(["L", "M", "Q", "H"]),
  margin: z.number().min(0).max(16),
});
