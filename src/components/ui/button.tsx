import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white hover:bg-blue-500",
        secondary: "bg-[#152238] text-[#d7e3f4] hover:bg-[#1c2c48] border border-[#1c2a44]",
        ghost: "text-[#d7e3f4] hover:bg-[#152238]",
        outline: "border border-[#1c2a44] bg-transparent hover:bg-[#152238]",
        danger: "bg-red-600 text-white hover:bg-red-500",
        paper: "bg-white text-[#182033] border border-[#e7e1d4] hover:bg-[#f6f1e6]",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 px-2 text-xs",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";
