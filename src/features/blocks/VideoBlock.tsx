import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { convertFileSrc } from "@tauri-apps/api/core";
import { assetService } from "@/services/assets";
import { pickLocalFile } from "@/utils/filePicker";
import { insertQrBlock } from "@/features/blocks/insertQr";
import { MediaCaption } from "@/features/blocks/MediaCaption";
import { readVideoData } from "@/features/blocks/blockData";
import { useEditorStore } from "@/stores/editorStore";
import { isSafeExternalUrl } from "@/utils/security";
import { vimeoEmbedUrl, vimeoVideoId, youtubeEmbedUrl, youtubeVideoId } from "@/utils/videoUrls";
import type { ContentBlock } from "@/types/domain";

export function VideoBlock({ block, editable }: { block: ContentBlock; editable: boolean }) {
  const data = readVideoData(block.data);
  const [localSrc, setLocalSrc] = useState<string | null>(null);
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);
  const hasLocal = Boolean(data.relativePath);
  const hasUrl = Boolean(data.url.trim());
  const urlOk = hasUrl && isSafeExternalUrl(data.url);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!data.relativePath) {
        await Promise.resolve();
        if (!cancelled) setLocalSrc(null);
        return;
      }
      try {
        const abs = await assetService.resolvePath(data.relativePath);
        if (!cancelled) setLocalSrc(convertFileSrc(abs));
      } catch (error) {
        console.error("[kitap-studiosu] video", error);
        if (!cancelled) setLocalSrc(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data.relativePath]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!data.thumbnailPath) {
        await Promise.resolve();
        if (!cancelled) setThumbSrc(null);
        return;
      }
      try {
        const url = await assetService.readDataUrl(data.thumbnailPath);
        if (!cancelled) setThumbSrc(url);
      } catch {
        if (!cancelled) setThumbSrc(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data.thumbnailPath]);

  function patch(next: Record<string, unknown>) {
    useEditorStore.getState().updateBlockLocal(block.id, { data: { ...data, ...next } });
    useEditorStore.getState().scheduleSave(block.id);
  }

  async function chooseVideo() {
    try {
      const path = await pickLocalFile("video");
      if (!path) return;
      const asset = await assetService.import(path, "video");
      patch({
        sourceType: data.url.trim() ? data.sourceType : "local",
        assetId: asset.id,
        relativePath: asset.relativePath,
        title: data.title || asset.filename,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Video eklenemedi.");
    }
  }

  async function chooseThumb() {
    try {
      const path = await pickLocalFile("image");
      if (!path) return;
      const asset = await assetService.import(path, "image");
      patch({ thumbnailAssetId: asset.id, thumbnailPath: asset.relativePath });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Küçük resim eklenemedi.");
    }
  }

  const youtubeId = urlOk ? youtubeVideoId(data.url) : null;
  const vimeoId = urlOk ? vimeoVideoId(data.url) : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1.4fr_1fr] gap-3 rounded-xl border border-[#dbe4ef] bg-[#f8fafc] p-3">
        <div className="min-w-0 overflow-hidden rounded-lg bg-slate-900">
          {data.previewAsPdf ? (
            thumbSrc ? (
              <img src={thumbSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-32 items-center justify-center text-xs text-slate-300">Küçük resim yok</div>
            )
          ) : (
            <VideoPlayer
              localSrc={localSrc}
              youtubeId={youtubeId}
              vimeoId={vimeoId}
              url={data.url}
              urlOk={urlOk}
            />
          )}
        </div>
        <div className="min-w-0 py-1">
          <div className="text-sm font-semibold text-[#152033]">{data.title || "Eğitim Videosu"}</div>
          {data.description ? <p className="mt-1 text-xs text-[#5b6578]">{data.description}</p> : null}
          {data.duration ? <div className="mt-3 text-xs text-[#5b6578]">Süre: {data.duration}</div> : null}
          <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-[#5b6578]">
            {hasLocal ? <span className="rounded bg-white px-1.5 py-0.5">Yerel dosya</span> : null}
            {urlOk ? <span className="rounded bg-white px-1.5 py-0.5">Bağlantı</span> : null}
          </div>
        </div>
      </div>
      <MediaCaption
        blockId={block.id}
        kind="video"
        note={data.caption}
        custom={data.captionCustom}
        visible={data.captionVisible}
        editable={editable}
        onChange={(next) => patch(next)}
      />
      {editable ? (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-[#dbe4ef] bg-white p-2">
              <div className="mb-1 text-[11px] font-medium text-[#152033]">Yerel video</div>
              <p className="mb-2 text-[10px] text-[#5b6578]">Editörde oynar; kitap klasörüne kopyalanır.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="paper" onClick={() => void chooseVideo()}>
                  {hasLocal ? "Dosyayı değiştir" : "Dosya seç"}
                </Button>
                {hasLocal ? (
                  <Button
                    size="sm"
                    variant="paper"
                    onClick={() => patch({ assetId: null, relativePath: null, sourceType: hasUrl ? "external" : "local" })}
                  >
                    Kaldır
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="rounded-lg border border-[#dbe4ef] bg-white p-2">
              <div className="mb-1 text-[11px] font-medium text-[#152033]">İnternet bağlantısı</div>
              <p className="mb-2 text-[10px] text-[#5b6578]">YouTube, Vimeo veya https adresi.</p>
              <input
                className="h-8 w-full rounded-md border border-[#dbe4ef] bg-white px-2 text-sm outline-none focus:border-blue-400"
                placeholder="https://..."
                value={data.url}
                onChange={(event) =>
                  patch({
                    url: event.target.value,
                    sourceType: data.relativePath ? "local" : "external",
                  })
                }
              />
              {hasUrl && !urlOk ? (
                <p className="mt-1 text-[10px] text-red-600">Yalnızca http/https kabul edilir.</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="paper"
              onClick={() => {
                if (!urlOk) {
                  toast.error("QR için önce bir https video bağlantısı yazın.");
                  return;
                }
                void insertQrBlock({
                  afterBlockId: block.id,
                  target: "video",
                  value: data.url.trim(),
                  title: data.title || "Video",
                  description: "Videoya telefondan ulaş",
                });
              }}
            >
              QR olarak ekle
            </Button>
            <Button size="sm" variant="paper" onClick={() => void chooseThumb()}>
              Küçük resim seç
            </Button>
          </div>
          <p className="text-[10px] text-[#5b6578]">
            QR isteğe bağlıdır. Eklendiğinde ayrı bir QR bloğu oluşur; telefon videoya yönlenir.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function VideoPlayer({
  localSrc,
  youtubeId,
  vimeoId,
  url,
  urlOk,
}: {
  localSrc: string | null;
  youtubeId: string | null;
  vimeoId: string | null;
  url: string;
  urlOk: boolean;
}) {
  if (localSrc) {
    return <video src={localSrc} controls className="w-full rounded-md bg-black" />;
  }
  if (youtubeId) {
    return (
      <iframe
        title="YouTube videosu"
        src={youtubeEmbedUrl(youtubeId)}
        className="aspect-video w-full rounded-md border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  if (vimeoId) {
    return (
      <iframe
        title="Vimeo videosu"
        src={vimeoEmbedUrl(vimeoId)}
        className="aspect-video w-full rounded-md border-0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }
  if (urlOk) {
    return (
      <div className="rounded-md border border-dashed border-[#d6d0c4] bg-[#f6f1e6] p-4 text-sm text-[#5b6578]">
        Bağlantı kaydedildi. YouTube/Vimeo değilse editörde oynatıcı yok. Telefona yönlendirmek için QR olarak ekleyin.
      </div>
    );
  }
  if (url.trim()) {
    return (
      <div className="flex min-h-36 items-center justify-center rounded-md border border-dashed border-[#d6d0c4] bg-[#f6f1e6] text-sm text-[#5b6578]">
        Geçerli bir http/https adresi girin
      </div>
    );
  }
  return (
    <div className="flex min-h-36 items-center justify-center rounded-md border border-dashed border-[#d6d0c4] bg-[#f6f1e6] text-sm text-[#5b6578]">
      Yerel dosya veya bağlantı ekleyin
    </div>
  );
}
