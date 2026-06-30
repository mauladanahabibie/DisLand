import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  default:
    "bg-bg-surface text-fg border border-border-subtle hover:bg-bg-hover",
  outline:
    "bg-transparent text-fg border border-border hover:bg-bg-hover",
  ghost:
    "bg-transparent text-fg-muted hover:text-fg hover:bg-bg-hover border border-transparent",
  danger:
    "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20",
  accent:
    "bg-accent text-accent-fg border border-accent/50 hover:bg-accent-muted",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
  md: "h-9 px-4 text-sm gap-2 rounded-md",
  lg: "h-11 px-6 text-sm gap-2 rounded-lg",
  icon: "h-9 w-9 rounded-md",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium select-none",
          "transition-colors duration-150 ease-spring",
          "focus-ring disabled:opacity-40 disabled:pointer-events-none",
          "active:scale-[0.98]",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
