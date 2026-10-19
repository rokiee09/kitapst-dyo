import { Smartphone, Tablet, BookOpen } from "lucide-react";
import { tr } from "@/i18n/tr";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/uiStore";
import type { PreviewMode } from "@/types/domain";

const MODES: { id: PreviewMode; label: string; icon: typeof BookOpen }[] = [
  { id: "book", label: tr.preview.book, icon: BookOpen },
  { id: "tablet", label: tr.preview.tablet, icon: Tablet },
  { id: "phone", label: tr.preview.phone, icon: Smartphone },
];

export function PreviewBar() {
  const previewMode = useUiStore((state) => state.previewMode);
  const setPreviewMode = useUiStore((state) => state.setPreviewMode);

  return (
    <div className="flex h-10 items-center justify-center gap-1 border-t border-[#e7e1d4] bg-[#f4efe4]">
      {MODES.map((mode) => {
        const Icon = mode.icon;
        const active = previewMode === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => setPreviewMode(mode.id)}
            className={cn(
              "flex items-center gap-1.5 rounded px-3 py-1 text-xs text-[#5b6578] hover:bg-white",
              active && "bg-white text-[#182033] shadow-sm",
            )}
          >
            <Icon size={13} />
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
