import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full",
      "border border-border-subtle transition-colors duration-200 ease-spring",
      "focus-ring disabled:opacity-40 disabled:cursor-not-allowed",
      "data-[state=checked]:bg-accent data-[state=checked]:border-accent/50",
      "data-[state=unchecked]:bg-bg-surface",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block h-3.5 w-3.5 rounded-full bg-fg shadow-soft",
        "ring-0 transition-transform duration-200 ease-spring",
        "data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-accent-fg",
        "data-[state=unchecked]:translate-x-[3px] data-[state=unchecked]:bg-fg-muted",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";
