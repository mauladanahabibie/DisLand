import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function formatHz(hz: number) {
  return `${Math.round(hz)}Hz`;
}

/** Snap a value to the nearest grid step. */
export function snap(value: number, step: number) {
  return Math.round(value / step) * step;
}

/** Resolve the closest of a set of candidates to `value`. */
export function closest(value: number, candidates: number[]) {
  let best = candidates[0];
  let bestDelta = Math.abs(value - best);
  for (const c of candidates) {
    const d = Math.abs(value - c);
    if (d < bestDelta) {
      best = c;
      bestDelta = d;
    }
  }
  return best;
}

/** Generate a short unique id. */
export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
