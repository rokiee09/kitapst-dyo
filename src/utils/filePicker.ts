import { isTauriRuntime } from "@/services/tauri/invoke";
import { registerPreviewFile } from "@/services/browser/previewFiles";

export async function pickLocalFile(kind: "image" | "video" | "file" | "zip" | "word"): Promise<string | null> {
  if (!isTauriRuntime()) return pickBrowserFile(kind);
  const { open } = await import("@tauri-apps/plugin-dialog");
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

function pickBrowserFile(kind: "image" | "video" | "file" | "zip" | "word"): Promise<string | null> {
  const accept =
    kind === "image"
      ? "image/jpeg,image/png,image/webp,image/svg+xml,.jpg,.jpeg,.png,.webp,.svg"
      : kind === "video"
        ? "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.mkv"
        : kind === "zip"
          ? ".zip,application/zip"
          : kind === "word"
            ? ".docx,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            : ".pdf,.zip,.epub,.txt,.md,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.rtf";
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      resolve(file ? registerPreviewFile(file) : null);
    };
    input.click();
  });
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
