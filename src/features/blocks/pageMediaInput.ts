import { toast } from "sonner";
import { assetService } from "@/services/assets";
import { isTauriRuntime } from "@/services/tauri/invoke";
import { defaultMediaStyle, mmToPercent, percentToMm } from "@/features/blocks/mediaLayout";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Asset } from "@/types/domain";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|mkv)$/i;

export async function importImageBytes(bytes: number[], filename: string): Promise<Asset> {
  return assetService.importBytes(bytes, filename, "image");
}

export async function addImageAssetToPage(
  asset: Asset,
  options?: { xPercent?: number; yPercent?: number; afterBlockId?: string | null },
) {
  const book = useWorkspaceStore.getState().book;
  const x = options?.xPercent ?? 58;
  const y = options?.yPercent ?? 8;
  const width = 36;
  const mm = percentToMm(x, y, width, book);
  await useEditorStore.getState().addBlock(
    "image",
    options?.afterBlockId ?? useEditorStore.getState().selectedBlockId,
    {
      assetId: asset.id,
      relativePath: asset.relativePath,
      alt: asset.filename,
      caption: "",
      captionCustom: false,
      captionVisible: true,
      description: "",
      width,
      align: "center",
      borderRadius: 0,
      showInEpub: true,
      showInPdf: true,
      showInHtml: true,
    },
    {
      ...defaultMediaStyle("freeFront"),
      x,
      y,
      width,
      xMm: mm.xMm,
      yMm: mm.yMm,
      widthMm: mm.widthMm,
    },
  );
}

export async function handlePagePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items;
  if (!items) return false;
  for (const item of Array.from(items)) {
    if (!item.type.startsWith("image/")) continue;
    event.preventDefault();
    const file = item.getAsFile();
    if (!file) return false;
    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const asset = await importImageBytes(Array.from(buffer), file.name || `yapistir-${Date.now()}.png`);
      await addImageAssetToPage(asset);
      toast.success("Görsel panodan yapıştırıldı.");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Yapıştırma başarısız.");
      return true;
    }
  }
  return false;
}

export function dropPointPercent(event: DragEvent, page: Element) {
  const rect = page.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
  const y = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
  return {
    xPercent: Math.min(92, Math.max(0, x)),
    yPercent: Math.min(92, Math.max(0, y)),
  };
}

export async function handlePageDrop(event: DragEvent) {
  const page = (event.target as Element | null)?.closest?.(".book-page");
  if (!page) return false;

  const mediaId = event.dataTransfer?.getData("application/x-kitap-media-id");
  const mediaPath = event.dataTransfer?.getData("application/x-kitap-media-path");
  const mediaType = event.dataTransfer?.getData("application/x-kitap-media-type");
  const point = dropPointPercent(event, page);

  if (mediaId && mediaPath && (mediaType === "image" || mediaType === "video")) {
    event.preventDefault();
    const filename = mediaPath.split(/[/\\]/).pop() || (mediaType === "video" ? "video" : "görsel");
    if (mediaType === "image") {
      await addImageAssetToPage(
        {
          id: mediaId,
          projectId: "",
          type: "image",
          filename,
          relativePath: mediaPath,
          mimeType: "image/*",
          size: 0,
          createdAt: "",
        },
        point,
      );
      toast.success("Görsel sayfaya eklendi.");
      return true;
    }
    await useEditorStore.getState().addBlock(
      "video",
      null,
      {
        sourceType: "local",
        assetId: mediaId,
        relativePath: mediaPath,
        title: filename,
        caption: "",
        captionCustom: false,
        captionVisible: true,
        description: "",
        url: "",
        thumbnailAssetId: null,
        thumbnailPath: null,
        duration: "",
        generateQr: true,
        showInEpub: true,
        showInPdf: true,
        showInHtml: true,
        previewAsPdf: true,
        tile: false,
        width: 36,
        align: "center",
        fit: "cover",
      },
      {
        ...defaultMediaStyle("freeFront"),
        ...pointToStyle(point),
      },
    );
    toast.success("Video sayfaya eklendi.");
    return true;
  }

  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    const file = files[0];
    if (!file) return false;
    if (IMAGE_EXT.test(file.name) || file.type.startsWith("image/")) {
      event.preventDefault();
      try {
        if (isTauriRuntime() && "path" in file && typeof (file as File & { path?: string }).path === "string") {
          const path = (file as File & { path: string }).path;
          const asset = await assetService.import(path, "image");
          await addImageAssetToPage(asset, point);
        } else {
          const buffer = new Uint8Array(await file.arrayBuffer());
          const asset = await importImageBytes(Array.from(buffer), file.name);
          await addImageAssetToPage(asset, point);
        }
        toast.success("Görsel bırakıldığı yere eklendi.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Görsel eklenemedi.");
      }
      return true;
    }
    if (VIDEO_EXT.test(file.name) || file.type.startsWith("video/")) {
      event.preventDefault();
      try {
        const path =
          isTauriRuntime() && "path" in file
            ? (file as File & { path?: string }).path
            : null;
        if (!path) {
          toast.error("Video için dosya yolunu Medya panelinden veya seçiciyle ekleyin.");
          return true;
        }
        const asset = await assetService.import(path, "video");
        await useEditorStore.getState().addBlock("video", null, {
          sourceType: "local",
          assetId: asset.id,
          relativePath: asset.relativePath,
          title: asset.filename,
          caption: "",
          captionCustom: false,
          captionVisible: true,
          description: "",
          url: "",
          thumbnailAssetId: null,
          thumbnailPath: null,
          duration: "",
          generateQr: true,
          showInEpub: true,
          showInPdf: true,
          showInHtml: true,
          previewAsPdf: true,
          tile: false,
          width: 36,
          align: "center",
          fit: "cover",
        }, {
          ...defaultMediaStyle("freeFront"),
          ...pointToStyle(point),
        });
        toast.success("Video bırakıldığı yere eklendi.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Video eklenemedi.");
      }
      return true;
    }
  }
  return false;
}

function pointToStyle(point: { xPercent: number; yPercent: number }) {
  const book = useWorkspaceStore.getState().book;
  const width = 36;
  const mm = percentToMm(point.xPercent, point.yPercent, width, book);
  return {
    x: point.xPercent,
    y: point.yPercent,
    width,
    xMm: mm.xMm,
    yMm: mm.yMm,
    widthMm: mm.widthMm,
  };
}

export function syncMmFromPercent(
  x: number,
  y: number,
  width: number,
) {
  const book = useWorkspaceStore.getState().book;
  return percentToMm(x, y, width, book);
}

export function syncPercentFromMm(xMm: number, yMm: number, widthMm: number) {
  const book = useWorkspaceStore.getState().book;
  return mmToPercent(xMm, yMm, widthMm, book);
}
