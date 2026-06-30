import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md bg-bg-surface border border-border-subtle px-3 text-sm text-fg",
        "placeholder:text-fg-subtle transition-colors",
        "hover:bg-bg-hover focus-ring disabled:opacity-40",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
