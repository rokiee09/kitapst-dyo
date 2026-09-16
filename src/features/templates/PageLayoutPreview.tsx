import { cn } from "@/lib/utils";
import { layoutSlotsFor, type LayoutSlot } from "@/features/templates/pageLayouts";

export function PageLayoutPreview({
  templateId,
  payload,
}: {
  templateId: string;
  payload: unknown;
}) {
  const slots = layoutSlotsFor(templateId, payload);
  return (
    <div className="flex h-[168px] flex-col gap-1.5 overflow-hidden rounded-md bg-[#f7f1e4] p-2.5 shadow-inner">
      {slots.map((slot, index) => (
        <MiniSlot key={`${slot}-${index}`} slot={slot} />
      ))}
    </div>
  );
}

function MiniSlot({ slot }: { slot: LayoutSlot }) {
  if (slot === "heading") {
    return <div className="h-2.5 w-3/4 rounded-sm bg-[#1d4ed8]/80" />;
  }
  if (slot === "text") {
    return (
      <div className="space-y-1">
        <div className="h-1.5 w-full rounded-sm bg-[#c5bda8]" />
        <div className="h-1.5 w-5/6 rounded-sm bg-[#d6d0c4]" />
      </div>
    );
  }
  if (slot === "image-full") {
    return <PhotoBlock className="h-12 w-full" />;
  }
  if (slot === "image-mid") {
    return <PhotoBlock className="mx-auto h-10 w-[70%]" />;
  }
  if (slot === "image-left") {
    return (
      <div className="flex gap-1.5">
        <PhotoBlock className="h-10 w-[46%]" />
        <div className="flex-1 space-y-1 pt-1">
          <div className="h-1.5 w-full rounded-sm bg-[#c5bda8]" />
          <div className="h-1.5 w-4/5 rounded-sm bg-[#d6d0c4]" />
        </div>
      </div>
    );
  }
  if (slot === "image-right") {
    return (
      <div className="flex gap-1.5">
        <div className="flex-1 space-y-1 pt-1">
          <div className="h-1.5 w-full rounded-sm bg-[#c5bda8]" />
          <div className="h-1.5 w-4/5 rounded-sm bg-[#d6d0c4]" />
        </div>
        <PhotoBlock className="h-10 w-[46%]" />
      </div>
    );
  }
  if (slot === "video") {
    return <div className="flex h-9 items-center justify-center rounded-sm bg-[#111827] text-[8px] text-white/80">▶ video</div>;
  }
  if (slot === "qr") {
    return <div className="ml-auto h-7 w-7 rounded-sm border border-[#1c314c] bg-white" />;
  }
  if (slot === "info") {
    return <div className="h-6 rounded-sm border border-amber-200 bg-amber-50" />;
  }
  if (slot === "warn") {
    return <div className="h-6 rounded-sm border border-orange-200 bg-orange-50" />;
  }
  if (slot === "list") {
    return (
      <div className="space-y-1 pl-2">
        <div className="h-1.5 w-4/5 rounded-sm bg-[#c5bda8]" />
        <div className="h-1.5 w-3/5 rounded-sm bg-[#d6d0c4]" />
        <div className="h-1.5 w-2/3 rounded-sm bg-[#d6d0c4]" />
      </div>
    );
  }
  return <div className="h-5 rounded-sm border-l-2 border-blue-400 bg-[#eef3fb]" />;
}

function PhotoBlock({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-sm bg-[#c4d4c0]", className)}>
      <div className="absolute inset-0 bg-gradient-to-br from-[#8fb6a0] via-[#d7c7a4] to-[#7ea0c4]" />
      <div className="absolute bottom-1 left-1 right-1 h-1 rounded-full bg-white/50" />
    </div>
  );
}
