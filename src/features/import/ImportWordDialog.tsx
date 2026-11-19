import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";

export type WordImportMode = "adapt" | "reflow";

export function askWordImportMode(): Promise<WordImportMode | null> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    function finish(value: WordImportMode | null) {
      root.unmount();
      host.remove();
      resolve(value);
    }

    root.render(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4">
        <div
          className="w-full max-w-md rounded-xl border border-[#1c314c] bg-[#0c1829] p-5 text-white shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="word-import-title"
        >
          <h2 id="word-import-title" className="text-base font-semibold">
            Word içe aktarma
          </h2>
          <p className="mt-2 text-sm text-[#9fb3c9]">
            Biçim docx XML’den okunur. Sayfa boyutunu nasıl uygulayalım?
          </p>
          <div className="mt-4 space-y-2">
            <button
              type="button"
              className="w-full rounded-lg border border-[#1c314c] bg-[#102038] px-3 py-3 text-left hover:border-blue-500"
              onClick={() => finish("adapt")}
            >
              <div className="text-sm font-medium">Kitabın sayfa boyutunu Word’e uyarla</div>
              <div className="mt-1 text-[11px] text-[#8aa0b8]">
                Birebir görünüm — Word sayfa/kenar boşlukları kitaba yazılır.
              </div>
            </button>
            <button
              type="button"
              className="w-full rounded-lg border border-[#1c314c] bg-[#102038] px-3 py-3 text-left hover:border-blue-500"
              onClick={() => finish("reflow")}
            >
              <div className="text-sm font-medium">Kitap sayfasına yeniden akıt</div>
              <div className="mt-1 text-[11px] text-[#8aa0b8]">
                Mevcut kitap boyutu korunur; metin sayfalara bölünerek akar.
              </div>
            </button>
          </div>
          <div className="mt-4 flex justify-end">
            <Button size="sm" variant="secondary" onClick={() => finish(null)}>
              Vazgeç
            </Button>
          </div>
        </div>
      </div>,
    );
  });
}
