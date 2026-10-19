const BLOCKED_PROTOCOLS = ["javascript:", "data:", "vbscript:", "file:"];

export function isSafeExternalUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (BLOCKED_PROTOCOLS.some((protocol) => lower.startsWith(protocol))) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function sanitizeImportedFilename(name: string): string {
  const base = name.replace(/^.*[\\/]/, "");
  const cleaned = [...base]
    .filter((ch) => ch !== "\0" && !'<>:"/\\|?*'.includes(ch))
    .join("")
    .replace(/^\.+/, "");
  return cleaned.trim() || "dosya";
}
