import { create } from "zustand";
import { api, isTauri } from "@/lib/api";
import { toast } from "@/hooks/useToast";
import type {
  MonitorConfig,
  AppSettings,
  DisplayProfile,
  WorkspaceRule,
  HyprWorkspace,
  AccentColor,
  LayoutPreset,
} from "@/types";
import { ACCENT_HUES } from "@/types";
import { uid } from "@/lib/utils";

const STORAGE_KEY = "displayset:monitors";

/** Persist the current monitor list to localStorage so disabled / mirrored
 *  monitors (which `hyprctl monitors -j` omits) survive an app restart. */
function persistMonitors(monitors: MonitorConfig[]) {
  // Never overwrite valid persisted data with an empty array: the store's
  // initial state (before `init` resolves) is `[]`, and writing that would
  // wipe the disabled/mirrored monitors we're trying to preserve across
  // restarts.
  if (monitors.length === 0) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(monitors));
  } catch {
    /* quota / private mode — ignore */
  }
}

/** Load previously persisted monitors. Returns [] on miss / parse error. */
function loadPersistedMonitors(): MonitorConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MonitorConfig[]) : [];
  } catch {
    return [];
  }
}

const PRIMARY_KEY = "displayset:primary";

/** Remember the user-chosen primary monitor name across refreshes. The backend
 *  re-infers primary from focus/origin on every snapshot, which would override
 *  the user's choice after Apply; we restore it client-side instead. */
function persistPrimaryName(name: string | null) {
  try {
    if (name) localStorage.setItem(PRIMARY_KEY, name);
    else localStorage.removeItem(PRIMARY_KEY);
  } catch {
    /* ignore */
  }
}
function loadPrimaryName(): string | null {
  try {
    return localStorage.getItem(PRIMARY_KEY);
  } catch {
    return null;
  }
}

/** Re-apply the persisted primary choice to a freshly loaded monitor list. */
function restorePrimary(monitors: MonitorConfig[]): MonitorConfig[] {
  const wanted = loadPrimaryName();
  if (!wanted) return monitors;
  const has = monitors.some((m) => m.name === wanted && m.enabled);
  if (!has) return monitors;
  return monitors.map((m) => ({ ...m, primary: m.name === wanted }));
}

/** Development fallback so the UI works in a plain browser (no Tauri). */
function mockMonitors(): MonitorConfig[] {
  const mk = (
    id: number,
    name: string,
    description: string,
    width: number,
    height: number,
    refreshRate: number,
    x: number,
    y: number,
    extra: Partial<MonitorConfig> = {},
  ): MonitorConfig => ({
    id,
    name,
    description,
    width,
    height,
    refreshRate,
    scale: 1,
    x,
    y,
    transform: 0,
    rotation: "normal",
    focused: id === 1,
    enabled: true,
    primary: id === 1,
    vrr: false,
    adaptiveSync: false,
    mirrorOf: null,
    activeWorkspace: id,
    availableModes: [
      `${width}x${height}@${refreshRate.toFixed(2)}Hz`,
      `${width}x${height}@60.00Hz`,
      `${width}x${height}@120.00Hz`,
    ],
    ...extra,
  });
  return [
    mk(1, "HDMI-A-5", "SKYDATA H27G30Q", 2560, 1440, 144, 0, 0, {
      availableModes: [
        "2560x1440@144.00Hz",
        "2560x1440@120.00Hz",
        "2560x1440@59.95Hz",
        "1920x1080@60.00Hz",
      ],
    }),
    mk(0, "eDP-1", "AU Optronics 0x7EAD", 1920, 1080, 144, 320, 1440, {
      focused: false,
      primary: false,
      availableModes: ["1920x1080@144.00Hz", "1920x1080@60.00Hz"],
    }),
  ];
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  accent: "blue",
  language: "en",
  animationSpeed: 1,
  autoBackup: true,
  autoDetect: true,
  confirmBeforeApply: true,
  backupCount: 8,
};

interface StoreState {
  // data
  monitors: MonitorConfig[];
  workspaces: HyprWorkspace[];
  profiles: DisplayProfile[];
  settings: AppSettings;
  lastBackupId: string | null;

  // ui
  selectedId: number | null;
  loading: boolean;
  applying: boolean;
  dirty: boolean;
  knownMonitorNames: string[]; // for hotplug detection
  lastValidation: import("@/types").ValidationResult | null;
  previewMode: boolean;

  // derived helpers
  selectedMonitor: () => MonitorConfig | null;

  // actions
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  selectMonitor: (id: number | null) => void;
  updateMonitor: (id: number, patch: Partial<MonitorConfig>) => void;
  setMonitorPosition: (id: number, x: number, y: number) => void;
  setPrimary: (id: number) => void;
  applyLayoutPreset: (preset: LayoutPreset) => void;
  toggleEnabled: (id: number) => void;

  validate: () => Promise<import("@/types").ValidationResult>;
  apply: () => Promise<boolean>;
  rollbackNow: () => Promise<void>;
  loadProfiles: () => Promise<void>;
  saveCurrentAsProfile: (name: string) => Promise<void>;
  applyProfile: (profile: DisplayProfile) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  duplicateProfile: (id: string, newName: string) => Promise<void>;
  exportProfile: (id: string) => Promise<string>;
  importProfile: (json: string) => Promise<void>;

  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;

  setPreviewMode: (v: boolean) => void;
  discardChanges: () => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  monitors: [],
  workspaces: [],
  profiles: [],
  settings: DEFAULT_SETTINGS,
  lastBackupId: null,
  selectedId: null,
  loading: false,
  applying: false,
  dirty: false,
  knownMonitorNames: [],
  lastValidation: null,
  previewMode: false,

  selectedMonitor: () => {
    const { monitors, selectedId } = get();
    return monitors.find((m) => m.id === selectedId) ?? null;
  },
  init: async () => {
    set({ loading: true });
    if (!isTauri()) {
      const monitors = mockMonitors();
      set({
        monitors,
        knownMonitorNames: monitors.map((m) => m.name),
        loading: false,
      });
      return;
    }
    try {
      const [fresh, settings] = await Promise.all([
        api.listMonitors(),
        api.getSettings(),
      ]);
      // Re-inject monitors that hyprctl drops (disabled / mirrored) from a
      // previously persisted snapshot so the canvas always shows every known
      // monitor, even after an app restart.
      const persisted = loadPersistedMonitors();
      const seenNames = new Set(fresh.map((m) => m.name));
      const restored = persisted.filter((m) => !seenNames.has(m.name));
      const merged = restorePrimary([...fresh, ...restored]);
      persistMonitors(merged);
      set({
        monitors: merged,
        settings,
        knownMonitorNames: merged.map((m) => m.name),
        loading: false,
        selectedId: merged.find((m) => m.focused)?.id ?? merged[0]?.id ?? null,
      });
      await get().loadProfiles();
    } catch (e) {
      toast.error("Failed to load monitors", String(e));
      set({ loading: false });
    }
  },

  refresh: async () => {
    if (!isTauri()) {
      set({ monitors: mockMonitors(), dirty: false });
      return;
    }
    try {
      const [fresh, workspaces] = await Promise.all([
        api.listMonitors(),
        api.listWorkspaces().catch(() => []),
      ]);
      // hyprctl drops disabled monitors from its JSON output entirely.
      // Re-inject any known monitor that vanished — it was disabled.
      const prev = get().monitors;
      const seenNames = new Set(fresh.map((m) => m.name));
      const knownDisabled = prev.filter((m) => !seenNames.has(m.name));
      const merged = restorePrimary([...fresh, ...knownDisabled]);
      persistMonitors(merged);
      set({
        monitors: merged,
        workspaces: workspaces.map((w) => ({
          id: w.id,
          name: w.name,
          monitor: w.monitor,
        })),
        knownMonitorNames: merged.map((m) => m.name),
        dirty: false,
      });
    } catch (e) {
      toast.error("Refresh failed", String(e));
    }
  },

  selectMonitor: (id) => set({ selectedId: id }),

  updateMonitor: (id, patch) =>
    set((s) => {
      let next = s.monitors.map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      );
      // When clearing a mirror (mirrorOf -> null), the monitor re-becomes an
      // independent output. If it was flagged primary by a mirror preset and
      // another monitor is also primary, drop this one's primary to avoid
      // "found 2 primary" validation errors.
      const wasMirroring = s.monitors.find((m) => m.id === id)?.mirrorOf;
      const clearingMirror = Boolean(wasMirroring) && patch.mirrorOf === null;
      if (clearingMirror) {
        const primaries = next.filter((m) => m.primary && m.enabled);
        if (primaries.length > 1) {
          next = next.map((m) =>
            m.id === id ? { ...m, primary: false } : m,
          );
        }
      }
      return { monitors: next, dirty: true };
    }),

  setMonitorPosition: (id, x, y) =>
    set((s) => ({
      monitors: s.monitors.map((m) =>
        m.id === id ? { ...m, x: Math.round(x), y: Math.round(y) } : m,
      ),
      dirty: true,
    })),

  setPrimary: (id) =>
    set((s) => {
      const chosen = s.monitors.find((m) => m.id === id);
      persistPrimaryName(chosen ? chosen.name : null);
      return {
        monitors: s.monitors.map((m) => ({ ...m, primary: m.id === id })),
        dirty: true,
      };
    }),

  applyLayoutPreset: (preset) => {
    const { monitors } = get();
    if (monitors.length === 0) return;

    // Identify laptop (eDP-* / LVDS-*) vs external (everything else).
    const isLaptop = (m: MonitorConfig) =>
      /^eDP-|^LVDS/i.test(m.name);
    // Ensure monitors are enabled + cleared of mirroring for layout presets.
    const base = monitors.map((m) => ({
      ...m,
      enabled: true,
      mirrorOf: null,
    }));

    // For 2-monitor presets, split into laptop + external. If no laptop
    // detected, fall back to largest-by-pixels = external, other = primary.
    let external = base.find((m) => !isLaptop(m));
    let laptop = base.find((m) => isLaptop(m));
    if (base.length >= 2 && (!external || !laptop)) {
      // sort by pixel area desc; first = external, last = laptop surrogate
      const sorted = [...base].sort(
        (a, b) => b.width * b.height - a.width * a.height,
      );
      external = external ?? sorted[0];
      laptop = laptop ?? sorted[sorted.length - 1];
    }

    const eff = (m: MonitorConfig): [number, number] =>
      m.rotation === "left" || m.rotation === "right"
        ? [m.height, m.width]
        : [m.width, m.height];

    let next: MonitorConfig[];

    if (preset === "mirror") {
      // external is the source; laptop mirrors it (if we have both).
      const src = external ?? base[0];
      next = base.map((m) =>
        m.id === src.id
          ? { ...m, mirrorOf: null, x: 0, y: 0 }
          : { ...m, mirrorOf: src.name, x: 0, y: 0 },
      );
    } else if (base.length === 1) {
      // single monitor — nothing to arrange, just normalize
      next = base.map((m) => ({ ...m, x: 0, y: 0 }));
    } else {
      const ext = external!;
      const lap = laptop!;
      const place = (primary: MonitorConfig, secondary: MonitorConfig) => {
        // primary at origin; secondary to the right, vertically centered
        // against the primary so a smaller laptop isn't glued to the top.
        const [pw, ph] = eff(primary);
        const [, sh] = eff(secondary);
        return [
          { ...primary, x: 0, y: 0 },
          { ...secondary, x: pw, y: Math.max(0, Math.round((ph - sh) / 2)) },
        ];
      };
      const placeV = (primary: MonitorConfig, secondary: MonitorConfig) => {
        // primary at origin; secondary below, horizontally centered against
        // the primary so a smaller laptop sits in the middle, not left-edge.
        const [pw, ph] = eff(primary);
        const [sw] = eff(secondary);
        return [
          { ...primary, x: 0, y: 0 },
          { ...secondary, x: Math.max(0, Math.round((pw - sw) / 2)), y: ph },
        ];
      };

      let arranged: MonitorConfig[] = [];
      switch (preset) {
        case "side-by-side-left": // external left, laptop right
          arranged = place(ext, lap);
          break;
        case "side-by-side-right": // laptop left, external right
          arranged = place(lap, ext);
          break;
        case "stacked-top": // external top, laptop bottom
          arranged = placeV(ext, lap);
          break;
        case "stacked-bottom": // laptop top, external bottom
          arranged = placeV(lap, ext);
          break;
      }
      // map back over any extra monitors (keep them enabled at origin-ish)
      const arrangedIds = new Set(arranged.map((m) => m.id));
      const extras = base.filter((m) => !arrangedIds.has(m.id));
      next = [...arranged, ...extras];
    }

    // pick a sensible primary: external for side-by-side-left / stacked-top,
    // laptop for the mirrored variants; first arranged monitor otherwise.
    const primaryId =
      preset === "mirror"
        ? (external ?? next[0]).id
        : preset === "side-by-side-right" || preset === "stacked-bottom"
          ? (laptop ?? next[0]).id
          : (external ?? next[0]).id;
    next = next.map((m) => ({ ...m, primary: m.id === primaryId }));

    set({ monitors: next, dirty: true });
    toast.info(
      "Layout preset applied",
      "Press Apply to activate the new arrangement.",
    );
  },

  toggleEnabled: (id) =>
    set((s) => {
      const target = s.monitors.find((m) => m.id === id);
      const disabling = target?.enabled;
      const wasPrimary = target?.primary;
      let next = s.monitors.map((m) =>
        m.id === id ? { ...m, enabled: !m.enabled } : m,
      );
      // If we just disabled the primary, move primary to another enabled
      // monitor so validation never sees two primaries on re-enable.
      if (disabling && wasPrimary) {
        const fallback = next.find((m) => m.enabled && m.id !== id);
        next = next.map((m) => ({
          ...m,
          primary: fallback ? m.id === fallback.id : false,
        }));
      }
      return { monitors: next, dirty: true };
    }),

  validate: async () => {
    const { monitors } = get();
    if (!isTauri()) {
      // light client-side check
      const enabled = monitors.filter((m) => m.enabled);
      const res: import("@/types").ValidationResult = {
        valid: enabled.length > 0,
        errors: enabled.length === 0 ? ["No enabled monitors"] : [],
        warnings: [],
      };
      set({ lastValidation: res });
      return res;
    }
    try {
      const res = await api.validateConfig(monitors);
      set({ lastValidation: res });
      return res;
    } catch (e) {
      const res = {
        valid: false,
        errors: [String(e)],
        warnings: [],
      } as import("@/types").ValidationResult;
      set({ lastValidation: res });
      return res;
    }
  },

  apply: async () => {
    const { monitors } = get();
    set({ applying: true });
    try {
      // validate first
      const validation = await get().validate();
      if (!validation.valid) {
        toast.error(
          "Cannot apply",
          validation.errors.join("\n") || "Validation failed",
        );
        set({ applying: false });
        return false;
      }

      // workspace rules from current workspace assignment (workspace id -> monitor name)
      const workspaceRules: WorkspaceRule[] = [];
      const seen = new Set<string>();
      for (const m of monitors) {
        if (m.enabled && m.activeWorkspace > 0) {
          const key = String(m.activeWorkspace);
          if (!seen.has(key)) {
            seen.add(key);
            workspaceRules.push({ workspace: key, monitor: m.name });
          }
        }
      }

      if (!isTauri()) {
        toast.success("Applied (dev mode)", "Configuration would be sent to Hyprland.");
        set({ applying: false, dirty: false, previewMode: false });
        return true;
      }

      const outcome = await api.applyConfig(monitors, workspaceRules);
      if (outcome.success) {
        toast.success("Applied", outcome.message);
        set({ dirty: false, previewMode: false, lastBackupId: outcome.backupId ?? null });
        await get().refresh();
        return true;
      } else {
        toast.error(outcome.message, outcome.errors.join("\n") || undefined);
        if (outcome.rolledBack) {
          await get().refresh();
        }
        return false;
      }
    } catch (e) {
      toast.error("Apply failed", String(e));
      return false;
    } finally {
      set({ applying: false });
    }
  },

  rollbackNow: async () => {
    if (!isTauri()) {
      toast.info("Rollback (dev mode)", "Would restore previous configuration.");
      return;
    }
    try {
      await api.rollback();
      toast.success("Rolled back", "Previous configuration restored.");
      await get().refresh();
    } catch (e) {
      toast.error("Rollback failed", String(e));
    }
  },

  loadProfiles: async () => {
    if (!isTauri()) {
      set({ profiles: [] });
      return;
    }
    try {
      const profiles = await api.listProfiles();
      set({ profiles });
    } catch (e) {
      console.warn("loadProfiles failed", e);
    }
  },

  saveCurrentAsProfile: async (name) => {
    const { monitors } = get();
    const primary = monitors.find((m) => m.primary)?.name ?? null;
    if (!isTauri()) {
      const profile: DisplayProfile = {
        id: uid("p"),
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        monitors,
        primaryMonitor: primary,
        wallpaper: null,
        workspaceRules: [],
      };
      set((s) => ({ profiles: [...s.profiles, profile] }));
      toast.success("Profile saved (dev)", name);
      return;
    }
    try {
      await api.createProfile(name, monitors, primary);
      await get().loadProfiles();
      toast.success("Profile saved", name);
    } catch (e) {
      toast.error("Save profile failed", String(e));
    }
  },

  applyProfile: async (profile) => {
    set({
      monitors: profile.monitors.map((m) => ({ ...m })),
      dirty: true,
      selectedId: profile.monitors[0]?.id ?? null,
    });
    toast.info("Profile loaded", `${profile.name} — press Apply to activate.`);
  },

  deleteProfile: async (id) => {
    if (!isTauri()) {
      set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) }));
      return;
    }
    try {
      await api.deleteProfile(id);
      await get().loadProfiles();
      toast.success("Profile deleted");
    } catch (e) {
      toast.error("Delete failed", String(e));
    }
  },

  duplicateProfile: async (id, newName) => {
    if (!isTauri()) {
      const src = get().profiles.find((p) => p.id === id);
      if (!src) return;
      const copy = {
        ...src,
        id: uid("p"),
        name: newName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      set((s) => ({ profiles: [...s.profiles, copy] }));
      return;
    }
    try {
      await api.duplicateProfile(id, newName);
      await get().loadProfiles();
      toast.success("Profile duplicated", newName);
    } catch (e) {
      toast.error("Duplicate failed", String(e));
    }
  },

  exportProfile: async (id) => {
    if (!isTauri()) {
      const p = get().profiles.find((x) => x.id === id);
      return JSON.stringify(p, null, 2);
    }
    return api.exportProfile(id);
  },

  importProfile: async (json) => {
    if (!isTauri()) {
      try {
        const p = JSON.parse(json) as DisplayProfile;
        set((s) => ({ profiles: [...s.profiles, { ...p, id: uid("p") }] }));
        toast.success("Profile imported");
      } catch {
        toast.error("Invalid profile JSON");
      }
      return;
    }
    try {
      await api.importProfile(json);
      await get().loadProfiles();
      toast.success("Profile imported");
    } catch (e) {
      toast.error("Import failed", String(e));
    }
  },

  updateSettings: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    if (!isTauri()) return;
    try {
      await api.saveSettings(next);
      if (patch.backupCount) await api.setBackupCount(patch.backupCount);
    } catch (e) {
      toast.error("Settings save failed", String(e));
    }
  },

  resetSettings: async () => {
    set({ settings: DEFAULT_SETTINGS });
    if (!isTauri()) return;
    try {
      await api.resetSettings();
      toast.success("Settings reset");
    } catch (e) {
      toast.error("Reset failed", String(e));
    }
  },

  setPreviewMode: (v) => set({ previewMode: v }),

  discardChanges: async () => {
    await get().refresh();
    set({ previewMode: false });
    toast.info("Changes discarded", "Reverted to current monitor state.");
  },
}));

// Persist the monitor list to localStorage whenever it changes, so disabled /
// mirrored monitors (omitted by hyprctl) survive an app restart.
useStore.subscribe((s) => persistMonitors(s.monitors));

/** Apply CSS variables for theme + accent whenever settings change. */
export function applyThemeToDocument(theme: AppSettings["theme"], accent: AccentColor) {
  const root = document.documentElement;
  if (theme === "light") {
    root.classList.remove("dark");
    root.classList.add("light");
  } else {
    root.classList.remove("light");
    root.classList.add("dark");
  }
  root.style.setProperty("--accent-h", String(ACCENT_HUES[accent]));
}
