import type { MonitorConfig } from "@/types";
import { snap } from "@/lib/utils";


/** A computed visual representation of a monitor on the canvas. */
export interface CanvasMonitor {
  config: MonitorConfig;
  // pixel position/size on the canvas (already scaled)
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Edges derived from a CanvasMonitor for snap math. */
interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
}

function toBox(left: number, top: number, width: number, height: number): Box {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    cx: left + width / 2,
    cy: top + height / 2,
  };
}

export interface SnapGuide {
  axis: "x" | "y";
  pos: number; // canvas coordinate of the guide line
  from: number; // canvas start
  to: number; // canvas end
}

export interface SnapResult {
  dx: number; // offset to add to dragged monitor's x to snap
  dy: number;
  guides: SnapGuide[];
}

/**
 * Compute the visual layout of all monitors on the canvas given a scale
 * (pixels-per-host-pixel) and an origin offset.
 */
export function computeLayout(
  monitors: MonitorConfig[],
  scale: number,
  origin: { x: number; y: number },
): CanvasMonitor[] {
  return monitors.map((config) => {
    const [w, h] = effectiveSize(config);
    return {
      config,
      left: origin.x + config.x * scale,
      top: origin.y + config.y * scale,
      width: w * scale,
      height: h * scale,
    };
  });
}

/** Host-pixel width/height accounting for rotation. */
export function effectiveSize(m: MonitorConfig): [number, number] {
  const rotated = m.rotation === "left" || m.rotation === "right";
  return rotated ? [m.height, m.width] : [m.width, m.height];
}

// Magnetic snap distance in SCREEN (canvas) pixels. Within this on-screen
// distance of another monitor's edge, the dragged monitor snaps flush
// (0 px gap) on that axis. Kept in screen space so the magnetic "feel" is
// identical at every zoom level — a host-pixel threshold would shrink to a
// couple of screen pixels at low zoom and be impossible to hit.
const SNAP_THRESHOLD_SCREEN = 32;

/**
 * Windows-style magnetic edge snap. For the dragged monitor we find the
 * single nearest edge pair (left↔right, right↔left, top↔bottom, bottom↔top)
 * across all other monitors. If it is within threshold we snap THAT axis only
 * so the two edges touch with 0 gap; the perpendicular axis is left untouched
 * and stays freely draggable (sliding along the touching edge). Center/edge
 * alignment is never forced. Returns canvas-pixel deltas for the drag handler
 * + guide lines rendered in canvas coords.
 */
export function computeSnap(
  dragged: CanvasMonitor,
  others: CanvasMonitor[],
  newLeft: number,
  newTop: number,
  scale: number,
  origin: { x: number; y: number },
  isDrop: boolean = false
): SnapResult {
  if (others.length === 0) return { dx: 0, dy: 0, guides: [] };

  // Dragged monitor in host coords.
  const hx = (newLeft - origin.x) / scale;
  const hy = (newTop - origin.y) / scale;
  const [dw, dh] = effectiveSize(dragged.config);
  const dBox = toBox(hx, hy, dw, dh);

  // Convert the screen-space threshold to host pixels for this zoom level.
  const thresholdHost = SNAP_THRESHOLD_SCREEN / scale;

  type Cand = { axis: "x" | "y"; dist: number; deltaX: number; deltaY: number; ob: Box };
  let best: Cand | null = null;

  for (const o of others) {
    const [ow, oh] = effectiveSize(o.config);
    const ob = toBox(o.config.x, o.config.y, ow, oh);

    const overlapY = dBox.bottom > ob.top && dBox.top < ob.bottom;
    const overlapX = dBox.right > ob.left && dBox.left < ob.right;

    if (!isDrop) {
      // Dragging: Snap only if overlapping, leave other axis free.
      if (overlapY) {
        const dx1 = ob.right - dBox.left;
        if (Math.abs(dx1) < thresholdHost && (!best || Math.abs(dx1) < best.dist))
          best = { axis: "x", dist: Math.abs(dx1), deltaX: dx1, deltaY: 0, ob };
        const dx2 = ob.left - dBox.right;
        if (Math.abs(dx2) < thresholdHost && (!best || Math.abs(dx2) < best.dist))
          best = { axis: "x", dist: Math.abs(dx2), deltaX: dx2, deltaY: 0, ob };
      }
      if (overlapX) {
        const dy1 = ob.bottom - dBox.top;
        if (Math.abs(dy1) < thresholdHost && (!best || Math.abs(dy1) < best.dist))
          best = { axis: "y", dist: Math.abs(dy1), deltaX: 0, deltaY: dy1, ob };
        const dy2 = ob.top - dBox.bottom;
        if (Math.abs(dy2) < thresholdHost && (!best || Math.abs(dy2) < best.dist))
          best = { axis: "y", dist: Math.abs(dy2), deltaX: 0, deltaY: dy2, ob };
      }
    } else {
      // Dropping: Must snap to the absolute closest touching valid segment
      // Segment 1: Right edge
      const clampY1 = Math.max(ob.top - dh + 1, Math.min(dBox.top, ob.bottom - 1));
      const dx1 = ob.right - dBox.left;
      const dy1 = clampY1 - dBox.top;
      const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      if (!best || dist1 < best.dist) best = { axis: "x", dist: dist1, deltaX: dx1, deltaY: dy1, ob };

      // Segment 2: Left edge
      const clampY2 = Math.max(ob.top - dh + 1, Math.min(dBox.top, ob.bottom - 1));
      const dx2 = ob.left - dBox.right;
      const dy2 = clampY2 - dBox.top;
      const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      if (!best || dist2 < best.dist) best = { axis: "x", dist: dist2, deltaX: dx2, deltaY: dy2, ob };

      // Segment 3: Bottom edge
      const clampX1 = Math.max(ob.left - dw + 1, Math.min(dBox.left, ob.right - 1));
      const dy3 = ob.bottom - dBox.top;
      const dx3 = clampX1 - dBox.left;
      const dist3 = Math.sqrt(dx3 * dx3 + dy3 * dy3);
      if (!best || dist3 < best.dist) best = { axis: "y", dist: dist3, deltaX: dx3, deltaY: dy3, ob };

      // Segment 4: Top edge
      const clampX2 = Math.max(ob.left - dw + 1, Math.min(dBox.left, ob.right - 1));
      const dy4 = ob.top - dBox.bottom;
      const dx4 = clampX2 - dBox.left;
      const dist4 = Math.sqrt(dx4 * dx4 + dy4 * dy4);
      if (!best || dist4 < best.dist) best = { axis: "y", dist: dist4, deltaX: dx4, deltaY: dy4, ob };
    }
  }

  let bestDx = 0;
  let bestDy = 0;
  const guides: SnapGuide[] = [];

  if (best) {
    bestDx = best.deltaX;
    bestDy = best.deltaY;

    // Guide line along the touching edge.
    if (best.axis === "x") {
      const anchorX = dBox.left + bestDx; // host coord of the touching vertical edge
      const tops = [dBox.top + bestDy, ...others.map((o) => o.config.y)];
      const bottoms = [
        dBox.bottom + bestDy,
        ...others.map((o) => o.config.y + effectiveSize(o.config)[1]),
      ];
      guides.push({
        axis: "x",
        pos: origin.x + anchorX * scale,
        from: origin.y + Math.min(...tops) * scale - 6,
        to: origin.y + Math.max(...bottoms) * scale + 6,
      });
    } else {
      const anchorY = dBox.top + bestDy;
      const lefts = [dBox.left + bestDx, ...others.map((o) => o.config.x)];
      const rights = [
        dBox.right + bestDx,
        ...others.map((o) => o.config.x + effectiveSize(o.config)[0]),
      ];
      guides.push({
        axis: "y",
        pos: origin.y + anchorY * scale,
        from: origin.x + Math.min(...lefts) * scale - 6,
        to: origin.x + Math.max(...rights) * scale + 6,
      });
    }
  }

  return { dx: bestDx * scale, dy: bestDy * scale, guides };
}

/** Snap to a coarse grid (for arrow-key nudging). */
export function snapToGrid(value: number, grid: number) {
  return snap(value, grid);
}
