import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { PreviewMode } from "@/types/domain";

export function DeviceFrame({
  mode,
  active,
  children,
  scroll = false,
}: {
  mode: PreviewMode;
  active: boolean;
  children: ReactNode;
  scroll?: boolean;
}) {
  if (!active) return children;

  const scroller = scroll ? "max-h-[calc(100vh-180px)] overflow-y-auto" : "overflow-hidden";

  if (mode === "phone") {
    return (
      <div className="flex justify-center px-6 py-8">
        <div className="w-[390px] rounded-[2.4rem] border-[10px] border-[#0b1220] bg-[#0b1220] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <div className="mx-auto mb-2 h-4 w-24 rounded-full bg-[#1c2a40]" />
          <div className={cn("rounded-[1.7rem] bg-white", scroller)}>{children}</div>
        </div>
      </div>
    );
  }

  if (mode === "tablet") {
    return (
      <div className="flex justify-center px-6 py-8">
        <div className="w-[780px] rounded-[1.6rem] border-[12px] border-[#152033] bg-[#152033] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <div className={cn("rounded-[0.9rem] bg-white", scroller)}>{children}</div>
        </div>
      </div>
    );
  }

  return <div className={cn("px-8 py-4", scroll && "min-h-full")}>{children}</div>;
}
