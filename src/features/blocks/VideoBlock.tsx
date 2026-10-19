import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { convertFileSrc } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/services/tauri/invoke";
import { assetService } from "@/services/assets";
import { pickLocalFile } from "@/utils/filePicker";
import { insertQrBlock } from "@/features/blocks/insertQr";
import { MediaCaption } from "@/features/blocks/MediaCaption";
import { readVideoData } from "@/features/blocks/blockData";
import { useEditorStore } from "@/stores/editorStore";
import { isSafeExternalUrl } from "@/utils/security";
import { vimeoEmbedUrl, vimeoVideoId, youtubeEmbedUrl, youtubeVideoId } from "@/utils/videoUrls";
import { cn } from "@/lib/utils";
import type { ContentBlock } from "@/types/domain";

export function VideoBlock({ block, editable }: { block: ContentBlock; editable: boolean }) {
  const data = readVideoData(block.data);
  const selected = useEditorStore((state) => state.selectedBlockId === block.id);
  const [localSrc, setLocalSrc] = useState<string | null>(null);
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
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
        if (!cancelled) setLocalSrc(isTauriRuntime() ? convertFileSrc(abs) : abs);
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

  function startResize(event: ReactPointerEvent<HTMLButtonElement>, edge: "e" | "se" | "w") {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
    const page = frameRef.current?.closest(".book-page");
    const pageWidth = page?.clientWidth ?? 720;
    const startX = event.clientX;
    const startWidth = data.width;
    const grow = data.align === "center" ? 2 : 1;
    setResizing(true);

    function onMove(moveEvent: PointerEvent) {
      const dx = moveEvent.clientX - startX;
      const signed = edge === "w" ? -dx : dx;
      const next = Math.min(100, Math.max(16, Math.round(startWidth + (signed / pageWidth) * 100 * grow)));
      useEditorStore.getState().updateBlockLocal(block.id, { data: { ...data, width: next } });
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setResizing(false);
      useEditorStore.getState().scheduleSave(block.id);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
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
        width: data.width || 100,
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
  const alignClass =
    data.align === "left" ? "mr-auto" : data.align === "right" ? "ml-auto" : "mx-auto";
  const floatClass =
    data.tile && data.align === "left"
      ? "float-left mr-3 mb-2"
      : data.tile && data.align === "right"
        ? "float-right ml-3 mb-2"
        : "";
  const hasMedia = Boolean(localSrc || youtubeId || vimeoId || urlOk);

  return (
    <div className={data.tile ? "min-h-[8rem]" : "space-y-3"}>
      <div
        ref={frameRef}
        className={cn(
          "relative overflow-hidden rounded-lg bg-slate-900",
          alignClass,
          floatClass,
          !data.tile && "border border-[#dbe4ef]",
        )}
        style={{ width: `${data.width}%` }}
      >
        <div className="min-w-0">
          {data.previewAsPdf ? (
            thumbSrc ? (
              <img src={thumbSrc} alt="" className="aspect-video h-auto w-full object-cover" />
            ) : (
              <div className="flex aspect-video items-center justify-center text-xs text-slate-300">Küçük resim yok</div>
            )
          ) : (
            <VideoPlayer
              localSrc={localSrc}
              youtubeId={youtubeId}
              vimeoId={vimeoId}
              url={data.url}
              urlOk={urlOk}
              fit={data.fit}
            />
          )}
        </div>
        {!data.tile && (data.title || data.description || data.duration) ? (
          <div className="border-t border-white/10 bg-[#f8fafc] px-3 py-2 text-[#152033]">
            <div className="text-sm font-semibold">{data.title || "Eğitim Videosu"}</div>
            {data.description ? <p className="mt-1 text-xs text-[#5b6578]">{data.description}</p> : null}
            {data.duration ? <div className="mt-1 text-xs text-[#5b6578]">Süre: {data.duration}</div> : null}
          </div>
        ) : null}
        {editable && selected && hasMedia ? (
          <>
            <button
              type="button"
              aria-label="Soldan boyutlandır"
              className="absolute top-1/2 left-0 z-10 h-8 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-sm border border-blue-500 bg-white shadow"
              onPointerDown={(event) => startResize(event, "w")}
            />
            <button
              type="button"
              aria-label="Sağdan boyutlandır"
              className="absolute top-1/2 right-0 z-10 h-8 w-3 -translate-y-1/2 translate-x-1/2 cursor-ew-resize rounded-sm border border-blue-500 bg-white shadow"
              onPointerDown={(event) => startResize(event, "e")}
            />
            <button
              type="button"
              aria-label="Köşeden boyutlandır"
              className="absolute right-0 bottom-0 z-10 h-3.5 w-3.5 translate-x-1/2 translate-y-1/2 cursor-nwse-resize rounded-sm border border-blue-500 bg-white shadow"
              onPointerDown={(event) => startResize(event, "se")}
            />
            <div className="pointer-events-none absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
              %{data.width}
              {resizing ? " · bırakınca kaydedilir" : ""}
            </div>
          </>
        ) : null}
      </div>
      {data.tile ? <div className="clear-both" /> : null}
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
          <div className="flex flex-wrap items-center gap-2">
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
            <label className="flex min-w-44 flex-1 items-center gap-2 text-[11px] text-[#5b6578]">
              Boyut
              <input
                type="range"
                min={16}
                max={100}
                value={data.width}
                onChange={(event) => patch({ width: Number(event.target.value) })}
                className="w-full accent-blue-600"
              />
              <span className="w-8 tabular-nums">%{data.width}</span>
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-[11px] text-[#5b6578]">
              Hizalama
              <select
                className="mt-1 h-8 w-full rounded-md border border-[#dbe4ef] bg-white px-2 text-sm text-[#152033]"
                value={data.align}
                onChange={(event) => patch({ align: event.target.value })}
              >
                <option value="left">Sola</option>
                <option value="center">Orta</option>
                <option value="right">Sağa</option>
              </select>
            </label>
            <label className="text-[11px] text-[#5b6578]">
              Sığdırma
              <select
                className="mt-1 h-8 w-full rounded-md border border-[#dbe4ef] bg-white px-2 text-sm text-[#152033]"
                value={data.fit}
                onChange={(event) => patch({ fit: event.target.value })}
              >
                <option value="contain">Sığdır</option>
                <option value="cover">Kutuyu doldur</option>
              </select>
            </label>
            <label className="flex items-end gap-2 pb-1 text-sm text-[#152033]">
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={data.tile}
                onChange={(event) =>
                  patch({
                    tile: event.target.checked,
                    align: event.target.checked ? data.align || "left" : data.align,
                  })
                }
              />
              Metnin yanına döşe
            </label>
          </div>
          <p className="text-[10px] text-[#5b6578]">
            Kenarlardan sürükleyerek veya kaydırıcıyla videoyu istediğiniz oranda küçültüp büyütebilirsiniz.
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
  fit,
}: {
  localSrc: string | null;
  youtubeId: string | null;
  vimeoId: string | null;
  url: string;
  urlOk: boolean;
  fit: "contain" | "cover";
}) {
  const box = "aspect-video w-full bg-black";
  if (localSrc) {
    return (
      <video
        src={localSrc}
        controls
        className={cn(box, fit === "cover" ? "object-cover" : "object-contain")}
      />
    );
  }
  if (youtubeId) {
    return (
      <iframe
        title="YouTube videosu"
        src={youtubeEmbedUrl(youtubeId)}
        className="aspect-video w-full border-0"
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
        className="aspect-video w-full border-0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }
  if (urlOk) {
    return (
      <div className="flex aspect-video items-center justify-center border border-dashed border-[#d6d0c4] bg-[#f6f1e6] p-4 text-sm text-[#5b6578]">
        Bağlantı kaydedildi. YouTube/Vimeo değilse editörde oynatıcı yok.
      </div>
    );
  }
  if (url.trim()) {
    return (
      <div className="flex aspect-video items-center justify-center border border-dashed border-[#d6d0c4] bg-[#f6f1e6] text-sm text-[#5b6578]">
        Geçerli bir http/https adresi girin
      </div>
    );
  }
  return (
    <div className="flex aspect-video items-center justify-center border border-dashed border-[#d6d0c4] bg-[#f6f1e6] text-sm text-[#5b6578]">
      Yerel dosya veya bağlantı ekleyin
    </div>
  );
}
