import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-8 w-full rounded-md border border-[#1c2a44] bg-[#070b14] px-3 text-sm text-[#d7e3f4] outline-none placeholder:text-[#8aa0bd] focus-visible:ring-2 focus-visible:ring-blue-500",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";
