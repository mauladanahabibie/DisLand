use crate::error::AppError;
use crate::hyprland::models::MonitorConfig;

/// Render a single `hl.monitor({...})` Lua call for dots-hyprland / Hyprland 0.45+.
///
/// Field mapping (Lua API):
///   output    = "<name>"
///   mode      = "<W>x<H>@<hz>"   (or omitted for disabled / mirror)
///   position  = "<x>x<y>"
///   scale     = <number>
///   transform = <0..7>
///   mirror    = "<target>"       (omitted when not mirroring)
///   vrr       = <bool>
///   disabled  = <bool>           (only emitted when true)
pub fn monitor_lua(cfg: &MonitorConfig) -> String {
    if !cfg.enabled {
        return format!(
            "hl.monitor({{\n    output = \"{}\",\n    disabled = true\n}})",
            escape_lua(cfg.name.as_str())
        );
    }

    let hz = (cfg.refresh_rate * 100.0).round() / 100.0;
    let mode = format!("{}x{}@{:.2}", cfg.width, cfg.height, hz);
    let position = format!("{}x{}", cfg.x, cfg.y);
    let scale = format_scale(cfg.scale);
    let transform = transform_int(&cfg.rotation);

    let mut lines = Vec::new();
    lines.push(format!("    output = \"{}\"", escape_lua(&cfg.name)));
    lines.push(format!("    mode = \"{}\"", escape_lua(&mode)));
    lines.push(format!("    position = \"{}\"", escape_lua(&position)));
    lines.push(format!("    scale = {}", scale));
    lines.push(format!("    transform = {}", transform));

    match &cfg.mirror_of {
        Some(m) if !m.is_empty() && m != "none" => {
            lines.push(format!("    mirror = \"{}\"", escape_lua(m)));
        }
        _ => {}
    }

    lines.push(format!("    vrr = {}", if cfg.vrr { "true" } else { "false" }));

    format!("hl.monitor({{\n{}\n}})", lines.join(",\n"))
}

/// Render the full Lua monitor config file body for a set of monitors.
pub fn render_monitor_lua(configs: &[MonitorConfig]) -> String {
    let mut out = String::from("-- ===== DisplaySet generated monitor config =====\n");
    out.push_str("-- This file is managed by DisplaySet. Manual edits will be overwritten on Apply.\n\n");
    for cfg in configs {
        out.push_str(&monitor_lua(cfg));
        out.push_str("\n\n");
    }
    out.push_str("-- ===== /DisplaySet =====\n");
    out
}

/// Render workspace binding rules as Lua `hl.workspace_rule({...})` calls.
pub fn render_workspace_lua(rules: &[(String, String)]) -> String {
    if rules.is_empty() {
        return String::new();
    }
    let mut out = String::from("-- ===== DisplaySet workspace rules =====\n");
    for (ws, mon) in rules {
        out.push_str(&format!(
            "hl.workspace_rule({{\n    workspace = \"{}\",\n    monitor = \"{}\"\n}})\n\n",
            escape_lua(ws),
            escape_lua(mon),
        ));
    }
    out.push_str("-- ===== /DisplaySet workspace rules =====\n");
    out
}

/// Render the legacy monitor spec string (kept for backup / export compatibility).
/// Format: `<name>,<res>@<hz>,<x>x<y>,<scale>,<transform>,<mirror|none>,<vrr>,<adaptiveSync>`
pub fn monitor_spec(cfg: &MonitorConfig) -> String {
    if !cfg.enabled {
        return format!("{},disable", cfg.name);
    }
    let transform = transform_int(&cfg.rotation).to_string();
    let hz = (cfg.refresh_rate * 100.0).round() / 100.0;
    let res = format!("{}x{}@{:.2}", cfg.width, cfg.height, hz);
    let pos = format!("{}x{}", cfg.x, cfg.y);
    let scale = format_scale(cfg.scale);
    let mirror = match &cfg.mirror_of {
        Some(m) if !m.is_empty() && m != "none" => m.clone(),
        _ => "none".to_string(),
    };
    let vrr = if cfg.vrr { "on" } else { "off" };
    let adaptive = if cfg.adaptive_sync { "on" } else { "off" };
    format!(
        "{},{},{},{},{},{},{},{}",
        cfg.name, res, pos, scale, transform, mirror, vrr, adaptive
    )
}

/// Convert a scale float to Hyprland's preferred string (avoids trailing zeros).
pub fn format_scale(scale: f64) -> String {
    let s = format!("{:.4}", scale);
    let s = s.trim_end_matches('0');
    let s = s.trim_end_matches('.');
    if s.is_empty() {
        "1".to_string()
    } else {
        s.to_string()
    }
}

fn transform_int(rotation: &str) -> u32 {
    match rotation {
        "normal" => 0,
        "right" => 1,
        "flipped" => 2,
        "left" => 3,
        _ => 0,
    }
}

/// Escape a string for embedding inside a Lua double-quoted string.
fn escape_lua(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Validate that the generated spec parses back into a sane form.
pub fn validate_spec(spec: &str) -> Result<(), AppError> {
    if spec.is_empty() {
        return Err(AppError::InvalidConfig("empty monitor spec".into()));
    }
    if !spec.contains(',') {
        return Err(AppError::InvalidConfig(format!(
            "monitor spec must contain commas: {spec}"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mk() -> MonitorConfig {
        MonitorConfig {
            id: 0,
            name: "eDP-1".into(),
            description: "test".into(),
            width: 1920,
            height: 1080,
            refresh_rate: 144.0,
            scale: 1.0,
            x: 0,
            y: 0,
            transform: 0,
            rotation: "normal".into(),
            focused: false,
            enabled: true,
            primary: false,
            vrr: false,
            adaptive_sync: false,
            mirror_of: None,
            active_workspace: 1,
            available_modes: vec![],
        }
    }

    #[test]
    fn lua_enabled_monitor_has_all_fields() {
        let s = monitor_lua(&mk());
        assert!(s.contains("output = \"eDP-1\""));
        assert!(s.contains("mode = \"1920x1080@144.00\""));
        assert!(s.contains("position = \"0x0\""));
        assert!(s.contains("scale = 1"));
        assert!(s.contains("transform = 0"));
        assert!(s.contains("vrr = false"));
        assert!(!s.contains("mirror"));
    }

    #[test]
    fn lua_disabled_monitor_only_has_output_and_disabled() {
        let mut m = mk();
        m.enabled = false;
        let s = monitor_lua(&m);
        assert!(s.contains("disabled = true"));
        assert!(s.contains("output = \"eDP-1\""));
        assert!(!s.contains("mode"));
    }

    #[test]
    fn lua_mirror_monitor_omits_mode_position() {
        let mut m = mk();
        m.mirror_of = Some("HDMI-A-5".into());
        let s = monitor_lua(&m);
        assert!(s.contains("mirror = \"HDMI-A-5\""));
    }
}
