import { toast } from "sonner";
import { useEditorStore } from "@/stores/editorStore";
import type { QrTarget } from "@/types/domain";

export async function insertQrBlock(options: {
  afterBlockId: string;
  target: QrTarget;
  value?: string;
  chapterId?: string | null;
  title?: string;
  description?: string;
}) {
  await useEditorStore.getState().addBlock("qr", options.afterBlockId, {
    target: options.target,
    mode: options.target === "text" ? "text" : "url",
    value: options.value ?? "",
    chapterId: options.chapterId ?? null,
    title: options.title ?? "",
    caption: "",
    captionCustom: false,
    captionVisible: true,
    description: options.description ?? "",
    size: 160,
    errorCorrection: "M",
    margin: 4,
  });
  toast.success("QR blok olarak eklendi.");
}
