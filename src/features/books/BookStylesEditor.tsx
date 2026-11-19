import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Book } from "@/types/domain";
import {
  COVER_THEMES,
  TEXT_STYLE_IDS,
  type CoverThemeId,
  type TextStyleDef,
  type TextStyleId,
  mergeBookExtras,
} from "@/book/textStyles";

export function BookStylesEditor({ book }: { book: Book }) {
  const updateBook = useWorkspaceStore((state) => state.updateBook);
  const extras = useMemo(
    () => mergeBookExtras(JSON.parse(book.bookExtrasJson || "{}")),
    [book.bookExtrasJson],
  );

  function saveExtras(next: ReturnType<typeof mergeBookExtras>) {
    void updateBook(
      {
        title: book.title,
        subtitle: book.subtitle,
        author: book.author,
        description: book.description,
        language: book.language,
        isbn: book.isbn,
        publisher: book.publisher,
        pageColor: book.pageColor,
        inkColor: book.inkColor,
        fontFamily: book.fontFamily,
        pageNumbers: book.pageNumbers,
        pageNumberAlign: book.pageNumberAlign,
        pageNumberStart: book.pageNumberStart,
        lineHeight: book.lineHeight,
        pageSizePreset: book.pageSizePreset,
        pageWidthMm: book.pageWidthMm,
        pageHeightMm: book.pageHeightMm,
        marginTopMm: book.marginTopMm,
        marginRightMm: book.marginRightMm,
        marginBottomMm: book.marginBottomMm,
        marginLeftMm: book.marginLeftMm,
        bookExtrasJson: JSON.stringify({
          textStyles: next.textStyles,
          coverTheme: next.coverTheme,
          bleedMm: next.bleedMm,
          frontMatterLocked: next.frontMatterLocked,
        }),
      },
      { silent: true },
    );
  }

  function patchStyle(id: TextStyleId, patch: Partial<TextStyleDef>) {
    const next = mergeBookExtras(JSON.parse(book.bookExtrasJson || "{}"));
    next.textStyles[id] = { ...next.textStyles[id], ...patch, id, label: next.textStyles[id].label };
    saveExtras(next);
  }

  function patchExtras(patch: Partial<Pick<typeof extras, "coverTheme" | "bleedMm" | "frontMatterLocked">>) {
    const next = mergeBookExtras(JSON.parse(book.bookExtrasJson || "{}"));
    if (patch.coverTheme != null) next.coverTheme = patch.coverTheme;
    if (patch.bleedMm != null) next.bleedMm = patch.bleedMm;
    if (patch.frontMatterLocked != null) next.frontMatterLocked = patch.frontMatterLocked;
    saveExtras(next);
  }

  return (
    <div className="rounded-md border border-[#1c2a44] p-3 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[#c5d4e8]">Kitap metin stilleri</h2>
        <p className="mt-1 text-[11px] text-[#8aa0bd]">
          Değişiklikler tüm sayfalara uygulanır; kaydetmeye gerek yoktur.
        </p>
      </div>
      {TEXT_STYLE_IDS.map((id) => (
        <StyleCard key={id} style={extras.textStyles[id]} onChange={(patch) => patchStyle(id, patch)} />
      ))}
      <div className="grid grid-cols-2 gap-3 border-t border-[#1c2a44] pt-3">
        <div>
          <Label>Kapak teması</Label>
          <select
            className="mt-1 h-8 w-full rounded-md border border-[#1c2a44] bg-[#070b14] px-2 text-sm"
            value={extras.coverTheme}
            onChange={(event) => patchExtras({ coverTheme: event.target.value as CoverThemeId })}
          >
            {COVER_THEMES.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Taşma payı (mm)</Label>
          <Input
            className="mt-1"
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={extras.bleedMm}
            onChange={(event) => patchExtras({ bleedMm: Number(event.target.value) || 0 })}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-blue-600"
          checked={extras.frontMatterLocked}
          onChange={(event) => patchExtras({ frontMatterLocked: event.target.checked })}
        />
        Ön bölümlerin sırası kilitli (Kapak, Önsöz, İçindekiler, Giriş)
      </label>
    </div>
  );
}

function StyleCard({
  style,
  onChange,
}: {
  style: TextStyleDef;
  onChange: (patch: Partial<TextStyleDef>) => void;
}) {
  return (
    <details className="rounded border border-[#243250] bg-[#0a101c] px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-[#b8c9de]">{style.label}</summary>
      <div className="mt-3 grid grid-cols-2 gap-3 pb-1">
        <div className="col-span-2">
          <Label>Yazı tipi</Label>
          <Input className="mt-1" value={style.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })} />
        </div>
        <div>
          <Label>Boyut (px)</Label>
          <Input
            className="mt-1"
            type="number"
            min={8}
            max={72}
            value={style.fontSizePx}
            onChange={(e) => onChange({ fontSizePx: Number(e.target.value) || 12 })}
          />
        </div>
        <div>
          <Label>Satır yüksekliği</Label>
          <Input
            className="mt-1"
            type="number"
            min={1}
            max={3}
            step={0.05}
            value={style.lineHeight}
            onChange={(e) => onChange({ lineHeight: Number(e.target.value) || 1.2 })}
          />
        </div>
        <div>
          <Label>Kalınlık</Label>
          <Input
            className="mt-1"
            type="number"
            min={100}
            max={900}
            step={100}
            value={style.fontWeight}
            onChange={(e) => onChange({ fontWeight: Number(e.target.value) || 400 })}
          />
        </div>
        <div>
          <Label>Stil</Label>
          <select
            className="mt-1 h-8 w-full rounded-md border border-[#1c2a44] bg-[#070b14] px-2 text-sm"
            value={style.fontStyle}
            onChange={(e) => onChange({ fontStyle: e.target.value as "normal" | "italic" })}
          >
            <option value="normal">Normal</option>
            <option value="italic">İtalik</option>
          </select>
        </div>
        <div>
          <Label>Renk</Label>
          <input
            type="color"
            className="mt-1 h-8 w-full cursor-pointer rounded border border-[#1c2a44] bg-[#070b14]"
            value={style.color}
            onChange={(e) => onChange({ color: e.target.value })}
          />
        </div>
        <div>
          <Label>Hizalama</Label>
          <select
            className="mt-1 h-8 w-full rounded-md border border-[#1c2a44] bg-[#070b14] px-2 text-sm"
            value={style.align ?? "left"}
            onChange={(e) => onChange({ align: e.target.value as TextStyleDef["align"] })}
          >
            <option value="left">Sol</option>
            <option value="center">Orta</option>
            <option value="right">Sağ</option>
            <option value="justify">İki yana</option>
          </select>
        </div>
        <div>
          <Label>Üst boşluk (px)</Label>
          <Input
            className="mt-1"
            type="number"
            min={0}
            max={120}
            value={style.marginTopPx}
            onChange={(e) => onChange({ marginTopPx: Number(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label>Alt boşluk (px)</Label>
          <Input
            className="mt-1"
            type="number"
            min={0}
            max={120}
            value={style.marginBottomPx}
            onChange={(e) => onChange({ marginBottomPx: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
    </details>
  );
}