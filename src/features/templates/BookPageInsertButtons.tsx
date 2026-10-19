import { BOOK_PAGE_STRUCTURES, type BookPageStructureId } from "@/features/templates/bookPages";
import { addBookPage } from "@/features/templates/addBookPage";
import { cn } from "@/lib/utils";

export function BookPageInsertButtons({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn(compact ? "grid grid-cols-2 gap-1" : "grid grid-cols-2 gap-2 sm:grid-cols-4")}>
      {BOOK_PAGE_STRUCTURES.map((page) => (
        <button
          key={page.id}
          type="button"
          title={page.hint}
          className={cn(
            "rounded-md border border-[#2a4568] bg-[#102038] text-left text-[#d7e3f4] hover:border-blue-400 hover:bg-[#163056]",
            compact ? "px-2 py-1.5 text-[11px]" : "px-3 py-2 text-xs font-medium",
          )}
          onClick={() => void addBookPage(page.id as BookPageStructureId)}
        >
          {page.title}
        </button>
      ))}
    </div>
  );
}
