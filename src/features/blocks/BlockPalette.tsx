import {
  AlertTriangle,
  Code2,
  FileInput,
  FileText,
  Heading2,
  ImageIcon,
  Info,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  QrCode,
  Quote,
  SeparatorHorizontal,
  Table,
  Video,
} from "lucide-react";
import { tr } from "@/i18n/tr";
import { cn } from "@/lib/utils";
import { importWordIntoChapter } from "@/features/import/importWord";
import { useEditorStore } from "@/stores/editorStore";
import type { BlockType } from "@/types/domain";

const ITEMS: { type: BlockType; label: string; icon: typeof Pilcrow }[] = [
  { type: "heading", label: tr.blocks.heading, icon: Heading2 },
  { type: "paragraph", label: "Metin", icon: Pilcrow },
  { type: "image", label: tr.blocks.image, icon: ImageIcon },
  { type: "video", label: tr.blocks.video, icon: Video },
  { type: "qr", label: "QR yönlendirme", icon: QrCode },
  { type: "infoBox", label: "Bilgi Kutusu", icon: Info },
  { type: "warningBox", label: "Uyarı Kutusu", icon: AlertTriangle },
  { type: "table", label: tr.blocks.table, icon: Table },
  { type: "quote", label: tr.blocks.quote, icon: Quote },
  { type: "orderedList", label: tr.blocks.orderedList, icon: ListOrdered },
  { type: "unorderedList", label: tr.blocks.unorderedList, icon: List },
  { type: "code", label: "Kod Bloğu", icon: Code2 },
  { type: "file", label: tr.blocks.file, icon: FileText },
  { type: "pageBreak", label: "Sayfa Sonu", icon: SeparatorHorizontal },
  { type: "divider", label: "Yatay Çizgi", icon: Minus },
];

export function BlockPalette() {
  const addBlock = useEditorStore((state) => state.addBlock);

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#8aa0b8]">İçerik Blokları</h3>
      </div>
      <button
        type="button"
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-blue-500/40 bg-blue-600/15 px-2.5 py-2 text-[12px] text-blue-100 hover:bg-blue-600/25"
        onClick={() => void importWordIntoChapter()}
      >
        <FileInput size={15} />
        Word’den içe aktar
      </button>
      <div className="grid grid-cols-2 gap-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              type="button"
              className={cn(
                "flex items-center gap-2 rounded-lg border border-[#1c314c] bg-[#102038] px-2.5 py-2.5 text-left text-[12px] text-[#d7e3f4] hover:border-blue-500/60 hover:bg-[#163056]",
              )}
              onClick={() => {
                void addBlock(item.type);
              }}
            >
              <Icon size={15} className="shrink-0 text-blue-300" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
