use serde::{Deserialize, Serialize};

/// Raw monitor as returned by `hyprctl monitors -j`.
/// Note: hyprctl emits camelCase keys (activeWorkspace, refreshRate, …).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HyprMonitor {
    pub id: i64,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub make: String,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub serial: String,
    pub width: u32,
    pub height: u32,
    #[serde(default)]
    pub refresh_rate: f64,
    pub x: i64,
    pub y: i64,
    /// Disabled monitors omit `activeWorkspace`; make it optional + default.
    #[serde(default)]
    pub active_workspace: Option<HyprWorkspace>,
    #[serde(default)]
    pub reserved: [u32; 4],
    #[serde(default = "default_scale")]
    pub scale: f64,
    #[serde(default)]
    pub transform: u32,
    #[serde(default)]
    pub focused: bool,
    #[serde(default)]
    pub dpms_status: bool,
    #[serde(default)]
    pub vrr: bool,
    #[serde(default)]
    pub disabled: bool,
    #[serde(default)]
    pub mirror_of: String,
    #[serde(default)]
    pub available_modes: Vec<String>,
}

fn default_scale() -> f64 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HyprWorkspace {
    pub id: i64,
    pub name: String,
}

/// Raw workspace as returned by `hyprctl workspaces -j`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HyprWorkspaceInfo {
    pub id: i64,
    pub name: String,
    pub monitor: String,
    #[serde(default)]
    pub monitor_id: i64,
    #[serde(default)]
    pub windows: i64,
    #[serde(default)]
    pub hasfullscreen: bool,
    #[serde(default)]
    pub ispersistent: bool,
}

/// Editable monitor configuration used internally and by the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorConfig {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub width: u32,
    pub height: u32,
    pub refresh_rate: f64,
    pub scale: f64,
    pub x: i64,
    pub y: i64,
    pub transform: u32,
    pub rotation: String,
    pub focused: bool,
    pub enabled: bool,
    pub primary: bool,
    pub vrr: bool,
    pub adaptive_sync: bool,
    pub mirror_of: Option<String>,
    pub active_workspace: i64,
    pub available_modes: Vec<String>,
}

impl MonitorConfig {
    pub fn from_hypr(m: &HyprMonitor) -> Self {
        let rotation = match m.transform {
            0 => "normal",
            1 => "right",
            2 => "flipped",
            3 => "left",
            _ => "normal",
        }
        .to_string();
        let mirror_of = if m.mirror_of.is_empty() || m.mirror_of == "none" {
            None
        } else {
            Some(m.mirror_of.clone())
        };
        Self {
            id: m.id,
            name: m.name.clone(),
            description: m.description.clone(),
            width: m.width,
            height: m.height,
            refresh_rate: m.refresh_rate,
            scale: m.scale,
            x: m.x,
            y: m.y,
            transform: m.transform,
            rotation,
            focused: m.focused,
            enabled: !m.disabled,
            primary: false,
            vrr: m.vrr,
            adaptive_sync: m.vrr,
            mirror_of,
            active_workspace: m
                .active_workspace
                .as_ref()
                .map(|w| w.id)
                .unwrap_or(0),
            available_modes: m.available_modes.clone(),
        }
    }

    /// Effective width/height after applying rotation.
    pub fn effective_size(&self) -> (u32, u32) {
        let rotated = matches!(self.rotation.as_str(), "left" | "right");
        if rotated {
            (self.height, self.width)
        } else {
            (self.width, self.height)
        }
    }

    /// Parse a mode string like "1920x1080@144.00Hz".
    pub fn parse_mode(mode: &str) -> Option<(u32, u32, f64)> {
        let mode = mode.trim();
        let (res, hz) = mode.split_once('@')?;
        let (w, h) = res.split_once('x')?;
        let w: u32 = w.trim().parse().ok()?;
        let h: u32 = h.trim().parse().ok()?;
        let hz_str: String = hz.trim().trim_end_matches("Hz").trim().to_string();
        let hz: f64 = hz_str.parse().ok()?;
        Some((w, h, hz))
    }

    /// Distinct resolutions available, deduplicated, sorted descending by pixel count.
    pub fn available_resolutions(&self) -> Vec<(u32, u32)> {
        let mut out: Vec<(u32, u32)> = self
            .available_modes
            .iter()
            .filter_map(|m| Self::parse_mode(m).map(|(w, h, _)| (w, h)))
            .collect();
        out.sort_by(|a, b| (b.0 as u64 * b.1 as u64).cmp(&(a.0 as u64 * a.1 as u64)));
        out.dedup();
        out
    }

    /// Refresh rates for a given resolution (or any if res is None), sorted desc.
    pub fn refresh_rates_for(&self, res: Option<(u32, u32)>) -> Vec<f64> {
        let mut out: Vec<f64> = self
            .available_modes
            .iter()
            .filter_map(|m| {
                let (w, h, hz) = Self::parse_mode(m)?;
                match res {
                    Some((rw, rh)) if rw == w && rh == h => Some(hz),
                    None => Some(hz),
                    _ => None,
                }
            })
            .collect();
        out.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
        out.dedup_by(|a, b| (*a - *b).abs() < 0.05);
        out
    }
}

/// A snapshot of the current monitor layout used for backups.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupSnapshot {
    pub id: String,
    pub created_at: i64,
    pub monitors: Vec<MonitorConfig>,
    pub raw_config: String,
}
