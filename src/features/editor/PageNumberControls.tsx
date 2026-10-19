import { useWorkspaceStore } from "@/stores/workspaceStore";
import { cn } from "@/lib/utils";

export function PageNumberControls({ compact = false }: { compact?: boolean }) {
  const book = useWorkspaceStore((state) => state.book);
  const updateBook = useWorkspaceStore((state) => state.updateBook);

  if (!book) return null;

  return (
    <div className={cn("flex items-center gap-2", compact ? "text-[11px]" : "text-sm")}>
      <label className="flex cursor-pointer items-center gap-1.5 text-[#9fb3c9]">
        <input
          type="checkbox"
          className="accent-blue-600"
          checked={Boolean(book.pageNumbers)}
          onChange={(event) => {
            void updateBook({ ...book, pageNumbers: event.target.checked }, { silent: true });
          }}
        />
        Sayfa numarası
      </label>
      {book.pageNumbers ? (
        <select
          className="h-7 rounded-md border border-[#1c314c] bg-[#102038] px-1 text-[11px] text-white"
          value={book.pageNumberAlign || "center"}
          onChange={(event) => {
            void updateBook(
              { ...book, pageNumberAlign: event.target.value as "left" | "center" | "right" },
              { silent: true },
            );
          }}
        >
          <option value="left">Sol alt</option>
          <option value="center">Orta alt</option>
          <option value="right">Sağ alt</option>
        </select>
      ) : null}
    </div>
  );
}
