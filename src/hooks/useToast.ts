import * as React from "react";
import type { ToastProps } from "@/components/ui/Toast";

export interface ToastRecord {
  id: string;
  variant?: ToastProps["variant"];
  title?: string;
  description?: React.ReactNode;
  duration?: number;
}

interface ToastStoreApi {
  toasts: ToastRecord[];
  push: (t: Omit<ToastRecord, "id">) => string;
  dismiss: (id: string) => void;
}

const listeners = new Set<(s: ToastStoreApi) => void>();
let state: ToastStoreApi = {
  toasts: [],
  push(t) {
    const id = `t_${Math.random().toString(36).slice(2, 9)}`;
    const record: ToastRecord = { id, duration: 4000, ...t };
    state = { ...state, toasts: [...state.toasts, record] };
    emit();
    if (record.duration && record.duration > 0) {
      window.setTimeout(() => state.dismiss(id), record.duration);
    }
    return id;
  },
  dismiss(id) {
    state = { ...state, toasts: state.toasts.filter((t) => t.id !== id) };
    emit();
  },
};

function emit() {
  for (const l of listeners) l(state);
}

export function useToast(): ToastStoreApi {
  const [local, setLocal] = React.useState<ToastStoreApi>(state);
  React.useEffect(() => {
    listeners.add(setLocal);
    setLocal(state);
    return () => {
      listeners.delete(setLocal);
    };
  }, []);
  return local;
}

/** Convenience helper usable outside React (e.g. inside zustand actions). */
export const toast = {
  show: (t: Omit<ToastRecord, "id">) => state.push(t),
  success: (title: string, description?: React.ReactNode) =>
    state.push({ variant: "success", title, description }),
  warning: (title: string, description?: React.ReactNode) =>
    state.push({ variant: "warning", title, description }),
  error: (title: string, description?: React.ReactNode) =>
    state.push({ variant: "danger", title, description }),
  info: (title: string, description?: React.ReactNode) =>
    state.push({ variant: "default", title, description }),
};
