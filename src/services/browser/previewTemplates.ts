import type { ChapterTemplate } from "@/types/domain";

const NOW = "";

function layout(id: string, name: string, description: string, payload: unknown): ChapterTemplate {
  return {
    id,
    projectId: "builtin",
    name,
    description,
    payload,
    createdAt: NOW,
    builtin: true,
  };
}

function headingAligned(level: number, text: string, align: "left" | "center" | "right") {
  return {
    type: "heading",
    style: { align },
    data: {
      level,
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level, textAlign: align },
            content: [{ type: "text", text }],
          },
        ],
      },
    },
  };
}

function paragraphAligned(align: "left" | "center" | "right" | "justify", text: string) {
  return {
    type: "paragraph",
    style: { align },
    data: {
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            attrs: { textAlign: align },
            content: [{ type: "text", text }],
          },
        ],
      },
    },
  };
}

function imageBlock(width: number, align: "left" | "center" | "right", caption: string) {
  return {
    type: "image",
    data: {
      assetId: null,
      relativePath: null,
      alt: caption,
      caption,
      captionCustom: false,
      captionVisible: true,
      description: "",
      width,
      align,
      borderRadius: 12,
      showInEpub: true,
      showInPdf: true,
      showInHtml: true,
    },
  };
}

function videoTile(align: "left" | "right", width: number) {
  return {
    type: "video",
    style: { align },
    data: {
      sourceType: "local",
      assetId: null,
      relativePath: null,
      title: "Video",
      caption: "",
      captionCustom: false,
      captionVisible: true,
      description: "",
      url: "",
      thumbnailAssetId: null,
      thumbnailPath: null,
      duration: "",
      generateQr: false,
      showInEpub: true,
      showInPdf: true,
      showInHtml: true,
      previewAsPdf: false,
      tile: true,
      width,
      align,
      fit: "cover",
    },
  };
}

export function builtinTemplates(): ChapterTemplate[] {
  return [
    layout("builtin-kapak", "Kapak", "Kapak sayfası: görsel, kitap adı ve yazar. Bölümler panelinden ekleyin.", [
      imageBlock(100, "center", "Kapak görseli"),
      headingAligned(1, "Kitap veya bölüm başlığı", "center"),
      paragraphAligned("center", "Alt başlık veya kısa tanıtım"),
      paragraphAligned("center", "Yazar adı"),
    ]),
    layout("builtin-onsoz", "Önsöz", "Önsöz sayfası. Bölümler panelinden sayfa olarak ekleyin.", [
      headingAligned(1, "Önsöz", "center"),
      paragraphAligned("justify", "Önsöz metnini buraya yazın."),
      paragraphAligned("right", "Tarih / yer"),
    ]),
    layout("builtin-icindekiler", "İçindekiler", "İçindekiler sayfası. Bölümler panelinden ekleyin, maddeleri düzenleyin.", [
      headingAligned(1, "İçindekiler", "center"),
      { type: "orderedList" },
    ]),
    layout("builtin-giris", "Giriş", "Giriş sayfası: özet kutu ve ilk paragraf. Bölümler panelinden ekleyin.", [
      headingAligned(1, "Giriş", "left"),
      { type: "infoBox" },
      paragraphAligned("justify", "Giriş metnini buraya yazın."),
    ]),
    layout("builtin-gorsel-ust", "Görsel üstte", "Üstte geniş görsel, altında metin", [
      imageBlock(100, "center", "Üst görsel"),
      headingAligned(2, "Konu başlığı", "left"),
      { type: "paragraph" },
    ]),
    layout("builtin-gorsel-orta", "Görsel ortada", "Metin, ortalanmış görsel, devam metni", [
      headingAligned(2, "Konu başlığı", "left"),
      { type: "paragraph" },
      imageBlock(70, "center", "Orta görsel"),
      { type: "paragraph" },
    ]),
    layout("builtin-gorsel-sol", "Dar görsel solda", "Sayfanın soluna hizalı görsel, ardından açıklama", [
      headingAligned(2, "Konu başlığı", "left"),
      imageBlock(48, "left", "Sol hizalı görsel"),
      { type: "paragraph" },
    ]),
    layout("builtin-gorsel-sag", "Dar görsel sağda", "Sayfanın sağına hizalı görsel, ardından açıklama", [
      headingAligned(2, "Konu başlığı", "left"),
      imageBlock(48, "right", "Sağ hizalı görsel"),
      { type: "paragraph" },
    ]),
    layout("builtin-cift-gorsel", "İki görsel", "Karşılıklı iki görsel ve kısa metin", [
      headingAligned(2, "Karşılaştırma", "left"),
      imageBlock(100, "center", "Birinci görsel"),
      imageBlock(100, "center", "İkinci görsel"),
      { type: "paragraph" },
    ]),
    layout("builtin-ders", "Eğitim ünitesi", "Başlık, metin, bilgi kutusu ve adım listesi", [
      headingAligned(2, "Ünite başlığı", "left"),
      { type: "paragraph" },
      { type: "infoBox" },
      { type: "orderedList" },
    ]),
    layout("builtin-adimlar-gorsel", "Adımlar + görsel", "Görsel destekli adım adım anlatım", [
      headingAligned(2, "Uygulama adımları", "left"),
      imageBlock(100, "center", "Adımları gösteren görsel"),
      { type: "orderedList" },
    ]),
    layout("builtin-medya", "Medya sayfası", "Görsel, video ve QR bloğu", [
      headingAligned(2, "İzle ve uygula", "left"),
      { type: "image" },
      { type: "video" },
      { type: "qr" },
    ]),
    layout("builtin-alinti-gorsel", "Alıntı + görsel", "Alıntı, görsel ve açıklama", [
      { type: "quote" },
      imageBlock(80, "center", "Destekleyici görsel"),
      { type: "paragraph" },
    ]),
    layout("builtin-metin-sol", "Metin sola yaslı", "Başlık ve gövde soldan hizalı", [
      headingAligned(2, "Sol hizalı başlık", "left"),
      paragraphAligned("left", "Paragraf sola yaslanır."),
    ]),
    layout("builtin-metin-orta", "Metin ortalı", "Başlık ve gövde sayfa ortasında", [
      headingAligned(2, "Ortalanmış başlık", "center"),
      paragraphAligned("center", "Paragraf ortalanır."),
    ]),
    layout("builtin-metin-sag", "Metin sağa yaslı", "Başlık ve gövde sağdan hizalı", [
      headingAligned(2, "Sağ hizalı başlık", "right"),
      paragraphAligned("right", "Paragraf sağa yaslanır."),
    ]),
    layout("builtin-metin-iki-yana", "Metin iki yana yaslı", "Kitap sayfası gibi iki yana hizalı gövde", [
      headingAligned(2, "İki yana yaslı metin", "left"),
      paragraphAligned("justify", "Paragraf satır boyunca iki yana yaslanır."),
    ]),
    layout("builtin-video-dose", "Video döşeme", "Videoyu sayfaya döşeyip sola veya sağa hizalayın", [
      headingAligned(2, "Video", "left"),
      videoTile("left", 48),
      { type: "paragraph" },
    ]),
    layout("builtin-uyari", "Uyarı sayfası", "Uyarı kutusu, görsel ve madde listesi", [
      { type: "warningBox" },
      imageBlock(70, "center", "Uyarı görseli"),
      { type: "paragraph" },
      { type: "unorderedList" },
    ]),
  ];
}

export function defaultBlockData(blockType: string): unknown {
  const paragraph = { type: "doc", content: [{ type: "paragraph" }] };
  switch (blockType) {
    case "heading":
      return {
        content: {
          type: "doc",
          content: [{ type: "heading", attrs: { level: 2 } }],
        },
      };
    case "infoBox":
      return { icon: "info", title: "ÖNEMLİ", content: paragraph, variant: "info", padding: "md" };
    case "warningBox":
      return { icon: "warning", title: "UYARI", content: paragraph, variant: "warning", padding: "md" };
    case "quote":
      return {
        content: {
          type: "doc",
          content: [{ type: "blockquote", content: [{ type: "paragraph" }] }],
        },
        attribution: "",
      };
    case "orderedList":
      return {
        content: {
          type: "doc",
          content: [
            {
              type: "orderedList",
              content: [listItem("Birinci madde"), listItem("İkinci madde")],
            },
          ],
        },
      };
    case "unorderedList":
      return {
        content: {
          type: "doc",
          content: [
            {
              type: "bulletList",
              content: [listItem("Birinci madde"), listItem("İkinci madde")],
            },
          ],
        },
      };
    case "divider":
      return { style: "solid" };
    case "pageBreak":
      return {};
    case "image":
      return {
        assetId: null,
        relativePath: null,
        alt: "",
        caption: "",
        captionCustom: false,
        captionVisible: true,
        description: "",
        width: 100,
        align: "center",
        borderRadius: 8,
        showInEpub: true,
        showInPdf: true,
        showInHtml: true,
      };
    case "video":
      return {
        sourceType: "external",
        assetId: null,
        relativePath: null,
        title: "",
        caption: "",
        captionCustom: false,
        captionVisible: true,
        description: "",
        url: "",
        thumbnailAssetId: null,
        thumbnailPath: null,
        duration: "",
        generateQr: false,
        showInEpub: true,
        showInPdf: true,
        showInHtml: true,
        previewAsPdf: false,
      };
    case "qr":
      return {
        target: "video",
        mode: "url",
        value: "",
        chapterId: null,
        title: "",
        caption: "",
        captionCustom: false,
        captionVisible: true,
        description: "",
        size: 160,
        errorCorrection: "M",
        margin: 4,
      };
    case "file":
      return { assetId: null, relativePath: null, filename: "" };
    case "table":
      return { rows: [["", "", ""], ["", "", ""], ["", "", ""]] };
    case "code":
      return { language: "text", code: "" };
    default:
      return { content: paragraph };
  }
}

function listItem(text: string) {
  return {
    type: "listItem",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

export function allowedBlockType(blockType: string): boolean {
  return [
    "heading",
    "paragraph",
    "image",
    "video",
    "qr",
    "infoBox",
    "warningBox",
    "quote",
    "orderedList",
    "unorderedList",
    "table",
    "divider",
    "file",
    "pageBreak",
    "code",
  ].includes(blockType);
}
