use crate::config::profile::{DisplayProfile, ProfileManager, WorkspaceRule};
use crate::config::rollback::RollbackEngine;
use crate::config::validation::{self, ValidationResult};
use crate::error::AppError;
use crate::hyprland::models::{BackupSnapshot, MonitorConfig};
use crate::hyprland::service::HyprlandService;
use crate::settings::{AppSettings, SettingsStore};
use std::sync::Arc;
use tauri::State;

/// Shared app state injected into Tauri.
pub struct AppState {
    pub rollback: RollbackEngine,
    pub settings: SettingsStore,
}

#[tauri::command]
pub fn list_monitors() -> Result<Vec<MonitorConfig>, AppError> {
    HyprlandService::snapshot_configs()
}

#[tauri::command]
pub fn list_workspaces() -> Result<Vec<crate::hyprland::models::HyprWorkspaceInfo>, AppError> {
    HyprlandService::list_workspaces()
}

#[tauri::command]
pub fn detect_hotplug(
    known: Vec<String>,
) -> Result<crate::hotplug::HotplugEvent, AppError> {
    crate::hotplug::detect(&known)
}

#[tauri::command]
pub fn validate_config(configs: Vec<MonitorConfig>) -> Result<ValidationResult, AppError> {
    Ok(validation::validate(&configs))
}

#[tauri::command]
pub fn backup_current(state: State<'_, AppState>) -> Result<BackupSnapshot, AppError> {
    let snap = state.rollback.snapshot_current()?;
    state.rollback.mark_good(snap.clone());
    Ok(snap)
}

#[tauri::command]
pub fn list_backups(state: State<'_, AppState>) -> Result<Vec<BackupSnapshot>, AppError> {
    Ok(state.rollback.list_backups())
}

#[tauri::command]
pub fn rollback(state: State<'_, AppState>) -> Result<(), AppError> {
    // Prefer restoring the on-disk Lua config backup (reliable on Hyprland 0.45+).
    if HyprlandService::restore_backup().is_ok() {
        return Ok(());
    }
    // Fall back to re-applying the in-memory snapshot (older parser / no file backup).
    state.rollback.rollback()
}

#[derive(serde::Serialize)]
pub struct ApplyOutcome {
    pub success: bool,
    pub message: String,
    pub applied: bool,
    pub rolled_back: bool,
    pub errors: Vec<String>,
    pub backup_id: Option<String>,
}

#[tauri::command]
pub fn apply_config(
    configs: Vec<MonitorConfig>,
    workspace_rules: Vec<WorkspaceRule>,
    state: State<'_, AppState>,
) -> Result<ApplyOutcome, AppError> {
    // 1. Validate first.
    let result = validation::validate(&configs);
    if !result.valid {
        return Ok(ApplyOutcome {
            success: false,
            message: "Validation failed".into(),
            applied: false,
            rolled_back: false,
            errors: result.errors,
            backup_id: None,
        });
    }

    // 2. Snapshot the current state for rollback (memory backup).
    let backup = state.rollback.snapshot_current().ok();
    if let Some(b) = &backup {
        state.rollback.mark_good(b.clone());
    }

    // 3. Apply all monitors + workspace rules atomically by writing the Lua
    //    config file and reloading. This is the only reliable way on
    //    Hyprland 0.45+ with the Lua parser.
    let rules: Vec<(String, String)> = workspace_rules
        .iter()
        .map(|r| (r.workspace.clone(), r.monitor.clone()))
        .collect();

    match HyprlandService::apply_all(&configs, &rules) {
        Ok(()) => {}
        Err(e) => {
            // write/reload failed -> try restoring the backup file
            let _ = HyprlandService::restore_backup();
            return Ok(ApplyOutcome {
                success: false,
                message: format!("Apply failed: {e}"),
                applied: false,
                rolled_back: true,
                errors: vec![e.to_string()],
                backup_id: backup.as_ref().map(|b| b.id.clone()),
            });
        }
    }

    // 4. Verify monitors still exist (gives Hyprland a brief moment).
    std::thread::sleep(std::time::Duration::from_millis(800));
    match HyprlandService::list_monitors() {
        Ok(list) if !list.is_empty() => {
            // success -> confirm new known-good state
            if let Err(e) = crate::config::rollback::confirm_apply_success(&state.rollback, &configs)
            {
                eprintln!("{e}");
            }
            Ok(ApplyOutcome {
                success: true,
                message: "Configuration applied successfully".into(),
                applied: true,
                rolled_back: false,
                errors: vec![],
                backup_id: backup.as_ref().map(|b| b.id.clone()),
            })
        }
        _ => {
            let _ = state.rollback.rollback();
            Ok(ApplyOutcome {
                success: false,
                message: "Monitors disappeared after apply; rolled back".into(),
                applied: false,
                rolled_back: true,
                errors: vec![],
                backup_id: backup.as_ref().map(|b| b.id.clone()),
            })
        }
    }
}

#[tauri::command]
pub fn list_profiles() -> Result<Vec<DisplayProfile>, AppError> {
    ProfileManager::list()
}

#[tauri::command]
pub fn save_profile(profile: DisplayProfile) -> Result<DisplayProfile, AppError> {
    ProfileManager::save(&profile)?;
    Ok(profile)
}

#[tauri::command]
pub fn delete_profile(id: String) -> Result<(), AppError> {
    ProfileManager::delete(&id)
}

#[tauri::command]
pub fn duplicate_profile(id: String, new_name: String) -> Result<DisplayProfile, AppError> {
    ProfileManager::duplicate(&id, &new_name)
}

#[tauri::command]
pub fn export_profile(id: String) -> Result<String, AppError> {
    let p = ProfileManager::get(&id)?;
    ProfileManager::export(&p)
}

#[tauri::command]
pub fn import_profile(json: String) -> Result<DisplayProfile, AppError> {
    let p = ProfileManager::import(&json)?;
    ProfileManager::save(&p)?;
    Ok(p)
}

#[tauri::command]
pub fn create_profile(
    name: String,
    monitors: Vec<MonitorConfig>,
    primary_monitor: Option<String>,
) -> Result<DisplayProfile, AppError> {
    ProfileManager::create_from_current(&name, monitors, primary_monitor)
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, AppError> {
    Ok(state.settings.get())
}

#[tauri::command]
pub fn save_settings(
    settings: AppSettings,
    state: State<'_, AppState>,
) -> Result<AppSettings, AppError> {
    state.settings.save(&settings)?;
    Ok(settings)
}

#[tauri::command]
pub fn reset_settings(state: State<'_, AppState>) -> Result<AppSettings, AppError> {
    let defaults = AppSettings::default();
    state.settings.save(&defaults)?;
    Ok(defaults)
}

/// Allow the frontend to push a backup count change to the rollback engine.
#[tauri::command]
pub fn set_backup_count(count: usize, state: State<'_, AppState>) -> Result<(), AppError> {
    state.rollback.set_max_backups(count.max(1));
    Ok(())
}

#[tauri::command]
pub fn hyprctl_version() -> Result<String, AppError> {
    crate::hyprland::hyprctl::Hyprctl::version()
}

/// A no-op used to confirm the IPC layer is alive.
#[tauri::command]
pub fn ping() -> String {
    "pong".to_string()
}

pub fn app_state(max_backups: usize) -> Arc<AppState> {
    Arc::new(AppState {
        rollback: RollbackEngine::new(max_backups),
        settings: SettingsStore::new().unwrap_or_else(|_| SettingsStore::in_memory()),
    })
}
