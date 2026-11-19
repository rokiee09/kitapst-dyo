import { BookOpen, ImageIcon, LayoutTemplate, ListTree, Settings } from "lucide-react";
import { tr } from "@/i18n/tr";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/uiStore";
import type { AppView } from "@/types/domain";

const ITEMS: { view: AppView; label: string; icon: typeof BookOpen }[] = [
  { view: "book", label: tr.nav.book, icon: BookOpen },
  { view: "chapters", label: tr.nav.chapters, icon: ListTree },
  { view: "media", label: tr.nav.media, icon: ImageIcon },
  { view: "templates", label: tr.nav.templates, icon: LayoutTemplate },
];

export function IconNav() {
  const view = useUiStore((state) => state.view);
  const setView = useUiStore((state) => state.setView);
  const openBookSettings = useUiStore((state) => state.openBookSettings);

  return (
    <nav className="flex h-full w-[88px] shrink-0 flex-col border-r border-[#1c314c] bg-[#07111f] py-3">
      <div className="flex flex-1 flex-col gap-0.5 px-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = view === item.view;
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => setView(item.view)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md px-1 py-2 text-center text-[11px] text-[#8aa0b8] hover:bg-[#13233a] hover:text-white",
                active && "bg-blue-600/20 text-white",
              )}
            >
              <Icon size={18} className={active ? "text-blue-400" : ""} />
              <span className="leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={openBookSettings}
        className="mx-2 flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] text-[#8aa0b8] hover:bg-[#13233a] hover:text-white"
      >
        <Settings size={18} />
        Ayarlar
      </button>
    </nav>
  );
}
