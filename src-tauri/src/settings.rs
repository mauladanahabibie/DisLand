use crate::error::AppError;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,        // "dark" | "light"
    pub accent: String,       // "blue" | "violet" | ...
    pub language: String,     // "en"
    pub animation_speed: f64, // 0.5 - 2.0
    pub auto_backup: bool,
    pub auto_detect: bool,
    pub confirm_before_apply: bool,
    pub backup_count: usize,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".into(),
            accent: "blue".into(),
            language: "en".into(),
            animation_speed: 1.0,
            auto_backup: true,
            auto_detect: true,
            confirm_before_apply: true,
            backup_count: 8,
        }
    }
}

#[derive(Clone)]
pub struct SettingsStore {
    inner: Arc<Mutex<AppSettings>>,
    path: Option<PathBuf>,
}

impl SettingsStore {
    pub fn new() -> Result<Self, AppError> {
        let path = Self::path()?;
        let inner = if path.exists() {
            let data = fs::read_to_string(&path).map_err(|e| AppError::Io(e.to_string()))?;
            serde_json::from_str::<AppSettings>(&data).unwrap_or_default()
        } else {
            AppSettings::default()
        };
        Ok(Self {
            inner: Arc::new(Mutex::new(inner)),
            path: Some(path),
        })
    }

    /// Fallback in-memory store when the config dir is unavailable.
    pub fn in_memory() -> Self {
        Self {
            inner: Arc::new(Mutex::new(AppSettings::default())),
            path: None,
        }
    }

    pub fn get(&self) -> AppSettings {
        self.inner.lock().clone()
    }

    pub fn save(&self, settings: &AppSettings) -> Result<(), AppError> {
        *self.inner.lock() = settings.clone();
        if let Some(path) = &self.path {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|e| AppError::Io(e.to_string()))?;
            }
            let data = serde_json::to_string_pretty(settings)
                .map_err(|e| AppError::Io(e.to_string()))?;
            fs::write(path, data).map_err(|e| AppError::Io(e.to_string()))?;
        }
        Ok(())
    }

    fn path() -> Result<PathBuf, AppError> {
        let base = dirs::config_dir()
            .ok_or_else(|| AppError::Io("Cannot find config dir".into()))?;
        Ok(base.join("displayset").join("settings.json"))
    }
}
