import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import {
  computeLayout,
  computeSnap,
  effectiveSize,
  type CanvasMonitor,
  type SnapGuide,
} from "@/lib/layout";
import { MonitorCard } from "./MonitorCard";
import { clamp } from "@/lib/utils";

const MIN_SCALE = 0.04;
const MAX_SCALE = 0.4;

export function DisplayCanvas() {
  const monitors = useStore((s) => s.monitors);
  const selectedId = useStore((s) => s.selectedId);
  const selectMonitor = useStore((s) => s.selectMonitor);
  const setMonitorPosition = useStore((s) => s.setMonitorPosition);
  const animSpeed = useStore((s) => s.settings.animationSpeed);

  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(0.15);
  const [origin, setOrigin] = useState({ x: 120, y: 120 });
  const [panning, setPanning] = useState<null | { x: number; y: number; ox: number; oy: number }>(null);
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const dragState = useRef<{
    id: number;
    startClientX: number;
    startClientY: number;
    startLeft: number;
    startTop: number;
    moved: boolean;
  } | null>(null);

  // measure viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewport({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setViewport({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // auto-fit layout to viewport whenever monitors change structurally
  const layoutSignature = useMemo(
    () =>
      monitors
        .map((m) => `${m.name}:${effectiveSize(m).join("x")}`)
        .join("|"),
    [monitors],
  );
  useEffect(() => {
    if (viewport.w === 0) return;
    const all = monitors;
    if (all.length === 0) return;
    const bounds = all.reduce(
      (acc, m) => {
        const [w, h] = effectiveSize(m);
        return {
          minX: Math.min(acc.minX, m.x),
          minY: Math.min(acc.minY, m.y),
          maxX: Math.max(acc.maxX, m.x + w),
          maxY: Math.max(acc.maxY, m.y + h),
        };
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );
    const w = Math.max(1, bounds.maxX - bounds.minX);
    const h = Math.max(1, bounds.maxY - bounds.minY);
    const pad = 80;
    const sx = (viewport.w - pad * 2) / w;
    const sy = (viewport.h - pad * 2) / h;
    const s = clamp(Math.min(sx, sy), MIN_SCALE, MAX_SCALE);
    setScale(s);
    // center
    setOrigin({
      x: pad + (-bounds.minX) * s,
      y: pad + (-bounds.minY) * s,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutSignature, viewport.w, viewport.h]);

  const layout: CanvasMonitor[] = useMemo(
    () => computeLayout(monitors, scale, origin),
    [monitors, scale, origin],
  );

  // zoom with ctrl+wheel
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = -e.deltaY * 0.0015;
      const next = clamp(scale * (1 + delta), MIN_SCALE, MAX_SCALE);
      const ratio = next / scale;
      setOrigin({
        x: mx - (mx - origin.x) * ratio,
        y: my - (my - origin.y) * ratio,
      });
      setScale(next);
    },
    [scale, origin],
  );

  // pan with middle mouse / space+drag / empty-area drag
  const onContainerPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // start pan on empty area (not on a monitor) or middle button
      const target = e.target as HTMLElement;
      const onMonitor = target.closest("[data-monitor-card]");
      if (e.button === 1 || (!onMonitor && e.button === 0)) {
        setPanning({
          x: e.clientX,
          y: e.clientY,
          ox: origin.x,
          oy: origin.y,
        });
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    },
    [origin],
  );

  const onContainerPointerMove = useCallback(
    (e: React.PointerEvent) => {
      // pan
      if (panning) {
        setOrigin({
          x: panning.ox + (e.clientX - panning.x),
          y: panning.oy + (e.clientY - panning.y),
        });
        return;
      }
      // drag a monitor
      const ds = dragState.current;
      if (!ds) return;
      const dxClient = e.clientX - ds.startClientX;
      const dyClient = e.clientY - ds.startClientY;
      if (!ds.moved && Math.abs(dxClient) + Math.abs(dyClient) > 3) ds.moved = true;
      let newLeft = ds.startLeft + dxClient;
      let newTop = ds.startTop + dyClient;
      // clamp to canvas area
      newLeft = clamp(newLeft, -2000, viewport.w + 2000);
      newTop = clamp(newTop, -2000, viewport.h + 2000);

      const dragged = layout.find((l) => l.config.id === ds.id);
      if (!dragged) return;
      const others = layout.filter((l) => l.config.id !== ds.id);

      const snap = computeSnap(dragged, others, newLeft, newTop, scale, origin);
      newLeft += snap.dx;
      newTop += snap.dy;
      setGuides(snap.guides);

      // convert back to host coords
      const hostX = Math.round((newLeft - origin.x) / scale);
      const hostY = Math.round((newTop - origin.y) / scale);
      setMonitorPosition(ds.id, hostX, hostY);
    },
    [layout, origin, scale, viewport, setMonitorPosition, panning],
  );

  const endDrag = useCallback((e: React.PointerEvent) => {
    if (panning) {
      setPanning(null);
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
    if (dragState.current) {
      const ds = dragState.current;
      const dragged = layout.find((l) => l.config.id === ds.id);
      const others = layout.filter((l) => l.config.id !== ds.id);

      if (dragged && others.length > 0) {
        // Enforce rigid snap (0 gap) on release
        const snap = computeSnap(dragged, others, dragged.left, dragged.top, scale, origin, true);
        if (snap.dx !== 0 || snap.dy !== 0) {
          const finalLeft = dragged.left + snap.dx;
          const finalTop = dragged.top + snap.dy;
          const hostX = Math.round((finalLeft - origin.x) / scale);
          const hostY = Math.round((finalTop - origin.y) / scale);
          setMonitorPosition(ds.id, hostX, hostY);
        }
      }

      dragState.current = null;
      setGuides([]);
    }
  }, [panning, layout, scale, origin, setMonitorPosition]);

  const startMonitorDrag = useCallback(
    (m: CanvasMonitor, e: React.PointerEvent) => {
      if (e.button !== 0) return;
      selectMonitor(m.config.id);
      dragState.current = {
        id: m.config.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startLeft: m.left,
        startTop: m.top,
        moved: false,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [selectMonitor],
  );

  // keyboard nudging for selected monitor (accessibility + precision)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selectedId == null) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const m = monitors.find((x) => x.id === selectedId);
      if (!m || !m.enabled) return;
      const step = e.shiftKey ? 50 : 1;
      let dx = 0;
      let dy = 0;
      switch (e.key) {
        case "ArrowLeft": dx = -step; break;
        case "ArrowRight": dx = step; break;
        case "ArrowUp": dy = -step; break;
        case "ArrowDown": dy = step; break;
        default: return;
      }
      e.preventDefault();
      setMonitorPosition(m.id, m.x + dx, m.y + dy);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, monitors, setMonitorPosition]);

  const empty = monitors.filter((m) => m.enabled).length === 0;

  return (
    <div
      ref={containerRef}
      className={
        "relative h-full w-full overflow-hidden canvas-grid " +
        "rounded-xl border border-border-subtle bg-bg-elevated/40"
      }
      onPointerDown={onContainerPointerDown}
      onPointerMove={onContainerPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={onWheel}
      style={{ cursor: panning ? "grabbing" : "default" }}
    >
      {/* zoom indicator */}
      <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1 surface-flat rounded-md px-2 py-1 text-[10px] text-fg-muted">
        <span>{Math.round(scale * 100)}%</span>
        <button
          className="px-1 hover:text-fg"
          onClick={() => setScale((s) => clamp(s * 1.2, MIN_SCALE, MAX_SCALE))}
        >
          +
        </button>
        <button
          className="px-1 hover:text-fg"
          onClick={() => setScale((s) => clamp(s / 1.2, MIN_SCALE, MAX_SCALE))}
        >
          −
        </button>
      </div>

      {/* legend */}
      <div className="absolute top-3 left-3 z-30 surface-flat rounded-md px-2.5 py-1.5 text-[10px] text-fg-muted flex items-center gap-3">
        <span>Drag to move</span>
        <span>· Ctrl+Scroll to zoom</span>
        <span>· Arrows to nudge</span>
      </div>

      {/* origin crosshair */}
      <div
        className="absolute z-0 pointer-events-none"
        style={{
          left: origin.x - 4,
          top: origin.y - 8,
          width: 1,
          height: 16,
          background: "hsl(var(--accent) / 0.5)",
        }}
      />
      <div
        className="absolute z-0 pointer-events-none"
        style={{
          left: origin.x - 8,
          top: origin.y - 4,
          width: 16,
          height: 1,
          background: "hsl(var(--accent) / 0.5)",
        }}
      />

      {/* snap guides */}
      <svg className="absolute inset-0 z-20 pointer-events-none w-full h-full">
        {guides.map((g, i) =>
          g.axis === "x" ? (
            <line
              key={i}
              x1={g.pos}
              y1={g.from}
              x2={g.pos}
              y2={g.to}
              stroke="hsl(var(--accent))"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          ) : (
            <line
              key={i}
              x1={g.from}
              y1={g.pos}
              x2={g.to}
              y2={g.pos}
              stroke="hsl(var(--accent))"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          ),
        )}
      </svg>

      {/* monitors */}
      {layout.map((m) => (
        <div key={m.config.id} data-monitor-card>
          <MonitorCard
            monitor={m.config}
            selected={selectedId === m.config.id}
            scale={scale}
            left={m.left}
            top={m.top}
            width={m.width}
            height={m.height}
            onPointerDown={(e) => {
              e.stopPropagation();
              startMonitorDrag(m, e);
            }}
          />
        </div>
      ))}

      {/* disabled monitors render on canvas with overlay (see MonitorCard);
          a small hint list lets users locate them if pushed off-screen */}
      {monitors.some((m) => !m.enabled) && (
        <div className="absolute bottom-3 left-3 z-30 flex flex-wrap gap-1.5 max-w-[60%]">
          {monitors
            .filter((m) => !m.enabled)
            .map((m) => (
              <motion.button
                key={m.id}
                className="surface-flat rounded-md px-2 py-1 text-[10px] text-fg-muted hover:text-fg"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => selectMonitor(m.id)}
                transition={{ duration: 0.15 / Math.max(0.1, animSpeed) }}
              >
                {m.name} (disabled)
              </motion.button>
            ))}
        </div>
      )}

      {empty && (
        <div className="absolute inset-0 flex items-center justify-center z-30">
          <div className="text-center">
            <div className="text-sm text-fg-muted">No active monitors</div>
            <div className="text-xs text-fg-subtle mt-1">
              Enable a monitor from the property panel
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
