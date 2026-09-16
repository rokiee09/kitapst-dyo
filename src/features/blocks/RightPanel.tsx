import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BlockPalette } from "@/features/blocks/BlockPalette";
import { BlockProperties } from "@/features/blocks/BlockProperties";
import { CompactSelectedBlock } from "@/features/blocks/CompactSelectedBlock";
import { BlockDesign } from "@/features/blocks/BlockDesign";
import { tr } from "@/i18n/tr";

export function RightPanel() {
  return (
    <Tabs defaultValue="blocks" className="flex h-full flex-col bg-[#0c1829]">
      <TabsList>
        <TabsTrigger value="blocks">{tr.panels.blocks}</TabsTrigger>
        <TabsTrigger value="properties">{tr.panels.properties}</TabsTrigger>
        <TabsTrigger value="design">{tr.panels.design}</TabsTrigger>
      </TabsList>
      <TabsContent value="blocks" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="app-scroll min-h-0 flex-1 overflow-auto">
          <BlockPalette />
        </div>
        <div className="max-h-[46%] shrink-0 overflow-auto border-t border-[#1c314c]">
          <h3 className="px-3 pt-3 text-[11px] font-semibold uppercase tracking-wide text-[#8aa0b8]">
            Seçili Bloğun Özellikleri
          </h3>
          <CompactSelectedBlock />
        </div>
      </TabsContent>
      <TabsContent value="properties" className="app-scroll">
        <BlockProperties />
      </TabsContent>
      <TabsContent value="design" className="app-scroll">
        <BlockDesign />
      </TabsContent>
    </Tabs>
  );
}
