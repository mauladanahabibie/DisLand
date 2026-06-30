import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const ToastProvider = ToastPrimitive.Provider;

export const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex w-[360px] flex-col gap-2 outline-none",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = "ToastViewport";

type ToastVariant = "default" | "success" | "warning" | "danger";

const variantClasses: Record<ToastVariant, string> = {
  default: "surface-raised",
  success: "surface-raised border-success/40",
  warning: "surface-raised border-warning/40",
  danger: "surface-raised border-danger/40",
};

const variantIconColor: Record<ToastVariant, string> = {
  default: "text-fg-muted",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export interface ToastProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> {
  variant?: ToastVariant;
  title?: string;
  description?: React.ReactNode;
}

export const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  ToastProps
>(({ className, variant = "default", title, description, children, ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(
      "group pointer-events-auto relative flex items-start gap-3 rounded-lg p-4 pr-8",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:fade-out-0",
      "data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
      variantClasses[variant],
      className,
    )}
    {...props}
  >
    <div className={cn("mt-0.5 h-2 w-2 rounded-full shrink-0", variantIconColor[variant].replace("text-", "bg-"))} />
    <div className="flex-1 min-w-0">
      {title && (
        <ToastPrimitive.Title className="text-sm font-medium text-fg">
          {title}
        </ToastPrimitive.Title>
      )}
      {description && (
        <ToastPrimitive.Description className="text-sm text-fg-muted mt-0.5">
          {description}
        </ToastPrimitive.Description>
      )}
      {children}
    </div>
    <ToastPrimitive.Close
      className={cn(
        "absolute right-2 top-2 rounded-md p-1 text-fg-muted",
        "transition-colors hover:bg-bg-hover hover:text-fg",
      )}
    >
      <X className="h-3.5 w-3.5" />
    </ToastPrimitive.Close>
  </ToastPrimitive.Root>
));
Toast.displayName = "Toast";
