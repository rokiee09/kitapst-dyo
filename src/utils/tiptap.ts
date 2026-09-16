import type { JSONContent } from "@tiptap/react";

export function emptyDoc(): JSONContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function asJsonContent(value: unknown): JSONContent {
  if (value && typeof value === "object" && "type" in value) {
    return value as JSONContent;
  }
  return emptyDoc();
}

export function readBlockContent(data: unknown): JSONContent {
  if (!data || typeof data !== "object") return emptyDoc();
  const record = data as Record<string, unknown>;
  return asJsonContent(record.content);
}
