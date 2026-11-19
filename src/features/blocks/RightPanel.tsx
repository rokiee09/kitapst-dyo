import { InsertBlockButton } from "@/features/blocks/InsertBlockButton";
import { BlockProperties } from "@/features/blocks/BlockProperties";
import { CompactSelectedBlock } from "@/features/blocks/CompactSelectedBlock";
import { BlockDesign } from "@/features/blocks/BlockDesign";
import { ProofreadPanel } from "@/features/proofread/ProofreadPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEditorStore } from "@/stores/editorStore";
import { useUiStore } from "@/stores/uiStore";

/** Seçili bloğa göre özellik / tasarım / denetim. Palet yerine + Ekle. */
export function RightPanel() {
  const rightTab = useUiStore((state) => state.rightTab);
  const setRightTab = useUiStore((state) => state.setRightTab);
  const selected = useEditorStore((state) =>
    state.blocks.find((block) => block.id === state.selectedBlockId),
  );

  return (
    <div className="flex h-full flex-col bg-[#0c1829]">
      <div className="flex items-center justify-between gap-2 border-b border-[#1c314c] px-3 py-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8aa0b8]">Özellikler</div>
          <div className="truncate text-xs text-[#d7e3f4]">
            {selected ? blockLabel(selected.type) : "Blok seçilmedi"}
          </div>
        </div>
        <InsertBlockButton afterBlockId={selected?.id ?? null} />
      </div>

      {rightTab === "proofread" ? (
        <div className="app-scroll min-h-0 flex-1 overflow-auto">
          <div className="flex items-center justify-between border-b border-[#1c314c] px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8aa0b8]">Denetim</span>
            <button
              type="button"
              className="text-[11px] text-[#8aa0b8] hover:text-white"
              onClick={() => setRightTab("properties")}
            >
              Kapat
            </button>
          </div>
          <ProofreadPanel />
        </div>
      ) : (
        <Tabs
          value={rightTab}
          onValueChange={(value) => setRightTab(value as typeof rightTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="px-2">
            <TabsTrigger value="properties">İçerik</TabsTrigger>
            <TabsTrigger value="design">Tasarım</TabsTrigger>
          </TabsList>
          <TabsContent value="properties" className="app-scroll min-h-0 flex-1 overflow-auto">
            {selected ? (
              <>
                <CompactSelectedBlock />
                <BlockProperties />
              </>
            ) : (
              <EmptyHint />
            )}
          </TabsContent>
          <TabsContent value="design" className="app-scroll min-h-0 flex-1 overflow-auto">
            {selected ? <BlockDesign /> : <EmptyHint />}
          </TabsContent>
        </Tabs>
      )}
      <p className="border-t border-[#1c314c] px-3 py-2 text-[10px] text-[#6b7f9a]">
        Blok eklemek için + Ekle veya editörde <kbd className="rounded bg-[#102038] px-1">/</kbd> yazın
      </p>
    </div>
  );
}

function EmptyHint() {
  return (
    <p className="p-4 text-sm text-[#8aa0b8]">
      Sayfada bir bloğa tıklayın. Özellikler burada görünür.
    </p>
  );
}

function blockLabel(type: string): string {
  const map: Record<string, string> = {
    heading: "Başlık",
    paragraph: "Metin",
    image: "Görsel",
    video: "Video",
    qr: "QR",
    table: "Tablo",
    quote: "Alıntı",
    infoBox: "Bilgi kutusu",
    warningBox: "Uyarı kutusu",
    orderedList: "Numaralı liste",
    unorderedList: "Madde listesi",
    code: "Kod",
    file: "Dosya",
    pageBreak: "Sayfa sonu",
    divider: "Çizgi",
  };
  return map[type] ?? type;
}
