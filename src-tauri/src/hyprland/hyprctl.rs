use crate::error::AppError;
use std::process::Command;

/// Thin wrapper around the `hyprctl` binary. Never panics.
pub struct Hyprctl;

impl Hyprctl {
    fn bin() -> Result<String, AppError> {
        which::which("hyprctl")
            .map(|p| p.to_string_lossy().to_string())
            .map_err(|_| AppError::HyprctlMissing)
    }

    /// Run `hyprctl <args...> -j` (or without -j if json=false) and return stdout.
    fn run(args: &[&str], json: bool) -> Result<String, AppError> {
        let bin = Self::bin()?;
        let mut all = args.to_vec();
        if json {
            all.push("-j");
        }
        let output = Command::new(&bin)
            .args(&all)
            .output()
            .map_err(|e| AppError::HyprctlExec(e.to_string()))?;
        if !output.status.success() {
            return Err(AppError::HyprctlStatus(
                String::from_utf8_lossy(&output.stderr).to_string(),
            ));
        }
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    /// `hyprctl monitors -j`
    pub fn monitors() -> Result<String, AppError> {
        Self::run(&["monitors"], true)
    }

    /// `hyprctl workspaces -j`
    pub fn workspaces() -> Result<String, AppError> {
        Self::run(&["workspaces"], true)
    }

    /// Apply a config statement via `hyprctl eval` (Hyprland 0.45+ Lua parser).
    /// `statement` is a single Lua line like `monitor = "..."` or
    /// `workspace = "1,monitor:eDP-1"`. The value side must already be quoted.
    pub fn eval(statement: &str) -> Result<String, AppError> {
        Self::run(&["eval", statement], false)
    }

    /// Legacy `hyprctl keyword` — kept for compatibility but Hyprland 0.45+
    /// rejects it for most keywords with "Use eval". Prefer [`Self::eval`].
    pub fn keyword(key: &str, value: &str) -> Result<(), AppError> {
        let _ = Self::run(&["keyword", key, value], false)?;
        Ok(())
    }

    /// `hyprctl reload`
    pub fn reload() -> Result<(), AppError> {
        Self::run(&["reload"], false)?;
        Ok(())
    }

    /// `hyprctl dispatch <dispatcher> <arg>`
    pub fn dispatch(dispatcher: &str, arg: &str) -> Result<(), AppError> {
        Self::run(&["dispatch", dispatcher, arg], false)?;
        Ok(())
    }

    /// `hyprctl version` (raw, for debugging).
    pub fn version() -> Result<String, AppError> {
        Self::run(&["version"], false)
    }
}
