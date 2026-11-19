/** Kitap geneli metin stilleri — bir stil değişince tüm kitap güncellenir. */

export type TextStyleId = "body" | "h1" | "h2" | "h3" | "quote" | "caption";

export interface TextStyleDef {
  id: TextStyleId;
  label: string;
  fontFamily: string;
  fontSizePx: number;
  lineHeight: number;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  color: string;
  marginTopPx: number;
  marginBottomPx: number;
  align?: "left" | "center" | "right" | "justify";
}

export const TEXT_STYLE_IDS: TextStyleId[] = ["body", "h1", "h2", "h3", "quote", "caption"];

export const DEFAULT_TEXT_STYLES: Record<TextStyleId, TextStyleDef> = {
  body: {
    id: "body",
    label: "Gövde",
    fontFamily: "Segoe UI",
    fontSizePx: 15,
    lineHeight: 1.35,
    fontWeight: 400,
    fontStyle: "normal",
    color: "#152033",
    marginTopPx: 0,
    marginBottomPx: 10,
    align: "justify",
  },
  h1: {
    id: "h1",
    label: "Başlık 1",
    fontFamily: "Segoe UI",
    fontSizePx: 28,
    lineHeight: 1.2,
    fontWeight: 700,
    fontStyle: "normal",
    color: "#152033",
    marginTopPx: 18,
    marginBottomPx: 10,
    align: "left",
  },
  h2: {
    id: "h2",
    label: "Başlık 2",
    fontFamily: "Segoe UI",
    fontSizePx: 22,
    lineHeight: 1.25,
    fontWeight: 700,
    fontStyle: "normal",
    color: "#152033",
    marginTopPx: 14,
    marginBottomPx: 8,
    align: "left",
  },
  h3: {
    id: "h3",
    label: "Başlık 3",
    fontFamily: "Segoe UI",
    fontSizePx: 18,
    lineHeight: 1.3,
    fontWeight: 700,
    fontStyle: "normal",
    color: "#152033",
    marginTopPx: 12,
    marginBottomPx: 6,
    align: "left",
  },
  quote: {
    id: "quote",
    label: "Alıntı",
    fontFamily: "Georgia",
    fontSizePx: 15,
    lineHeight: 1.4,
    fontWeight: 400,
    fontStyle: "italic",
    color: "#3b4558",
    marginTopPx: 12,
    marginBottomPx: 12,
    align: "left",
  },
  caption: {
    id: "caption",
    label: "Alt yazı",
    fontFamily: "Segoe UI",
    fontSizePx: 11,
    lineHeight: 1.3,
    fontWeight: 400,
    fontStyle: "normal",
    color: "#6b6478",
    marginTopPx: 4,
    marginBottomPx: 8,
    align: "center",
  },
};

export type CoverThemeId = "classic" | "dark" | "paper" | "bold";

export const COVER_THEMES: { id: CoverThemeId; label: string }[] = [
  { id: "classic", label: "Klasik" },
  { id: "dark", label: "Koyu" },
  { id: "paper", label: "Kâğıt" },
  { id: "bold", label: "Vurgu" },
];

export interface BookExtras {
  textStyles: Record<TextStyleId, TextStyleDef>;
  coverTheme: CoverThemeId;
  bleedMm: number;
  frontMatterLocked: boolean;
}

export function defaultBookExtras(): BookExtras {
  return {
    textStyles: structuredClone(DEFAULT_TEXT_STYLES),
    coverTheme: "classic",
    bleedMm: 3,
    frontMatterLocked: true,
  };
}

export function mergeBookExtras(raw: unknown): BookExtras {
  const base = defaultBookExtras();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  const styles = (obj.textStyles ?? obj) as Record<string, Partial<TextStyleDef>>;
  for (const id of TEXT_STYLE_IDS) {
    const patch = styles[id];
    if (patch && typeof patch === "object") {
      base.textStyles[id] = { ...base.textStyles[id], ...patch, id, label: base.textStyles[id].label };
    }
  }
  if (typeof obj.coverTheme === "string" && COVER_THEMES.some((t) => t.id === obj.coverTheme)) {
    base.coverTheme = obj.coverTheme as CoverThemeId;
  }
  if (typeof obj.bleedMm === "number") base.bleedMm = Math.min(10, Math.max(0, obj.bleedMm));
  if (typeof obj.frontMatterLocked === "boolean") base.frontMatterLocked = obj.frontMatterLocked;
  return base;
}

/** Word stil adları → kitap stili */
export function mapWordStyleToTextStyle(styleId?: string | null, styleName?: string | null): TextStyleId | null {
  for (const source of [styleId, styleName]) {
    if (!source) continue;
    const s = source.toLowerCase();
    if (/heading\s*1|başlık\s*1|baslik\s*1|title/.test(s)) return "h1";
    if (/heading\s*2|başlık\s*2|baslik\s*2|subtitle/.test(s)) return "h2";
    if (/heading\s*3|başlık\s*3|baslik\s*3/.test(s)) return "h3";
    if (/quote|alıntı|alinti|citation/.test(s)) return "quote";
    if (/caption|alt\s*yazı|altyazı|figcaption/.test(s)) return "caption";
    if (/normal|body|gövde|govde/.test(s)) return "body";
  }
  return null;
}

export function textStylesToCss(styles: Record<TextStyleId, TextStyleDef>): string {
  const rules: string[] = [];
  for (const id of TEXT_STYLE_IDS) {
    const s = styles[id];
    const sel =
      id === "body"
        ? '.book-page [data-block-kind="paragraph"], .book-page [data-text-style="body"]'
        : id === "h1"
          ? '.book-page [data-heading-size="1"], .book-page [data-text-style="h1"]'
          : id === "h2"
            ? '.book-page [data-heading-size="2"], .book-page [data-text-style="h2"]'
            : id === "h3"
              ? '.book-page [data-heading-size="3"], .book-page [data-text-style="h3"]'
              : id === "quote"
                ? '.book-page [data-block-kind="quote"], .book-page blockquote, .book-page [data-text-style="quote"]'
                : '.book-page .media-cap, .book-page [data-text-style="caption"]';
    rules.push(
      `${sel}{font-family:${cssFont(s.fontFamily)};font-size:${s.fontSizePx}px;line-height:${s.lineHeight};font-weight:${s.fontWeight};font-style:${s.fontStyle};color:${s.color};margin-top:${s.marginTopPx}px;margin-bottom:${s.marginBottomPx}px${s.align ? `;text-align:${s.align}` : ""}}`,
    );
  }
  return rules.join("\n");
}

function cssFont(name: string): string {
  const cleaned = name.replace(/['";]/g, "").trim() || "sans-serif";
  return /\s/.test(cleaned) ? `"${cleaned}",sans-serif` : `${cleaned},sans-serif`;
}

export function toRoman(n: number): string {
  if (n <= 0) return String(n);
  const map: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = Math.floor(n);
  let out = "";
  for (const [value, glyph] of map) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out.toLowerCase();
}
