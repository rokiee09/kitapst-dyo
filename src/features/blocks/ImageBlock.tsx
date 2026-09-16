import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { assetService } from "@/services/assets";
import { pickLocalFile } from "@/utils/filePicker";
import { insertQrBlock } from "@/features/blocks/insertQr";
import { MediaCaption } from "@/features/blocks/MediaCaption";
import { readImageData } from "@/features/blocks/blockData";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { cn } from "@/lib/utils";
import type { ContentBlock } from "@/types/domain";

export function ImageBlock({ block, editable }: { block: ContentBlock; editable: boolean }) {
  const data = readImageData(block.data);
  const selected = useEditorStore((state) => state.selectedBlockId === block.id);
  const [src, setSrc] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);
  const figureRef = useRef<HTMLElement>(null);

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

  async function chooseImage() {
    try {
      const path = await pickLocalFile("image");
      if (!path) return;
      const asset = await assetService.import(path, "image");
      patch({ assetId: asset.id, relativePath: asset.relativePath });
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
    const startWidth = data.width;
    const grow = data.align === "center" ? 2 : 1;
    setResizing(true);

    function onMove(moveEvent: PointerEvent) {
      const dx = moveEvent.clientX - startX;
      const signed = edge === "w" ? -dx : dx;
      const next = Math.min(100, Math.max(8, Math.round(startWidth + (signed / pageWidth) * 100 * grow)));
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

  const alignClass =
    data.align === "left" ? "mr-auto" : data.align === "right" ? "ml-auto" : "mx-auto";

  return (
    <figure
      ref={figureRef}
      className={cn("relative max-w-full", alignClass)}
      style={{ width: `${data.width}%` }}
    >
      {src ? (
        <img
          src={src}
          alt={data.alt}
          className="block h-auto w-full select-none shadow-sm"
          draggable={false}
          style={{ borderRadius: data.borderRadius || 12 }}
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
            %{data.width}
            {resizing ? " · bırakınca kaydedilir" : ""}
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
      {editable ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="paper" onClick={() => void chooseImage()}>
            {src ? "Görseli değiştir" : "Bilgisayardan görsel seç"}
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
          {src ? (
            <label className="flex min-w-40 flex-1 items-center gap-2 text-[11px] text-[#5b6578]">
              Boyut
              <input
                type="range"
                min={8}
                max={100}
                value={data.width}
                onChange={(event) => patch({ width: Number(event.target.value) })}
                className="w-full accent-blue-600"
              />
              <span className="w-8 tabular-nums">%{data.width}</span>
            </label>
          ) : null}
        </div>
      ) : null}
    </figure>
  );
}
