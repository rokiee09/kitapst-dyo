import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";

const GROUPS: { title: string; chars: string[] }[] = [
  { title: "Türkçe", chars: ["Ç", "ç", "Ğ", "ğ", "İ", "ı", "Ö", "ö", "Ş", "ş", "Ü", "ü"] },
  { title: "Noktalama", chars: ["–", "—", "…", "«", "»", "“", "”", "‘", "’", "„"] },
  { title: "Madde", chars: ["•", "◦", "▪", "▸", "–", "→", "★", "✦", "✓", "✗", "❖", "►"] },
  { title: "İşaret", chars: ["§", "¶", "†", "‡", "©", "®", "™", "№", "°", "·"] },
  { title: "Matematik", chars: ["±", "×", "÷", "≈", "≠", "≤", "≥", "∞", "½", "¼", "¾"] },
];

export function SpecialCharsButton({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false);

  function insert(char: string) {
    editor?.chain().focus().insertContent(char).run();
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        title="Özel işaretler"
        disabled={!editor}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-7 min-w-7 items-center justify-center rounded px-1 text-[13px] text-[#9fb3c9] hover:bg-[#163056] hover:text-white",
          open && "bg-blue-600/30 text-white",
        )}
      >
        Ω
      </button>
      {open ? (
        <div className="absolute left-0 top-8 z-50 w-72 rounded-md border border-[#1c314c] bg-[#0c1829] p-2 shadow-xl">
          {GROUPS.map((group) => (
            <div key={group.title} className="mb-2 last:mb-0">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#8aa0b8]">
                {group.title}
              </div>
              <div className="flex flex-wrap gap-1">
                {group.chars.map((char) => (
                  <button
                    key={`${group.title}-${char}`}
                    type="button"
                    title={char}
                    className="flex h-7 w-7 items-center justify-center rounded border border-[#1c314c] bg-[#102038] text-sm text-white hover:border-blue-400"
                    onClick={() => insert(char)}
                  >
                    {char}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
