import { invoke } from "@tauri-apps/api/core";
import type { MonitorConfig, ValidationResult, AppSettings, DisplayProfile, WorkspaceRule, HyprWorkspace } from "@/types";

/** IPC bindings — thin typed wrappers around Tauri commands.
 *  Each function corresponds to a `#[tauri::command]` in src-tauri/src/commands.rs.
 */

export const api = {
  ping: () => invoke<string>("ping"),

  listMonitors: () => invoke<MonitorConfig[]>("list_monitors"),
  listWorkspaces: () => invoke<HyprWorkspace[]>("list_workspaces"),
  detectHotplug: (known: string[]) =>
    invoke<{ connected: string[]; disconnected: string[] }>("detect_hotplug", { known }),

  validateConfig: (configs: MonitorConfig[]) =>
    invoke<ValidationResult>("validate_config", { configs }),

  backupCurrent: () =>
    invoke<{ id: string; createdAt: number; monitors: MonitorConfig[]; rawConfig: string }>(
      "backup_current",
    ),
  listBackups: () =>
    invoke<{ id: string; createdAt: number; monitors: MonitorConfig[]; rawConfig: string }[]>(
      "list_backups",
    ),
  rollback: () => invoke<void>("rollback"),

  applyConfig: (configs: MonitorConfig[], workspaceRules: WorkspaceRule[]) =>
    invoke<{
      success: boolean;
      message: string;
      applied: boolean;
      rolledBack: boolean;
      errors: string[];
      backupId?: string;
    }>("apply_config", { configs, workspaceRules }),

  listProfiles: () => invoke<DisplayProfile[]>("list_profiles"),
  saveProfile: (profile: DisplayProfile) =>
    invoke<DisplayProfile>("save_profile", { profile }),
  deleteProfile: (id: string) => invoke<void>("delete_profile", { id }),
  duplicateProfile: (id: string, newName: string) =>
    invoke<DisplayProfile>("duplicate_profile", { id, newName }),
  exportProfile: (id: string) => invoke<string>("export_profile", { id }),
  importProfile: (json: string) => invoke<DisplayProfile>("import_profile", { json }),
  createProfile: (
    name: string,
    monitors: MonitorConfig[],
    primaryMonitor: string | null,
  ) =>
    invoke<DisplayProfile>("create_profile", {
      name,
      monitors,
      primaryMonitor,
    }),

  getSettings: () => invoke<AppSettings>("get_settings"),
  saveSettings: (settings: AppSettings) =>
    invoke<AppSettings>("save_settings", { settings }),
  resetSettings: () => invoke<AppSettings>("reset_settings"),
  setBackupCount: (count: number) => invoke<void>("set_backup_count", { count }),

  hyprctlVersion: () => invoke<string>("hyprctl_version"),
};

/** True when running inside a Tauri webview (vs plain browser/dev fallback). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
