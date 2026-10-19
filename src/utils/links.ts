import type { Editor } from "@tiptap/react";
import { isSafeExternalUrl } from "@/utils/security";

export function applyLink(editor: Editor | null): void {
  if (!editor) return;
  const previous = editor.getAttributes("link").href as string | undefined;
  const next = window.prompt("Bağlantı URL’si", previous ?? "https://");
  if (next === null) return;
  const trimmed = next.trim();
  if (!trimmed) {
    editor.chain().focus().unsetLink().run();
    return;
  }
  if (!isSafeExternalUrl(trimmed)) {
    window.alert("Yalnızca http veya https bağlantıları kabul edilir.");
    return;
  }
  editor.chain().focus().setLink({ href: trimmed }).run();
}
