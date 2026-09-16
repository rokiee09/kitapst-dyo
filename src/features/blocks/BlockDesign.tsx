import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BOX_PRESETS, canFloat, defaultFreeStyle, isFree, PAGE_FONTS } from "@/features/blocks/blockStyle";
import { stylePresetService } from "@/services";
import { useEditorStore } from "@/stores/editorStore";
import type { BlockStyle, StylePreset } from "@/types/domain";

export function BlockDesign() {
  const block = useEditorStore((state) =>
    state.blocks.find((item) => item.id === state.selectedBlockId),
  );
  const blockId = block?.id ?? null;
  const blockType = block?.type ?? null;
  const [presets, setPresets] = useState<StylePreset[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (!blockType) {
        if (!cancelled) setPresets([]);
        return;
      }
      try {
        const items = await stylePresetService.list(blockType);
        if (!cancelled) setPresets(items);
      } catch {
        if (!cancelled) setPresets([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blockId, blockType]);

  if (!block) {
    return <p className="p-3 text-xs text-[#8aa0bd]">Tasarım ayarları için bir blok seçin.</p>;
  }

  const selectedId = block.id;
  const style = block.style;

  function patchStyle(next: BlockStyle) {
    useEditorStore.getState().updateBlockLocal(selectedId, { style: next });
    useEditorStore.getState().scheduleSave(selectedId);
  }

  return (
    <div className="space-y-3 p-3">
      <div>
        <Label htmlFor="align">Hizalama</Label>
        <select
          id="align"
          className="mt-1 h-8 w-full rounded-md border border-[#1c2a44] bg-[#070b14] px-2 text-sm"
          value={style.align ?? "left"}
          onChange={(event) =>
            patchStyle({
              ...style,
              align: event.target.value as BlockStyle["align"],
            })
          }
        >
          <option value="left">Sol</option>
          <option value="center">Orta</option>
          <option value="right">Sağ</option>
          <option value="justify">İki yana</option>
        </select>
      </div>
      <div>
        <Label htmlFor="padding">İç boşluk</Label>
        <select
          id="padding"
          className="mt-1 h-8 w-full rounded-md border border-[#1c2a44] bg-[#070b14] px-2 text-sm"
          value={style.padding ?? "md"}
          onChange={(event) =>
            patchStyle({
              ...style,
              padding: event.target.value as BlockStyle["padding"],
            })
          }
        >
          <option value="sm">Dar</option>
          <option value="md">Orta</option>
          <option value="lg">Geniş</option>
        </select>
      </div>
      <div>
        <Label htmlFor="block-color">Yazı rengi</Label>
        <input
          id="block-color"
          type="color"
          className="mt-1 h-8 w-full cursor-pointer rounded border border-[#1c2a44] bg-[#070b14]"
          value={style.color || "#152033"}
          onChange={(event) => patchStyle({ ...style, color: event.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="block-bg">Kutu rengi</Label>
        <input
          id="block-bg"
          type="color"
          className="mt-1 h-8 w-full cursor-pointer rounded border border-[#1c2a44] bg-[#070b14]"
          value={style.background || "#ffffff"}
          onChange={(event) => patchStyle({ ...style, background: event.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="block-font">Yazı tipi</Label>
        <select
          id="block-font"
          className="mt-1 h-8 w-full rounded-md border border-[#1c2a44] bg-[#070b14] px-2 text-sm"
          value={style.fontFamily ?? ""}
          onChange={(event) => patchStyle({ ...style, fontFamily: event.target.value || undefined })}
        >
          <option value="">Sayfa varsayılanı</option>
          {PAGE_FONTS.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="block-size">Yazı boyutu</Label>
        <select
          id="block-size"
          className="mt-1 h-8 w-full rounded-md border border-[#1c2a44] bg-[#070b14] px-2 text-sm"
          value={style.fontSize ?? ""}
          onChange={(event) =>
            patchStyle({
              ...style,
              fontSize: event.target.value ? Number(event.target.value) : undefined,
            })
          }
        >
          <option value="">Varsayılan</option>
          <option value="14">14</option>
          <option value="16">16</option>
          <option value="18">18</option>
          <option value="22">22</option>
          <option value="28">28</option>
        </select>
      </div>
      {canFloat(block.type) ? (
        <div className="rounded-md border border-[#1c2a44] p-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-blue-600"
              checked={isFree(style)}
              onChange={(event) => {
                if (event.target.checked) {
                  const index = useEditorStore.getState().blocks.findIndex((item) => item.id === selectedId);
                  patchStyle({ ...style, ...defaultFreeStyle(block.type, Math.max(0, index)) });
                  return;
                }
                patchStyle({ ...style, placement: "flow", x: undefined, y: undefined, width: undefined });
              }}
            />
            Sayfada taşı (metin kutusu)
          </label>
          <p className="mt-1 text-[11px] text-[#8aa0bd]">
            Kutunun mavi çubuğundan sürükle. Sol / Orta / Sağ / Tam ile hizala. Kenarlardan boyutlandır. Alt+ok ile kaydır.
          </p>
          {isFree(style) ? (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-1">
                {BOX_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="rounded bg-[#102038] px-2 py-1 text-[10px] text-white"
                    onClick={() =>
                      patchStyle({
                        ...style,
                        placement: "free",
                        x: preset.x,
                        y: style.y ?? preset.y,
                        width: preset.width,
                      })
                    }
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <Label htmlFor="box-width">Kutu genişliği (%{style.width ?? 88})</Label>
              <input
                id="box-width"
                type="range"
                min={20}
                max={100}
                value={style.width ?? 88}
                onChange={(event) => patchStyle({ ...style, width: Number(event.target.value) })}
                className="mt-1 w-full"
              />
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="border-t border-[#1c2a44] pt-3">
        <Label>Stil şablonları</Label>
        {presets.length === 0 ? (
          <p className="mt-2 text-[11px] text-[#8aa0bd]">Bu blok türü için kayıtlı şablon yok.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {presets.map((preset) => (
              <div key={preset.id} className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => patchStyle({ ...style, ...(preset.style ?? {}) })}
                >
                  {preset.name}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    void stylePresetService
                      .remove(preset.id)
                      .then(() => setPresets((current) => current.filter((item) => item.id !== preset.id)))
                      .catch((error: unknown) =>
                        toast.error(error instanceof Error ? error.message : "Silinemedi."),
                      );
                  }}
                >
                  Sil
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
