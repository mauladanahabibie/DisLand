use crate::hyprland::models::{HyprMonitor, HyprWorkspaceInfo, MonitorConfig};
use crate::error::AppError;
use crate::hyprland::hyprctl::Hyprctl;
use std::fs;
use std::path::PathBuf;

/// High-level Hyprland operations.
pub struct HyprlandService;

/// Path to the dots-hyprland custom monitor config file.
/// We write generated `hl.monitor({...})` calls here, then reload.
///   ~/.config/hypr/custom/general.lua
fn custom_general_lua_path() -> Result<PathBuf, AppError> {
    let base = dirs::config_dir()
        .ok_or_else(|| AppError::Io("Cannot find config dir".into()))?;
    Ok(base.join("hypr").join("custom").join("general.lua"))
}

impl HyprlandService {
    /// Fetch the list of monitors and convert to editable configs.
    pub fn list_monitors() -> Result<Vec<HyprMonitor>, AppError> {
        let raw = Hyprctl::monitors()?;
        serde_json::from_str::<Vec<HyprMonitor>>(&raw)
            .map_err(|e| AppError::Parse(format!("monitors JSON: {e}")))
    }

    /// Fetch workspaces.
    pub fn list_workspaces() -> Result<Vec<HyprWorkspaceInfo>, AppError> {
        let raw = Hyprctl::workspaces()?;
        serde_json::from_str::<Vec<HyprWorkspaceInfo>>(&raw)
            .map_err(|e| AppError::Parse(format!("workspaces JSON: {e}")))
    }

    /// Build editable MonitorConfig list with primary marker and workspace info.
    pub fn snapshot_configs() -> Result<Vec<MonitorConfig>, AppError> {
        let monitors = Self::list_monitors()?;
        let workspaces = Self::list_workspaces().unwrap_or_default();
        let primary_id = Self::infer_primary(&monitors);

        let configs = monitors
            .iter()
            .map(|m| {
                let mut cfg = MonitorConfig::from_hypr(m);
                cfg.primary = Some(m.id) == primary_id;
                if cfg.active_workspace == 0 {
                    if let Some(ws) = workspaces.iter().find(|w| w.monitor == m.name) {
                        cfg.active_workspace = ws.id;
                    }
                }
                cfg
            })
            .collect();
        Ok(configs)
    }

    fn infer_primary(monitors: &[HyprMonitor]) -> Option<i64> {
        if monitors.is_empty() {
            return None;
        }
        if let Some(focused) = monitors.iter().find(|m| m.focused) {
            return Some(focused.id);
        }
        if let Some(origin) = monitors.iter().find(|m| m.x == 0 && m.y == 0) {
            return Some(origin.id);
        }
        Some(monitors[0].id)
    }

    /// Apply a full monitor configuration by writing a Lua config file to
    /// `~/.config/hypr/custom/general.lua` (dots-hyprland layout) and
    /// triggering `hyprctl reload`.
    ///
    /// This is the only reliable way to apply monitor changes on Hyprland
    /// 0.45+ with the new Lua config parser: `hyprctl keyword` is rejected
    /// and `hyprctl eval 'monitor = "..."'` is accepted but silently ignored
    /// for already-active monitors.
    ///
    /// The previous file is backed up with a `.displayset.bak` suffix so the
    /// rollback engine can restore it.
    pub fn apply_all(
        configs: &[MonitorConfig],
        workspace_rules: &[(String, String)],
    ) -> Result<(), AppError> {
        let path = custom_general_lua_path()?;
        // ensure parent dir exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| AppError::Io(e.to_string()))?;
        }

        // backup existing file (if any) for rollback
        if path.exists() {
            let bak = path.with_extension("lua.displayset.bak");
            fs::copy(&path, &bak).map_err(|e| AppError::Io(e.to_string()))?;
        }

        // render lua
        let mut content = String::new();
        content.push_str(&crate::config::generator::render_monitor_lua(configs));
        let ws_lua = crate::config::generator::render_workspace_lua(workspace_rules);
        if !ws_lua.is_empty() {
            content.push_str("\n");
            content.push_str(&ws_lua);
        }

        fs::write(&path, content).map_err(|e| AppError::Io(e.to_string()))?;

        // reload hyprland to pick up the new config
        Hyprctl::reload()?;

        // Hyprland has no native "primary" concept; we model primary as the
        // focused monitor. Move focus to the chosen primary so a subsequent
        // `snapshot_configs` -> `infer_primary` round-trips the user's choice.
        if let Some(primary) = configs.iter().find(|c| c.primary && c.enabled) {
            // best-effort: failure to focus must not fail the whole apply
            let _ = Hyprctl::dispatch("focusmonitor", &primary.name);
        }
        Ok(())
    }

    /// Restore the last backup written by [`apply_all`].
    pub fn restore_backup() -> Result<(), AppError> {
        let path = custom_general_lua_path()?;
        let bak = path.with_extension("lua.displayset.bak");
        if bak.exists() {
            fs::copy(&bak, &path).map_err(|e| AppError::Io(e.to_string()))?;
            Hyprctl::reload()?;
            Ok(())
        } else {
            Err(AppError::Rollback("No .displayset.bak found".into()))
        }
    }

    /// Reload hyprland config (picks up changes not applied live).
    pub fn reload() -> Result<(), AppError> {
        Hyprctl::reload()
    }
}
