import {
  BarChart3,
  BookOpen,
  ImageIcon,
  LayoutTemplate,
  Library,
  ListTree,
  Settings,
  Share2,
  StickyNote,
} from "lucide-react";
import { tr } from "@/i18n/tr";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/uiStore";
import type { AppView } from "@/types/domain";

const ITEMS: { view: AppView; label: string; icon: typeof BookOpen }[] = [
  { view: "library", label: tr.nav.library, icon: Library },
  { view: "book", label: tr.nav.book, icon: BookOpen },
  { view: "chapters", label: tr.nav.chapters, icon: ListTree },
  { view: "media", label: tr.nav.media, icon: ImageIcon },
  { view: "templates", label: tr.nav.templates, icon: LayoutTemplate },
  { view: "notes", label: tr.nav.notes, icon: StickyNote },
  { view: "stats", label: tr.nav.stats, icon: BarChart3 },
  { view: "export", label: tr.nav.export, icon: Share2 },
  { view: "settings", label: tr.nav.settings, icon: Settings },
];

export function IconNav() {
  const view = useUiStore((state) => state.view);
  const setView = useUiStore((state) => state.setView);

  return (
    <nav className="flex h-full w-[108px] shrink-0 flex-col border-r border-[#1c314c] bg-[#07111f] py-3">
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
                "flex items-center gap-2 rounded-md px-2 py-2 text-left text-[12px] text-[#8aa0b8] hover:bg-[#13233a] hover:text-white",
                active && "bg-blue-600/20 text-white",
              )}
            >
              <Icon size={16} className={active ? "text-blue-400" : ""} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
