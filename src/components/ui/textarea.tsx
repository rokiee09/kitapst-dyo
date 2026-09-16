import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-md border border-[#1c2a44] bg-[#070b14] px-3 py-2 text-sm text-[#d7e3f4] outline-none placeholder:text-[#8aa0bd] focus-visible:ring-2 focus-visible:ring-blue-500",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
