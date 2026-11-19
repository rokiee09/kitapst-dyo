import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { BookSettingsView } from "@/features/books/BookSettingsView";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/uiStore";

export function BookSettingsDialog() {
  const open = useUiStore((state) => state.bookSettingsOpen);
  const close = useUiStore((state) => state.closeBookSettings);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-auto bg-black/55 p-4 pt-10">
      <div
        className="relative w-full max-w-3xl rounded-xl border border-[#1c314c] bg-[#0d1524] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-settings-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#1c314c] bg-[#0c1829] px-4 py-3">
          <h2 id="book-settings-title" className="text-sm font-semibold text-white">
            Kitap ayarları
          </h2>
          <Button size="icon" variant="ghost" onClick={close} aria-label="Kapat">
            <X size={16} />
          </Button>
        </div>
        <div className="max-h-[80vh] overflow-auto">
          <BookSettingsView embedded />
        </div>
      </div>
    </div>,
    document.body,
  );
}
