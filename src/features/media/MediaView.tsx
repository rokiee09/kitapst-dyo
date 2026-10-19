import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { assetService } from "@/services/assets";
import { pickLocalFile } from "@/utils/filePicker";
import type { Asset } from "@/types/domain";

export function MediaView() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      try {
        const rows = await assetService.list();
        if (!cancelled) setAssets(rows);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Medya listesi alınamadı.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function importKind(kind: "image" | "video" | "file") {
    try {
      const path = await pickLocalFile(kind);
      if (!path) return;
      const created = await assetService.import(path, kind);
      setAssets((current) => [created, ...current]);
      toast.success(kind === "image" ? "Görsel eklendi." : kind === "video" ? "Video eklendi." : "Dosya eklendi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dosya içe aktarılamadı.");
    }
  }

  async function remove(asset: Asset) {
    if (!window.confirm(`${asset.filename} silinsin mi?`)) return;
    try {
      await assetService.remove(asset.id);
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      toast.success("Medya silindi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Medya silinemedi.");
    }
  }

  return (
    <div className="h-full overflow-auto bg-[#0d1524] p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Medya</h1>
          <p className="mt-1 text-sm text-[#8aa0bd]">
            Dosyalar proje klasörüne kopyalanır; veritabanında göreli yol saklanır.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void importKind("image")}>
            Görsel ekle
          </Button>
          <Button variant="secondary" onClick={() => void importKind("video")}>
            Video ekle
          </Button>
          <Button variant="secondary" onClick={() => void importKind("file")}>
            Dosya ekle
          </Button>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-[#8aa0bd]">Yükleniyor…</p>
      ) : assets.length === 0 ? (
        <p className="text-sm text-[#8aa0bd]">Henüz medya yok. Bir görsel, video veya dosya ekleyin.</p>
      ) : (
        <div className="grid max-w-5xl grid-cols-2 gap-3">
          {assets.map((asset) => (
            <MediaCard key={asset.id} asset={asset} onRemove={() => void remove(asset)} />
          ))}
        </div>
      )}
    </div>
  );
}

function MediaCard({ asset, onRemove }: { asset: Asset; onRemove: () => void }) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      try {
        if (asset.type === "image") {
          const url = await assetService.readDataUrl(asset.relativePath);
          if (!cancelled) setThumb(url);
          return;
        }
        if (asset.type === "video") {
          const abs = await assetService.resolvePath(asset.relativePath);
          if (!cancelled) setThumb(convertFileSrc(abs));
        }
      } catch {
        if (!cancelled) setThumb(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [asset.relativePath, asset.type]);

  return (
    <div className="overflow-hidden rounded-lg border border-[#1c2a44] bg-[#070b14]">
      <div className="flex h-36 items-center justify-center bg-[#102038]">
        {asset.type === "image" && thumb ? (
          <img src={thumb} alt={asset.filename} className="h-full w-full object-cover" />
        ) : asset.type === "video" && thumb ? (
          <video src={thumb} className="h-full w-full object-cover" muted />
        ) : (
          <span className="px-3 text-center text-xs text-[#8aa0bd]">{asset.filename}</span>
        )}
      </div>
      <div className="p-4">
        <div className="text-xs uppercase tracking-wide text-[#8aa0bd]">{asset.type}</div>
        <div className="mt-1 font-medium">{asset.filename}</div>
        <div className="mt-1 break-all text-[11px] text-[#8aa0bd]">{asset.relativePath}</div>
        <div className="mt-2 text-xs text-[#8aa0bd]">
          {asset.mimeType} · {Math.max(1, Math.round(asset.size / 1024))} KB
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => void assetService.open(asset.relativePath)}>
            Aç
          </Button>
          <Button size="sm" variant="danger" onClick={onRemove}>
            Sil
          </Button>
        </div>
      </div>
    </div>
  );
}
