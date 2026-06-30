use crate::error::AppError;
use crate::hyprland::models::MonitorConfig;
use std::collections::HashMap;

#[derive(Debug, Clone, serde::Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

impl ValidationResult {
    pub fn ok() -> Self {
        Self {
            valid: true,
            errors: vec![],
            warnings: vec![],
        }
    }
    pub fn fail(err: impl Into<String>) -> Self {
        Self {
            valid: false,
            errors: vec![err.into()],
            warnings: vec![],
        }
    }
    pub fn push_error(&mut self, e: impl Into<String>) {
        self.errors.push(e.into());
        self.valid = false;
    }
    pub fn push_warning(&mut self, w: impl Into<String>) {
        self.warnings.push(w.into());
    }
}

/// Validate a full set of monitor configurations before applying.
///
/// Checks:
/// - At least one enabled monitor.
/// - At least one primary monitor (and at most one).
/// - No two enabled monitors occupy identical top-left positions.
/// - No two enabled monitors overlap fully.
/// - Scales are within Hyprland-supported bounds (0.25 .. 4.0).
/// - Refresh rates exist in the available modes for the chosen resolution.
/// - Resolutions exist in available modes.
/// - Mirror targets exist among enabled monitors.
/// - Active workspace ids are positive (or 0 meaning unset).
/// - Positions are finite integers (already enforced by types).
pub fn validate(configs: &[MonitorConfig]) -> ValidationResult {
    let mut res = ValidationResult::ok();

    if configs.is_empty() {
        res.push_error("No monitors to apply.");
        return res;
    }

    let enabled: Vec<&MonitorConfig> = configs.iter().filter(|c| c.enabled).collect();

    if enabled.is_empty() {
        res.push_error("At least one monitor must be enabled.");
        return res;
    }

    // Primary check.
    let primary_count = enabled.iter().filter(|c| c.primary).count();
    if primary_count == 0 {
        res.push_warning("No primary monitor set; the focused monitor will be used.");
    } else if primary_count > 1 {
        res.push_error(format!(
            "Only one primary monitor is allowed, found {primary_count}."
        ));
    }

    // Names uniqueness (Hyprland guarantees but defensive).
    let mut seen_names = std::collections::HashSet::new();
    for c in configs {
        if !seen_names.insert(c.name.as_str()) {
            res.push_error(format!("Duplicate monitor name: {}", c.name));
        }
    }

    // Position / overlap checks.
    let mut positions: HashMap<(i64, i64), Vec<String>> = HashMap::new();
    for c in &enabled {
        positions
            .entry((c.x, c.y))
            .or_default()
            .push(c.name.clone());
    }
    for ((x, y), names) in &positions {
        if names.len() > 1 {
            res.push_error(format!(
                "Monitors overlap at exact origin ({x},{y}): {}",
                names.join(", ")
            ));
        }
    }

    // Pairwise rectangle overlap (allowing edge-touching).
    for i in 0..enabled.len() {
        for j in (i + 1)..enabled.len() {
            let a = enabled[i];
            let b = enabled[j];
            if a.mirror_of.as_deref() == Some(b.name.as_str())
                || b.mirror_of.as_deref() == Some(a.name.as_str())
            {
                continue;
            }
            let (aw, ah) = a.effective_size();
            let (bw, bh) = b.effective_size();
            let overlap = !(a.x + aw as i64 <= b.x
                || b.x + bw as i64 <= a.x
                || a.y + ah as i64 <= b.y
                || b.y + bh as i64 <= a.y);
            if overlap {
                res.push_warning(format!(
                    "Monitors {} and {} overlap each other.",
                    a.name, b.name
                ));
            }
        }
    }

    // Per-monitor validation.
    for c in configs {
        if !c.enabled {
            continue;
        }
        // Scale bounds.
        if c.scale < 0.25 || c.scale > 4.0 {
            res.push_error(format!(
                "{}: scale {} is out of range (0.25–4.0).",
                c.name, c.scale
            ));
        }

        // Refresh rate presence.
        let rates = c.refresh_rates_for(Some((c.width, c.height)));
        if !rates.is_empty()
            && !rates
                .iter()
                .any(|r| (r - c.refresh_rate).abs() < 0.1)
        {
            res.push_error(format!(
                "{}: refresh rate {:.2}Hz is not supported at {}x{}.",
                c.name, c.refresh_rate, c.width, c.height
            ));
        }

        // Resolution presence.
        let resolutions = c.available_resolutions();
        if !resolutions.is_empty()
            && !resolutions.iter().any(|(w, h)| *w == c.width && *h == c.height)
        {
            res.push_error(format!(
                "{}: resolution {}x{} is not in available modes.",
                c.name, c.width, c.height
            ));
        }

        // Mirror target.
        if let Some(target) = &c.mirror_of {
            if !target.is_empty() && target != "none" {
                if !configs.iter().any(|o| o.name == *target && o.enabled) {
                    res.push_error(format!(
                        "{}: mirror target {} is not an enabled monitor.",
                        c.name, target
                    ));
                }
                if c.mirror_of.as_deref() == Some(c.name.as_str()) {
                    res.push_error(format!("{}: cannot mirror itself.", c.name));
                }
            }
        }

        // Workspace id.
        if c.active_workspace < 0 {
            res.push_error(format!(
                "{}: workspace id must be >= 0, got {}.",
                c.name, c.active_workspace
            ));
        }
    }

    // Negative coordinates are allowed (Hyprland supports negative), but warn for big negatives.
    for c in &enabled {
        if c.x < -10000 || c.y < -10000 {
            res.push_warning(format!("{}: very negative position ({},{}).", c.name, c.x, c.y));
        }
    }

    res
}

/// Convenience: validate + return Result.
pub fn ensure_valid(configs: &[MonitorConfig]) -> Result<(), AppError> {
    let r = validate(configs);
    if r.valid {
        Ok(())
    } else {
        Err(AppError::Validation(r.errors.join(" | ")))
    }
}
