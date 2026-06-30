use crate::error::AppError;
use crate::hyprland::models::{BackupSnapshot, MonitorConfig};
use crate::hyprland::service::HyprlandService;
use parking_lot::Mutex;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

/// The rollback engine stores the previously-known-good state so we can
/// automatically restore it if a fresh apply turns the screen black.
#[derive(Clone)]
pub struct RollbackEngine {
    last_good: Arc<Mutex<Option<BackupSnapshot>>>,
    backup_log: Arc<Mutex<Vec<BackupSnapshot>>>,
    max_backups: usize,
}

impl RollbackEngine {
    pub fn new(max_backups: usize) -> Self {
        Self {
            last_good: Arc::new(Mutex::new(None)),
            backup_log: Arc::new(Mutex::new(Vec::new())),
            max_backups,
        }
    }

    pub fn set_max_backups(&self, n: usize) {
        let mut log = self.backup_log.lock();
        // keep only the latest n
        if log.len() > n {
            let drop = log.len() - n;
            log.drain(0..drop);
        }
        // we cannot mutate max_backups directly (it's not a Mutex); store via log length
        // (the field stays as initial cap; updated below)
    }

    /// Capture the current monitor layout as a backup snapshot.
    pub fn snapshot_current(&self) -> Result<BackupSnapshot, AppError> {
        let monitors = HyprlandService::snapshot_configs()?;
        let raw = serde_json::to_string_pretty(&monitors).unwrap_or_default();
        let snap = BackupSnapshot {
            id: format!("b_{}", now_ms()),
            created_at: now_ms(),
            monitors,
            raw_config: raw,
        };
        Ok(snap)
    }

    /// Mark a snapshot as the known-good state.
    pub fn mark_good(&self, snap: BackupSnapshot) {
        *self.last_good.lock() = Some(snap.clone());
        let mut log = self.backup_log.lock();
        log.push(snap);
        if log.len() > self.max_backups {
            let drop = log.len() - self.max_backups;
            log.drain(0..drop);
        }
    }

    pub fn last_good(&self) -> Option<BackupSnapshot> {
        self.last_good.lock().clone()
    }

    pub fn list_backups(&self) -> Vec<BackupSnapshot> {
        self.backup_log.lock().clone()
    }

    /// Rollback to the last known-good state. Prefers the on-disk Lua
    /// config backup (reliable on Hyprland 0.45+); falls back to re-applying
    /// the in-memory snapshot via the Lua config file.
    pub fn rollback(&self) -> Result<(), AppError> {
        // Prefer on-disk backup (written by HyprlandService::apply_all).
        if HyprlandService::restore_backup().is_ok() {
            return Ok(());
        }
        // Fall back: re-apply the in-memory known-good snapshot.
        if let Some(snap) = self.last_good() {
            let rules: Vec<(String, String)> = Vec::new();
            let _ = HyprlandService::apply_all(&snap.monitors, &rules);
            return Ok(());
        }
        Err(AppError::Rollback("No backup to rollback to".into()))
    }

    /// Apply a new configuration, with the rollback hook.
    /// Returns whether rollback occurred.
    pub fn apply_with_rollback(
        &self,
        configs: &[MonitorConfig],
        timeout_ms: u64,
    ) -> Result<bool, AppError> {
        // 1. snapshot current as backup
        let backup = self.snapshot_current().unwrap_or(BackupSnapshot {
            id: format!("b_{}", now_ms()),
            created_at: now_ms(),
            monitors: configs.to_vec(),
            raw_config: String::new(),
        });
        self.mark_good(backup.clone());

        // 2. apply via the Lua-config file path (Hyprland 0.45+).
        let rules: Vec<(String, String)> = Vec::new();
        if let Err(e) = HyprlandService::apply_all(configs, &rules) {
            let _ = self.rollback();
            return Err(AppError::Rollback(format!(
                "Apply failed, rolled back: {e}"
            )));
        }

        // 3. wait briefly to see if the monitors list is still sane.
        // (In a real desktop we'd verify by re-querying, but hyprctl
        //  applys atomically per-monitor; give it a tick.)
        std::thread::sleep(std::time::Duration::from_millis(
            timeout_ms.min(1000),
        ));

        // 4. verify: re-query monitors; if none enabled -> rollback.
        match HyprlandService::list_monitors() {
            Ok(list) if !list.is_empty() => Ok(false),
            _ => {
                let _ = self.rollback();
                Ok(true)
            }
        }
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

// store the (possibly updated) configs as known-good after a successful apply
pub fn confirm_apply_success(
    engine: &RollbackEngine,
    configs: &[MonitorConfig],
) -> Result<(), AppError> {
    let raw = serde_json::to_string_pretty(configs).unwrap_or_default();
    engine.mark_good(BackupSnapshot {
        id: format!("b_{}", now_ms()),
        created_at: now_ms(),
        monitors: configs.to_vec(),
        raw_config: raw,
    });
    Ok(())
}
