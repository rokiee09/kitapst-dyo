export type LayoutSlot =
  | "heading"
  | "text"
  | "image-full"
  | "image-mid"
  | "image-left"
  | "image-right"
  | "video"
  | "qr"
  | "info"
  | "warn"
  | "list"
  | "quote";

export function layoutSlotsFor(id: string, payload: unknown): LayoutSlot[] {
  switch (id) {
    case "builtin-kapak":
      return ["image-full", "heading", "text"];
    case "builtin-gorsel-ust":
      return ["image-full", "heading", "text"];
    case "builtin-gorsel-orta":
      return ["heading", "text", "image-mid", "text"];
    case "builtin-gorsel-sol":
      return ["heading", "image-left", "text"];
    case "builtin-gorsel-sag":
      return ["heading", "image-right", "text"];
    case "builtin-cift-gorsel":
      return ["heading", "image-full", "image-full", "text"];
    case "builtin-ders":
      return ["heading", "text", "info", "list"];
    case "builtin-adimlar-gorsel":
      return ["heading", "image-full", "list"];
    case "builtin-medya":
      return ["heading", "image-full", "video", "qr"];
    case "builtin-alinti-gorsel":
      return ["quote", "image-mid", "text"];
    case "builtin-uyari":
      return ["warn", "image-mid", "text", "list"];
    default:
      return slotsFromPayload(payload);
  }
}

function slotsFromPayload(payload: unknown): LayoutSlot[] {
  if (!Array.isArray(payload)) return ["text"];
  const slots: LayoutSlot[] = [];
  for (const item of payload) {
    const type = item && typeof item === "object" && "type" in item ? String((item as { type: unknown }).type) : "";
    const data = item && typeof item === "object" && "data" in item ? (item as { data?: Record<string, unknown> }).data : undefined;
    const align = typeof data?.align === "string" ? data.align : "center";
    const width = typeof data?.width === "number" ? data.width : 100;
    slots.push(slotForType(type, align, width));
    if (slots.length >= 6) break;
  }
  return slots.length > 0 ? slots : ["text"];
}

function slotForType(type: string, align: string, width: number): LayoutSlot {
  switch (type) {
    case "heading":
      return "heading";
    case "image":
      if (width <= 55 && align === "left") return "image-left";
      if (width <= 55 && align === "right") return "image-right";
      if (width < 90) return "image-mid";
      return "image-full";
    case "video":
      return "video";
    case "qr":
      return "qr";
    case "infoBox":
      return "info";
    case "warningBox":
      return "warn";
    case "orderedList":
    case "unorderedList":
      return "list";
    case "quote":
      return "quote";
    default:
      return "text";
  }
}
