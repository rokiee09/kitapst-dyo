import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { NotesView } from "@/features/notes/NotesView";
import { StatsView } from "@/features/stats/StatsView";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/uiStore";

export function SideDrawer() {
  const drawer = useUiStore((state) => state.drawer);
  const close = useUiStore((state) => state.closeDrawer);
  if (!drawer) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/40">
      <button type="button" className="flex-1 cursor-default" aria-label="Kapat" onClick={close} />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-[#1c314c] bg-[#0c1829] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1c314c] px-4 py-3">
          <h2 className="text-sm font-semibold text-white">
            {drawer === "notes" ? "Notlar" : "İstatistik"}
          </h2>
          <Button size="icon" variant="ghost" onClick={close} aria-label="Kapat">
            <X size={16} />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {drawer === "notes" ? <NotesView /> : <StatsView />}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
