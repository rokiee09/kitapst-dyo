import { useEffect, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readImageData } from "@/features/blocks/blockData";
import { assetService } from "@/services/assets";
import { stylePresetService } from "@/services";
import { pickLocalFile } from "@/utils/filePicker";
import { useEditorStore } from "@/stores/editorStore";
import { cn } from "@/lib/utils";
import type { ContentBlock } from "@/types/domain";

export function CompactSelectedBlock() {
  const block = useEditorStore((state) =>
    state.blocks.find((item) => item.id === state.selectedBlockId),
  );

  if (!block) {
    return <p className="px-3 py-2 text-[11px] text-[#8aa0b8]">Özellikleri görmek için bir blok seçin.</p>;
  }

  if (block.type === "image") return <ImageCompact block={block} />;
  return <GenericCompact block={block} />;
}

function ImageCompact({ block }: { block: ContentBlock }) {
  const data = readImageData(block.data);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!data.relativePath) {
        await Promise.resolve();
        if (!cancelled) setSrc(null);
        return;
      }
      try {
        const url = await assetService.readDataUrl(data.relativePath);
        if (!cancelled) setSrc(url);
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data.relativePath]);

  function patch(next: Record<string, unknown>) {
    useEditorStore.getState().updateBlockLocal(block.id, { data: { ...data, ...next } });
    useEditorStore.getState().scheduleSave(block.id);
  }

  async function changeImage() {
    try {
      const path = await pickLocalFile("image");
      if (!path) return;
      const asset = await assetService.import(path, "image");
      patch({ assetId: asset.id, relativePath: asset.relativePath });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Görsel eklenemedi.");
    }
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-[#102038]">
          {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] text-[#8aa0b8]">Yok</span>}
        </div>
        <Button size="sm" onClick={() => void changeImage()}>
          Görseli Değiştir
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => patch({ assetId: null, relativePath: null })}
        >
          Kaldır
        </Button>
      </div>
      <Field label="Alternatif Metin" value={data.alt} onChange={(alt) => patch({ alt })} />
      <div>
        <Label>Genişlik (%{data.width})</Label>
        <input
          type="range"
          min={8}
          max={100}
          value={data.width}
          onChange={(event) => patch({ width: Number(event.target.value) })}
          className="mt-1 w-full accent-blue-600"
        />
        <div className="mt-1 flex justify-between text-[10px] text-[#8aa0bd]">
          <span>Küçük</span>
          <span>Sayfa genişliği</span>
        </div>
      </div>
      <div>
        <Label>Hizalama</Label>
        <div className="mt-1 flex gap-1">
          {(
            [
              ["left", AlignLeft],
              ["center", AlignCenter],
              ["right", AlignRight],
            ] as const
          ).map(([value, Icon]) => (
            <button
              key={value}
              type="button"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded border border-[#1c314c] text-[#9fb3c9]",
                data.align === value && "border-blue-500 bg-blue-600/20 text-white",
              )}
              onClick={() => patch({ align: value })}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>
      <Field
        label="Resim notu"
        value={data.caption}
        onChange={(caption) => patch({ caption, captionCustom: false, captionVisible: true })}
      />
      <Button
        size="sm"
        variant="secondary"
        className="w-full"
        onClick={() => void saveStylePreset(block)}
      >
        Stil Şablonu Olarak Kaydet
      </Button>
    </div>
  );
}

function GenericCompact({ block }: { block: ContentBlock }) {
  const data = (block.data ?? {}) as Record<string, unknown>;
  const title = typeof data.title === "string" ? data.title : "";
  return (
    <div className="space-y-2 p-3">
      <div className="text-xs text-[#8aa0b8]">Tür: {block.type}</div>
      {typeof data.title === "string" ? (
        <Field
          label="Başlık"
          value={title}
          onChange={(next) => {
            useEditorStore.getState().updateBlockLocal(block.id, { data: { ...data, title: next } });
            useEditorStore.getState().scheduleSave(block.id);
          }}
        />
      ) : (
        <p className="text-[11px] text-[#8aa0b8]">Ayrıntılı alanlar Özellikler sekmesinde.</p>
      )}
      <Button size="sm" variant="secondary" className="w-full" onClick={() => void saveStylePreset(block)}>
        Stil Şablonu Olarak Kaydet
      </Button>
    </div>
  );
}

async function saveStylePreset(block: ContentBlock) {
  const name = window.prompt("Stil şablonu adı", `${block.type} stili`);
  if (!name?.trim()) return;
  try {
    await stylePresetService.save({
      name: name.trim(),
      blockType: block.type,
      style: block.style ?? {},
    });
    toast.success("Stil şablonu kaydedildi.");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Stil şablonu kaydedilemedi.");
  }
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input className="mt-1" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
