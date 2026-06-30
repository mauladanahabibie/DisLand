import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Monitor,
  Power,
  Star,
  RotateCw,
  Wifi,
  Zap,
  Gauge,
  Maximize,
  Layout,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Separator, Badge } from "@/components/ui/Misc";
import { cn, formatHz } from "@/lib/utils";
import type { Rotation, MonitorConfig, Transform } from "@/types";

const SCALE_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
const ROTATION_OPTIONS: { label: string; value: Rotation }[] = [
  { label: "Normal", value: "normal" },
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
  { label: "Upside Down", value: "flipped" },
];

function parseMode(mode: string): { w: number; h: number; hz: number } | null {
  const m = mode.match(/^(\d+)x(\d+)@([\d.]+)/);
  if (!m) return null;
  return { w: +m[1], h: +m[2], hz: parseFloat(m[3]) };
}

function Field({
  label,
  icon: Icon,
  children,
  hint,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-fg-muted">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      {children}
      {hint && <div className="text-[10px] text-fg-subtle">{hint}</div>}
    </div>
  );
}

export function PropertyPanel() {
  const selected = useStore((s) => s.selectedMonitor());
  const monitors = useStore((s) => s.monitors);
  const update = useStore((s) => s.updateMonitor);
  const setPrimary = useStore((s) => s.setPrimary);
  const toggleEnabled = useStore((s) => s.toggleEnabled);
  const animSpeed = useStore((s) => s.settings.animationSpeed);

  const resolutions = useMemo(() => {
    if (!selected) return [];
    const set = new Set<string>();
    const out: { w: number; h: number; label: string }[] = [];
    for (const mode of selected.availableModes) {
      const p = parseMode(mode);
      if (!p) continue;
      const key = `${p.w}x${p.h}`;
      if (set.has(key)) continue;
      set.add(key);
      out.push({ w: p.w, h: p.h, label: key });
    }
    return out.sort((a, b) => b.w * b.h - a.w * a.h);
  }, [selected]);

  const refreshRates = useMemo(() => {
    if (!selected) return [];
    const out: number[] = [];
    for (const mode of selected.availableModes) {
      const p = parseMode(mode);
      if (!p) continue;
      if (p.w === selected.width && p.h === selected.height) {
        out.push(p.hz);
      }
    }
    out.sort((a, b) => b - a);
    // dedupe close
    const dedup: number[] = [];
    for (const hz of out) {
      if (!dedup.some((x) => Math.abs(x - hz) < 0.1)) dedup.push(hz);
    }
    return dedup;
  }, [selected]);

  if (!selected) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6">
        <Monitor className="h-8 w-8 text-fg-subtle mb-3" />
        <div className="text-sm font-medium text-fg-muted">No monitor selected</div>
        <div className="text-xs text-fg-subtle mt-1">
          Select a monitor on the canvas to edit its properties
        </div>
      </div>
    );
  }

  const m: MonitorConfig = selected;
  // Mirror semantics: selecting A as the source and picking target T makes
  // T clone A (i.e. T.mirrorOf = A.name). A itself stays an independent
  // output. A monitor that already mirrors someone else can't be a target.
  const mirrorTargets = monitors.filter(
    (x) => x.id !== m.id && x.enabled && !x.mirrorOf,
  );
  // The currently-mirroring target (if any) — the monitor cloning this one.
  const currentTarget = monitors.find((x) => x.mirrorOf === m.name);

  const patch = (p: Partial<MonitorConfig>) => update(m.id, p);
  // Mirror this monitor onto `targetId`: make that target clone `m`, and
  // clear any previous target's mirror first.
  const mirrorTo = (targetId: number | null) => {
    // clear old target
    const updates: { id: number; patch: Partial<MonitorConfig> }[] = [];
    if (currentTarget) {
      updates.push({ id: currentTarget.id, patch: { mirrorOf: null } });
    }
    if (targetId != null) {
      updates.push({ id: targetId, patch: { mirrorOf: m.name } });
    }
    // also ensure this monitor isn't itself cloning someone
    if (m.mirrorOf) updates.push({ id: m.id, patch: { mirrorOf: null } });
    for (const u of updates) update(u.id, u.patch);
  };

  return (
    <motion.div
      key={m.id}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 / Math.max(0.1, animSpeed), ease: [0.2, 0.8, 0.2, 1] }}
      className="h-full flex flex-col"
    >
      {/* header */}
      <div className="px-4 pt-4 pb-3 border-b border-border-subtle">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-fg-muted shrink-0" />
              <h3 className="text-sm font-semibold text-fg truncate">{m.name}</h3>
            </div>
            <p className="text-[11px] text-fg-subtle truncate mt-0.5">
              {m.description}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {m.primary && (
              <Badge variant="accent">
                <Star className="h-2.5 w-2.5" /> Primary
              </Badge>
            )}
            {m.focused && <Badge variant="outline">Focused</Badge>}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Button
            size="sm"
            variant={m.enabled ? "danger" : "accent"}
            className="flex-1"
            onClick={() => toggleEnabled(m.id)}
          >
            <Power className="h-3.5 w-3.5" />
            {m.enabled ? "Disable" : "Enable"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={m.primary || !m.enabled}
            onClick={() => setPrimary(m.id)}
          >
            <Star className="h-3.5 w-3.5" />
            Set Primary
          </Button>
        </div>
      </div>

      {/* scrollable fields */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-5">
        {!m.enabled && (
          <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-[11px] text-warning">
            This monitor is disabled. Press Enable to reactivate it.
          </div>
        )}

        <Field label="Resolution" icon={Maximize}>
          <Select
            value={`${m.width}x${m.height}`}
            onValueChange={(v) => {
              const [w, h] = v.split("x").map(Number);
              // pick the highest refresh for that resolution
              const best = m.availableModes
                .map(parseMode)
                .filter((p): p is NonNullable<typeof p> => !!p && p.w === w && p.h === h)
                .sort((a, b) => b.hz - a.hz)[0];
              patch({
                width: w,
                height: h,
                refreshRate: best?.hz ?? m.refreshRate,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {resolutions.map((r) => (
                <SelectItem key={r.label} value={r.label}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Refresh Rate" icon={Gauge} hint="Only supported modes are shown">
          <Select
            value={String(Math.round(m.refreshRate))}
            onValueChange={(v) => patch({ refreshRate: parseFloat(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {refreshRates.map((hz) => (
                <SelectItem key={hz} value={String(Math.round(hz))}>
                  {formatHz(hz)}
                </SelectItem>
              ))}
              {refreshRates.length === 0 && (
                <SelectItem value={String(Math.round(m.refreshRate))}>
                  {formatHz(m.refreshRate)}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Scale" icon={Layout}>
          <Select
            value={String(m.scale)}
            onValueChange={(v) => patch({ scale: parseFloat(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCALE_OPTIONS.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}×
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Rotation" icon={RotateCw}>
          <div className="grid grid-cols-2 gap-1.5">
            {ROTATION_OPTIONS.map((r) => (
              <button
                key={r.value}
                onClick={() => patch({ rotation: r.value, transform: transformFor(r.value) })}
                className={cn(
                  "h-9 rounded-md border text-xs transition-colors",
                  m.rotation === r.value
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border-subtle bg-bg-surface hover:bg-bg-hover text-fg-muted hover:text-fg",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </Field>

        <Separator />

        <Field label="Position" icon={Monitor}>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] text-fg-subtle">X</span>
              <input
                type="number"
                value={m.x}
                onChange={(e) => patch({ x: parseInt(e.target.value) || 0 })}
                className="w-full h-9 rounded-md bg-bg-surface border border-border-subtle px-2 text-sm text-fg focus-ring"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-fg-subtle">Y</span>
              <input
                type="number"
                value={m.y}
                onChange={(e) => patch({ y: parseInt(e.target.value) || 0 })}
                className="w-full h-9 rounded-md bg-bg-surface border border-border-subtle px-2 text-sm text-fg focus-ring"
              />
            </label>
          </div>
        </Field>

        <Separator />

        <Field
          label="Mirror this monitor to"
          icon={Wifi}
          hint="Duplikat output monitor ini ke monitor lain (target akan menampilkan isi monitor ini)"
        >
          <Select
            value={currentTarget ? String(currentTarget.id) : "none"}
            onValueChange={(v) =>
              mirrorTo(v === "none" ? null : Number(v))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No mirror</SelectItem>
              {mirrorTargets.map((o) => (
                <SelectItem key={o.id} value={String(o.id)}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {m.mirrorOf && (
            <div className="text-[10px] text-fg-subtle mt-1">
              Monitor ini sedang duplikat {m.mirrorOf}. Pilih "No mirror" di
              panel {m.mirrorOf} untuk berhenti.
            </div>
          )}
        </Field>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-fg-muted">
              <Zap className="h-3 w-3" />
              Variable Refresh Rate (VRR)
            </div>
            <Switch checked={m.vrr} onCheckedChange={(v) => patch({ vrr: v })} />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-fg-muted">
              <Gauge className="h-3 w-3" />
              Adaptive Sync
            </div>
            <Switch
              checked={m.adaptiveSync}
              onCheckedChange={(v) => patch({ adaptiveSync: v })}
            />
          </div>
        </div>

        <Separator />

        <Field label="Workspace" icon={Layout}>
          <Select
            value={String(m.activeWorkspace)}
            onValueChange={(v) => patch({ activeWorkspace: parseInt(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((i) => (
                <SelectItem key={i} value={String(i)}>
                  Workspace {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-[10px] text-fg-subtle mt-1">
            Generates a Hyprland workspace rule binding this workspace to {m.name}.
          </div>
        </Field>
      </div>
    </motion.div>
  );
}

function transformFor(rotation: Rotation): Transform {
  switch (rotation) {
    case "normal": return 0;
    case "right": return 1;
    case "flipped": return 2;
    case "left": return 3;
  }
}
