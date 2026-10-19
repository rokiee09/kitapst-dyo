import { open } from "@tauri-apps/plugin-dialog";

export async function pickLocalFile(kind: "image" | "video" | "file" | "zip" | "word"): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    title:
      kind === "image"
        ? "Görsel seç"
        : kind === "video"
          ? "Video seç"
          : kind === "zip"
            ? "ZIP yedek seç"
            : kind === "word"
              ? "Word belgesi seç"
              : "Dosya seç",
    filters:
      kind === "image"
        ? [{ name: "Görseller", extensions: ["jpg", "jpeg", "png", "webp", "svg"] }]
        : kind === "video"
          ? [{ name: "Videolar", extensions: ["mp4", "webm", "mov", "mkv"] }]
          : kind === "zip"
            ? [{ name: "ZIP yedek", extensions: ["zip"] }]
            : kind === "word"
              ? [{ name: "Word ve metin", extensions: ["docx", "txt", "md"] }]
              : [{ name: "Dosyalar", extensions: ["pdf", "zip", "epub", "txt", "md", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "rtf"] }],
  });
  return asSinglePath(selected);
}

function asSinglePath(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) return asSinglePath(value[0]);
  if (value && typeof value === "object" && "path" in value) {
    const path = (value as { path: unknown }).path;
    if (typeof path === "string" && path.trim()) return path;
  }
  return null;
}
