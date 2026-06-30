use crate::error::AppError;
use crate::hyprland::models::HyprMonitor;
use crate::hyprland::service::HyprlandService;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HotplugEvent {
    pub connected: Vec<String>,
    pub disconnected: Vec<String>,
    pub monitors: Vec<HyprMonitor>,
}

/// Compare the current monitor list with a previously known set of names.
/// Returns which monitors were connected / disconnected since last check.
pub fn detect(known: &[String]) -> Result<HotplugEvent, AppError> {
    let current = HyprlandService::list_monitors()?;
    let current_names: Vec<String> = current.iter().map(|m| m.name.clone()).collect();
    let known_set: std::collections::HashSet<&str> =
        known.iter().map(|s| s.as_str()).collect();

    let connected: Vec<String> = current_names
        .iter()
        .filter(|n| !known_set.contains(n.as_str()))
        .cloned()
        .collect();
    let current_set: std::collections::HashSet<&str> =
        current_names.iter().map(|s| s.as_str()).collect();
    let disconnected: Vec<String> = known
        .iter()
        .filter(|n| !current_set.contains(n.as_str()))
        .cloned()
        .collect();

    Ok(HotplugEvent {
        connected,
        disconnected,
        monitors: current,
    })
}
