import { BarChart3, Moon, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { SaveStatusBadge } from "@/components/layout/SaveStatusBadge";
import { useUiStore } from "@/stores/uiStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

/** Alt durum çubuğu: kayıt, istatistik özeti, notlar/istatistik çekmeceleri. */
export function StatusBar() {
  const stats = useWorkspaceStore((state) => state.stats);
  const paperDark = useUiStore((state) => state.paperDark);
  const togglePaperDark = useUiStore((state) => state.togglePaperDark);
  const openDrawer = useUiStore((state) => state.openDrawer);
  const drawer = useUiStore((state) => state.drawer);

  return (
    <div className="flex h-9 shrink-0 items-center gap-3 border-t border-[#1c314c] bg-[#0a1628] px-3 text-[11px] text-[#8aa0b8]">
      <SaveStatusBadge />
      <span className="h-3 w-px bg-[#1c314c]" />
      <span>
        {stats?.wordCount?.toLocaleString("tr-TR") ?? 0} kelime
      </span>
      <span>·</span>
      <span>{stats?.chapterCount ?? 0} bölüm</span>
      <span>·</span>
      <span>~{stats?.estimatedPages ?? 0} sayfa</span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 hover:bg-[#163056] hover:text-white",
            drawer === "notes" && "bg-[#163056] text-white",
          )}
          onClick={() => openDrawer("notes")}
        >
          <StickyNote size={12} />
          Notlar
        </button>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 hover:bg-[#163056] hover:text-white",
            drawer === "stats" && "bg-[#163056] text-white",
          )}
          onClick={() => openDrawer("stats")}
        >
          <BarChart3 size={12} />
          İstatistik
        </button>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 hover:bg-[#163056] hover:text-white",
            paperDark && "bg-[#163056] text-white",
          )}
          onClick={togglePaperDark}
          title="Karanlık kâğıt"
        >
          <Moon size={12} />
        </button>
      </div>
    </div>
  );
}
