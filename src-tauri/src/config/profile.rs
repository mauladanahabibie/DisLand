use crate::error::AppError;
use crate::hyprland::models::MonitorConfig;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayProfile {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub icon: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub monitors: Vec<MonitorConfig>,
    pub primary_monitor: Option<String>,
    #[serde(default)]
    pub wallpaper: Option<String>,
    #[serde(default)]
    pub workspace_rules: Vec<WorkspaceRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceRule {
    pub workspace: String,
    pub monitor: String,
}

/// Where profile JSON files live.
fn profiles_dir() -> Result<PathBuf, AppError> {
    let base = dirs::config_dir()
        .ok_or_else(|| AppError::Profile("Cannot find config dir".into()))?;
    let dir = base.join("displayset").join("profiles");
    fs::create_dir_all(&dir).map_err(|e| AppError::Profile(e.to_string()))?;
    Ok(dir)
}

pub struct ProfileManager;

impl ProfileManager {
    pub fn list() -> Result<Vec<DisplayProfile>, AppError> {
        let dir = profiles_dir()?;
        let mut out = Vec::new();
        let rd = fs::read_dir(&dir).map_err(|e| AppError::Profile(e.to_string()))?;
        for entry in rd.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                let data = fs::read_to_string(&path).map_err(|e| AppError::Profile(e.to_string()))?;
                match serde_json::from_str::<DisplayProfile>(&data) {
                    Ok(p) => out.push(p),
                    Err(_) => continue, // skip corrupt files
                }
            }
        }
        out.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(out)
    }

    pub fn save(profile: &DisplayProfile) -> Result<(), AppError> {
        let dir = profiles_dir()?;
        let path = dir.join(format!("{}.json", profile.id));
        let data = serde_json::to_string_pretty(profile)
            .map_err(|e| AppError::Profile(e.to_string()))?;
        fs::write(&path, data).map_err(|e| AppError::Profile(e.to_string()))?;
        Ok(())
    }

    pub fn delete(id: &str) -> Result<(), AppError> {
        let dir = profiles_dir()?;
        let path = dir.join(format!("{id}.json"));
        if path.exists() {
            fs::remove_file(&path).map_err(|e| AppError::Profile(e.to_string()))?;
        }
        Ok(())
    }

    pub fn duplicate(id: &str, new_name: &str) -> Result<DisplayProfile, AppError> {
        let original = Self::get(id)?;
        let mut copy = original;
        copy.id = format!("p_{}", uuid::Uuid::new_v4());
        copy.name = new_name.to_string();
        copy.created_at = now_ms();
        copy.updated_at = now_ms();
        Self::save(&copy)?;
        Ok(copy)
    }

    pub fn get(id: &str) -> Result<DisplayProfile, AppError> {
        let dir = profiles_dir()?;
        let path = dir.join(format!("{id}.json"));
        let data = fs::read_to_string(&path).map_err(|e| AppError::Profile(e.to_string()))?;
        serde_json::from_str(&data).map_err(|e| AppError::Profile(e.to_string()))
    }

    /// Serialise a profile to a JSON string (for "Export JSON").
    pub fn export(profile: &DisplayProfile) -> Result<String, AppError> {
        serde_json::to_string_pretty(profile).map_err(|e| AppError::Profile(e.to_string()))
    }

    /// Parse an imported JSON string into a (unsaved) profile.
    /// Caller can then call save() if desired.
    pub fn import(json: &str) -> Result<DisplayProfile, AppError> {
        let mut profile: DisplayProfile =
            serde_json::from_str(json).map_err(|e| AppError::Profile(e.to_string()))?;
        // give it a fresh id and timestamps so it doesn't clobber existing
        profile.id = format!("p_{}", uuid::Uuid::new_v4());
        profile.created_at = now_ms();
        profile.updated_at = now_ms();
        Ok(profile)
    }

    pub fn create_from_current(
        name: &str,
        configs: Vec<MonitorConfig>,
        primary: Option<String>,
    ) -> Result<DisplayProfile, AppError> {
        let now = now_ms();
        let profile = DisplayProfile {
            id: format!("p_{}", uuid::Uuid::new_v4()),
            name: name.to_string(),
            icon: None,
            created_at: now,
            updated_at: now,
            monitors: configs,
            primary_monitor: primary,
            wallpaper: None,
            workspace_rules: Vec::new(),
        };
        Self::save(&profile)?;
        Ok(profile)
    }
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
