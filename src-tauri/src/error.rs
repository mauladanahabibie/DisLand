use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("`hyprctl` binary was not found on PATH. Is Hyprland running?")]
    HyprctlMissing,

    #[error("Failed to execute hyprctl: {0}")]
    HyprctlExec(String),

    #[error("hyprctl returned an error: {0}")]
    HyprctlStatus(String),

    #[error("Failed to parse {0}")]
    Parse(String),

    #[error("Validation failed: {0}")]
    Validation(String),

    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    #[error("I/O error: {0}")]
    Io(String),

    #[error("Profile error: {0}")]
    Profile(String),

    #[error("Rollback error: {0}")]
    Rollback(String),

    #[error("No monitors detected")]
    NoMonitors,

    #[error("{0}")]
    Other(String),
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Parse(e.to_string())
    }
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
