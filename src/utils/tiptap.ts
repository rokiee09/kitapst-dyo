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

export function jsonContentToPlainText(node: JSONContent | undefined | null): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  const children = (node.content ?? []).map((child) => jsonContentToPlainText(child)).join("");
  if (node.type === "hardBreak") return "\n";
  if (node.type === "paragraph" || node.type === "heading" || node.type === "listItem") {
    return `${children}\n`;
  }
  return children;
}

export function jsonHasType(node: JSONContent | undefined | null, types: string[]): boolean {
  if (!node) return false;
  if (node.type && types.includes(node.type)) return true;
  return (node.content ?? []).some((child) => jsonHasType(child, types));
}

export function readBlockContent(data: unknown): JSONContent {
  if (!data || typeof data !== "object") return emptyDoc();
  const record = data as Record<string, unknown>;
  return asJsonContent(record.content);
}
