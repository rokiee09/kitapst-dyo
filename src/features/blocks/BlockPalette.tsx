import { InsertBlockButton } from "@/features/blocks/InsertBlockButton";
import { BLOCK_INSERT_ITEMS } from "@/features/blocks/blockInsertItems";
import { useEditorStore } from "@/stores/editorStore";

/** Eski palet yerine kısa liste + Ekle (şablonlar vb. yerler için). */
export function BlockPalette() {
  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#8aa0b8]">Blok ekle</h3>
        <InsertBlockButton />
      </div>
      <p className="mb-3 text-[11px] text-[#6b7f9a]">Editörde /yazarak da ekleyebilirsiniz (/görsel, /tablo).</p>
      <div className="flex flex-wrap gap-1.5">
        {BLOCK_INSERT_ITEMS.slice(0, 8).map((item) => (
          <button
            key={item.type}
            type="button"
            className="rounded border border-[#1c314c] bg-[#102038] px-2 py-1 text-[11px] text-[#d7e3f4] hover:border-blue-500/60"
            onClick={() => void useEditorStore.getState().addBlock(item.type)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
