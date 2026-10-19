import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { isSafeExternalUrl } from "@/utils/security";
import { MediaCaption } from "@/features/blocks/MediaCaption";
import { qrPayload, readQrData } from "@/features/blocks/blockData";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { ContentBlock } from "@/types/domain";

export function QrBlock({ block, editable }: { block: ContentBlock; editable: boolean }) {
  const data = readQrData(block.data);
  const selected = useEditorStore((state) => state.selectedBlockId === block.id);
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chapters = useWorkspaceStore((state) => state.chapters);
  const chapterTitle = chapters.find((item) => item.id === data.chapterId)?.title;
  const payload = qrPayload(data);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!payload) {
        await Promise.resolve();
        if (!cancelled) {
          setSvgUrl(null);
          setError(null);
        }
        return;
      }
      if ((data.target === "video" || data.target === "url") && !isSafeExternalUrl(payload)) {
        await Promise.resolve();
        if (!cancelled) {
          setSvgUrl(null);
          setError("QR için geçerli bir http/https adresi girin.");
        }
        return;
      }
      if (data.target === "chapter" && !data.chapterId) {
        await Promise.resolve();
        if (!cancelled) {
          setSvgUrl(null);
          setError("Yönlendirilecek bölümü seçin.");
        }
        return;
      }
      try {
        const svg = await QRCode.toString(payload, {
          type: "svg",
          width: data.size,
          margin: data.margin,
          errorCorrectionLevel: data.errorCorrection,
        });
        if (!cancelled) {
          setError(null);
          setSvgUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
        }
      } catch {
        if (!cancelled) {
          setSvgUrl(null);
          setError("QR kod oluşturulamadı.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payload, data.target, data.chapterId, data.size, data.margin, data.errorCorrection]);

  async function openChapter() {
    if (!data.chapterId) return;
    const blocks = await useWorkspaceStore.getState().selectChapter(data.chapterId);
    useEditorStore.getState().setBlocks(blocks);
  }

  return (
    <figure className="flex flex-col items-center gap-1">
      {svgUrl ? (
        <img
          src={svgUrl}
          alt={data.title || "QR kod"}
          draggable={false}
          className="block h-auto w-full select-none"
        />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed border-[#d6d0c4] bg-[#f6f1e6] px-2 text-center text-[10px] text-[#5b6578]">
          {error ?? "QR hedefini seçin"}
        </div>
      )}
      <MediaCaption
        blockId={block.id}
        kind="qr"
        note={data.caption}
        custom={data.captionCustom}
        visible={data.captionVisible}
        editable={editable && selected}
        qrTarget={data.target}
        onChange={(next) => {
          useEditorStore.getState().updateBlockLocal(block.id, { data: { ...data, ...next } });
          useEditorStore.getState().scheduleSave(block.id);
        }}
      />
      {editable && selected && data.target === "chapter" && chapterTitle ? (
        <button type="button" className="text-[10px] text-blue-600 underline" onClick={() => void openChapter()}>
          Bölüme git: {chapterTitle}
        </button>
      ) : null}
    </figure>
  );
}
