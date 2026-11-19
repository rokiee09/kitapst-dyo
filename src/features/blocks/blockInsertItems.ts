import type { BlockType } from "@/types/domain";

export interface BlockInsertItem {
  type: BlockType;
  label: string;
  /** Slash komutları: /görsel */
  aliases: string[];
}

export const BLOCK_INSERT_ITEMS: BlockInsertItem[] = [
  { type: "heading", label: "Başlık", aliases: ["başlık", "baslik", "h1", "heading"] },
  { type: "paragraph", label: "Metin", aliases: ["metin", "paragraf", "text"] },
  { type: "image", label: "Görsel", aliases: ["görsel", "gorsel", "image", "resim"] },
  { type: "video", label: "Video", aliases: ["video"] },
  { type: "qr", label: "QR", aliases: ["qr"] },
  { type: "table", label: "Tablo", aliases: ["tablo", "table"] },
  { type: "quote", label: "Alıntı", aliases: ["alıntı", "alinti", "quote"] },
  { type: "infoBox", label: "Bilgi kutusu", aliases: ["bilgi", "info"] },
  { type: "warningBox", label: "Uyarı kutusu", aliases: ["uyarı", "uyari", "warning"] },
  { type: "orderedList", label: "Numaralı liste", aliases: ["liste", "ol", "numara"] },
  { type: "unorderedList", label: "Madde listesi", aliases: ["madde", "ul", "bullet"] },
  { type: "code", label: "Kod", aliases: ["kod", "code"] },
  { type: "file", label: "Dosya", aliases: ["dosya", "file"] },
  { type: "pageBreak", label: "Sayfa sonu", aliases: ["sayfa", "pagebreak"] },
  { type: "divider", label: "Çizgi", aliases: ["çizgi", "cizgi", "hr", "divider"] },
];

export function matchSlashItems(query: string): BlockInsertItem[] {
  const q = query.trim().toLocaleLowerCase("tr-TR");
  if (!q) return BLOCK_INSERT_ITEMS;
  return BLOCK_INSERT_ITEMS.filter(
    (item) =>
      item.label.toLocaleLowerCase("tr-TR").includes(q) ||
      item.aliases.some((alias) => alias.includes(q) || q.includes(alias)),
  );
}
