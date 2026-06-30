pub mod commands;
pub mod config;
pub mod error;
pub mod hotplug;
pub mod hyprland;
pub mod settings;

use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let max_backups = 8;
    let state = AppState {
        rollback: crate::config::rollback::RollbackEngine::new(max_backups),
        settings: crate::settings::SettingsStore::new()
            .unwrap_or_else(|_| crate::settings::SettingsStore::in_memory()),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::list_monitors,
            commands::list_workspaces,
            commands::detect_hotplug,
            commands::validate_config,
            commands::backup_current,
            commands::list_backups,
            commands::rollback,
            commands::apply_config,
            commands::list_profiles,
            commands::save_profile,
            commands::delete_profile,
            commands::duplicate_profile,
            commands::export_profile,
            commands::import_profile,
            commands::create_profile,
            commands::get_settings,
            commands::save_settings,
            commands::reset_settings,
            commands::set_backup_count,
            commands::hyprctl_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running DisplaySet");
}
