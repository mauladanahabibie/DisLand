import * as React from "react";
import { cn } from "@/lib/utils";

/** Minimal custom slider (no Radix dependency) — single value or range-friendly. */
export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

export const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      value,
      min = 0,
      max = 100,
      step = 1,
      onChange,
      className,
      disabled,
      ...rest
    },
    ref,
  ) => {
    const trackRef = React.useRef<HTMLDivElement>(null);
    const pct = ((value - min) / (max - min)) * 100;

    const handlePointer = React.useCallback(
      (clientX: number) => {
        const el = trackRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        const raw = min + ratio * (max - min);
        const stepped = Math.round(raw / step) * step;
        onChange(Math.min(max, Math.max(min, stepped)));
      },
      [min, max, step, onChange],
    );

    const onPointerDown = (e: React.PointerEvent) => {
      if (disabled) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      handlePointer(e.clientX);
    };
    const onPointerMove = (e: React.PointerEvent) => {
      if (disabled || e.buttons !== 1) return;
      handlePointer(e.clientX);
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex items-center w-full h-5 select-none",
          disabled && "opacity-40",
          className,
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-disabled={disabled}
        aria-label={rest["aria-label"]}
      >
        <div
          ref={trackRef}
          className="relative h-1 w-full rounded-full bg-bg-hover border border-border-subtle"
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-accent"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-accent-fg border-2 border-accent shadow-soft"
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>
    );
  },
);
Slider.displayName = "Slider";
