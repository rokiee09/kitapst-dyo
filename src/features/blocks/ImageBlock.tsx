import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { assetService } from "@/services/assets";
import { pickLocalFile } from "@/utils/filePicker";
import { insertQrBlock } from "@/features/blocks/insertQr";
import { MediaCaption } from "@/features/blocks/MediaCaption";
import { MediaChrome } from "@/features/blocks/MediaChrome";
import { readImageData } from "@/features/blocks/blockData";
import { isFree, isWrap } from "@/features/blocks/blockStyle";
import { percentToMm } from "@/features/blocks/mediaLayout";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { cn } from "@/lib/utils";
import type { ContentBlock } from "@/types/domain";

export function ImageBlock({ block, editable }: { block: ContentBlock; editable: boolean }) {
  const data = readImageData(block.data);
  const selected = useEditorStore((state) => state.selectedBlockId === block.id);
  const book = useWorkspaceStore((state) => state.book);
  const [src, setSrc] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);
  const figureRef = useRef<HTMLElement>(null);
  const free = isFree(block.style);
  const wrap = isWrap(block.style);
  const widthPercent = free ? (block.style.width ?? data.width) : data.width;

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
      } catch (error) {
        console.error("[kitap-studiosu] image", error);
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

  function setWidth(next: number) {
    const clamped = Math.min(100, Math.max(8, Math.round(next)));
    const styleNow = block.style;
    if (free) {
      const mm = percentToMm(styleNow.x ?? 58, styleNow.y ?? 8, clamped, book);
      useEditorStore.getState().updateBlockLocal(block.id, {
        data: { ...data, width: clamped },
        style: {
          ...styleNow,
          width: clamped,
          widthMm: mm.widthMm,
        },
      });
    } else {
      useEditorStore.getState().updateBlockLocal(block.id, { data: { ...data, width: clamped } });
    }
    useEditorStore.getState().scheduleSave(block.id);
  }

  async function chooseImage() {
    try {
      const path = await pickLocalFile("image");
      if (!path) return;
      const asset = await assetService.import(path, "image");
      patch({ assetId: asset.id, relativePath: asset.relativePath, alt: data.alt || asset.filename });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Görsel eklenemedi.");
    }
  }

  function startResize(event: ReactPointerEvent<HTMLButtonElement>, edge: "e" | "se" | "w") {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
    const page = figureRef.current?.closest(".book-page");
    const pageWidth = page?.clientWidth ?? 720;
    const startX = event.clientX;
    const startWidth = widthPercent;
    const grow = data.align === "center" && !free && !wrap ? 2 : 1;
    setResizing(true);

    function onMove(moveEvent: PointerEvent) {
      const dx = moveEvent.clientX - startX;
      const signed = edge === "w" ? -dx : dx;
      const next = Math.min(100, Math.max(8, Math.round(startWidth + (signed / pageWidth) * 100 * grow)));
      if (free) {
        const styleNow =
          useEditorStore.getState().blocks.find((item) => item.id === block.id)?.style ?? block.style;
        const mm = percentToMm(styleNow.x ?? 58, styleNow.y ?? 8, next, book);
        useEditorStore.getState().updateBlockLocal(block.id, {
          data: { ...data, width: next },
          style: { ...styleNow, width: next, widthMm: mm.widthMm },
        });
      } else {
        useEditorStore.getState().updateBlockLocal(block.id, { data: { ...data, width: next } });
      }
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

  const alignClass =
    free || wrap
      ? "w-full"
      : data.align === "left"
        ? "mr-auto"
        : data.align === "right"
          ? "ml-auto"
          : "mx-auto";

  return (
    <figure
      ref={figureRef}
      className={cn("relative max-w-full", alignClass)}
      style={{ width: free || wrap ? "100%" : `${data.width}%` }}
    >
      {editable && selected ? (
        <MediaChrome
          block={block}
          widthPercent={widthPercent}
          onWidth={setWidth}
          captionVisible={data.captionVisible}
          onCaptionToggle={() => patch({ captionVisible: !data.captionVisible })}
        />
      ) : null}
      {src ? (
        <img
          src={src}
          alt={data.alt}
          className="block h-auto w-full select-none shadow-sm"
          draggable={false}
          style={{ borderRadius: data.borderRadius || 0 }}
        />
      ) : (
        <div className="flex min-h-36 items-center justify-center rounded-md border border-dashed border-[#d6d0c4] bg-[#f6f1e6] px-4 text-sm text-[#5b6578]">
          Görsel seçilmedi
        </div>
      )}
      {editable && selected && src ? (
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
            %{widthPercent}
            {resizing ? " · oran kilitli" : ""}
          </div>
        </>
      ) : null}
      <MediaCaption
        blockId={block.id}
        kind="image"
        note={data.caption}
        custom={data.captionCustom}
        visible={data.captionVisible}
        editable={editable}
        onChange={(next) => patch(next)}
      />
      {editable && !src ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="paper" onClick={() => void chooseImage()}>
            Bilgisayardan görsel seç
          </Button>
        </div>
      ) : null}
      {editable && selected && src ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="paper" onClick={() => void chooseImage()}>
            Görseli değiştir
          </Button>
          <Button
            size="sm"
            variant="paper"
            onClick={() =>
              void insertQrBlock({
                afterBlockId: block.id,
                target: "chapter",
                chapterId: useWorkspaceStore.getState().selectedChapterId,
                title: data.caption || data.alt || "Görsel",
                description: "Sayfa içi yönlendirme",
              })
            }
          >
            QR olarak ekle
          </Button>
        </div>
      ) : null}
    </figure>
  );
}
