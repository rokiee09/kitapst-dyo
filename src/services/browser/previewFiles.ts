const files = new Map<string, File>();

export function registerPreviewFile(file: File): string {
  const id = crypto.randomUUID();
  const safe = file.name.replace(/[\\/]/g, "_") || "dosya";
  const token = `preview-file/${id}/${safe}`;
  files.set(token, file);
  return token;
}

export function getPreviewFile(token: string): File | undefined {
  return files.get(token);
}
