import * as Popover from "@radix-ui/react-popover";
import {
  MonitorSmartphone,
  MonitorCog,
  ArrowLeftRight,
  ArrowUpDown,
  Copy,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import type { LayoutPreset } from "@/types";

const PRESETS: {
  id: LayoutPreset;
  label: string;
  desc: string;
  icon: typeof MonitorSmartphone;
}[] = [
  {
    id: "side-by-side-left",
    label: "External ← Laptop",
    desc: "Monitor di kiri, laptop di kanan",
    icon: ArrowLeftRight,
  },
  {
    id: "side-by-side-right",
    label: "Laptop ← External",
    desc: "Laptop di kiri, monitor di kanan",
    icon: ArrowLeftRight,
  },
  {
    id: "stacked-top",
    label: "External ↑ Laptop ↓",
    desc: "Monitor di atas, laptop di bawah",
    icon: ArrowUpDown,
  },
  {
    id: "stacked-bottom",
    label: "Laptop ↑ External ↓",
    desc: "Laptop di atas, monitor di bawah",
    icon: ArrowUpDown,
  },
  {
    id: "mirror",
    label: "Mirror",
    desc: "Laptop duplikat layar monitor",
    icon: Copy,
  },
];

export function LayoutPresets() {
  const apply = useStore((s) => s.applyLayoutPreset);
  const monitors = useStore((s) => s.monitors);
  const enabledCount = monitors.filter((m) => m.enabled).length;
  const disabled = enabledCount < 1 || monitors.length < 1;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md border border-border-subtle bg-bg-surface text-fg-muted hover:text-fg hover:bg-bg-hover transition-colors disabled:opacity-40 disabled:pointer-events-none focus-ring"
        >
          <MonitorSmartphone className="h-3.5 w-3.5" />
          Quick Layout
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          side="bottom"
          className="z-50 w-72 surface-flat rounded-lg border border-border-subtle p-1 shadow-pop outline-none"
        >
          <div className="px-2.5 py-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-fg-subtle">
            <MonitorCog className="h-3 w-3" />
            Preset Layout
          </div>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => apply(p.id)}
              className="w-full text-left px-2.5 py-2 rounded-md hover:bg-bg-hover transition-colors flex items-start gap-2.5"
            >
              <p.icon className="h-3.5 w-3.5 mt-0.5 text-fg-muted shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-fg">{p.label}</div>
                <div className="text-[10px] text-fg-subtle">{p.desc}</div>
              </div>
            </button>
          ))}
          <div className="px-2.5 py-1.5 text-[10px] text-fg-subtle border-t border-border-subtle mt-1">
            Mengatur posisi otomatis. Tekan Apply untuk menerapkan.
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
