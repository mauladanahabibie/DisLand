/**
 * Shared type definitions for DisplaySet.
 * These mirror the Rust structs exposed through Tauri commands
 * (see src-tauri/src/hyprland/models.rs).
 */

export type Transform = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Rotation = "normal" | "left" | "right" | "flipped";
export const ROTATION_TO_TRANSFORM: Record<Rotation, Transform> = {
  normal: 0,
  left: 3,
  right: 1,
  flipped: 2,
};
export const TRANSFORM_TO_ROTATION: Record<number, Rotation> = {
  0: "normal",
  1: "right",
  2: "flipped",
  3: "left",
};

/** A single resolution@refresh mode reported by Hyprland, e.g. "1920x1080@144.00Hz". */
export interface DisplayMode {
  width: number;
  height: number;
  refresh: number;
  raw: string;
}

/** Workspace as reported by hyprctl. */
export interface HyprWorkspace {
  id: number;
  name: string;
  monitor: string;
}

/** Workspace info from `hyprctl workspaces -j` (camelCased fields mapped in Rust). */
export interface HyprWorkspaceInfo {
  id: number;
  name: string;
  monitor: string;
  monitorId: number;
}

/** Raw monitor object from `hyprctl monitors -j`. */
export interface HyprMonitor {
  id: number;
  name: string;
  description: string;
  make: string;
  model: string;
  serial: string;
  width: number;
  height: number;
  physicalWidth: number;
  physicalHeight: number;
  refreshRate: number;
  x: number;
  y: number;
  activeWorkspace: { id: number; name: string };
  reserved: [number, number, number, number];
  scale: number;
  transform: number;
  focused: boolean;
  dpmsStatus: boolean;
  vrr: boolean;
  disabled: boolean;
  mirrorOf: string;
  availableModes: string[];
}

/** Internal editable representation of a monitor configuration. */
export interface MonitorConfig {
  id: number;
  name: string;
  description: string;
  width: number;
  height: number;
  refreshRate: number;
  scale: number;
  x: number;
  y: number;
  transform: Transform;
  rotation: Rotation;
  focused: boolean;
  enabled: boolean;
  primary: boolean;
  vrr: boolean;
  adaptiveSync: boolean;
  mirrorOf: string | null;
  activeWorkspace: number;
  availableModes: string[];
}

/** A backup snapshot of the entire monitor layout. */
export interface BackupSnapshot {
  id: string;
  createdAt: number;
  monitors: MonitorConfig[];
  rawConfig: string;
}

/** Validation result returned by the validation engine. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** Apply result. */
export interface ApplyResult {
  success: boolean;
  message: string;
  applied: boolean;
  backupId?: string;
  rolledBack?: boolean;
  errors?: string[];
}

/** A stored display profile. */
export interface DisplayProfile {
  id: string;
  name: string;
  icon?: string;
  createdAt: number;
  updatedAt: number;
  monitors: MonitorConfig[];
  primaryMonitor: string | null;
  wallpaper: string | null;
  workspaceRules: WorkspaceRule[];
}

export interface WorkspaceRule {
  workspace: string;
  monitor: string;
}

/** Quick layout presets. `externalFirst` picks the largest enabled non-laptop
 *  monitor as "external"; laptop = eDP-* / LVDS-*. */
export type LayoutPreset =
  | "side-by-side-left"   // external left, laptop right
  | "side-by-side-right"  // laptop left, external right
  | "stacked-top"         // external top, laptop bottom
  | "stacked-bottom"      // laptop top, external bottom
  | "mirror";             // laptop mirrors external (or vice versa)

/** Global application settings. */
export interface AppSettings {
  theme: "dark" | "light";
  accent: AccentColor;
  language: string;
  animationSpeed: number; // 0.5 - 2.0 multiplier
  autoBackup: boolean;
  autoDetect: boolean;
  confirmBeforeApply: boolean;
  backupCount: number;
}

export type AccentColor =
  | "blue"
  | "violet"
  | "emerald"
  | "rose"
  | "amber"
  | "cyan";

export const ACCENT_HUES: Record<AccentColor, number> = {
  blue: 220,
  violet: 265,
  emerald: 152,
  rose: 345,
  amber: 38,
  cyan: 190,
};

/** Result of a hotplug detection check. */
export interface HotplugEvent {
  connected: string[];
  disconnected: string[];
  monitors: HyprMonitor[];
}
