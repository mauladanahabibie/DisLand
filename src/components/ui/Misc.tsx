import * as React from "react";
import { cn } from "@/lib/utils";

export const Separator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" }
>(({ className, orientation = "horizontal", ...props }, ref) => (
  <div
    ref={ref}
    role="separator"
    aria-orientation={orientation}
    className={cn(
      "bg-border-subtle",
      orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
      className,
    )}
    {...props}
  />
));
Separator.displayName = "Separator";

type BadgeVariant = "default" | "accent" | "success" | "warning" | "danger" | "outline";

const badgeVariants: Record<BadgeVariant, string> = {
  default: "bg-bg-surface text-fg-muted border-border-subtle",
  accent: "bg-accent/15 text-accent border-accent/30",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-danger/15 text-danger border-danger/30",
  outline: "bg-transparent text-fg-muted border-border",
};

export const Badge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }
>(({ className, variant = "default", ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
      badgeVariants[variant],
      className,
    )}
    {...props}
  />
));
Badge.displayName = "Badge";
