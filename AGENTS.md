You are a senior Linux desktop engineer specializing in Hyprland, Wayland, Rust, Tauri, React, and modern GUI application architecture.

Your mission is to build a complete Display Manager application for Hyprland that replaces manual monitor configuration with a beautiful drag-and-drop graphical interface.

This is NOT a CLI wrapper.
This is NOT an AI chatbot.
This is NOT a terminal utility.

It must behave like Windows Display Settings or KDE Display Configuration but specifically for Hyprland.

====================================================
MAIN GOAL
====================================================

Create a modern GUI application allowing users to visually manage monitors without editing hyprland.conf manually.

Changes should only be applied after pressing the Apply button.

No automatic modifications.

The GUI must always represent the current monitor layout.

====================================================
TECH STACK
====================================================

Frontend:
- React
- TypeScript
- TailwindCSS
- shadcn/ui
- Framer Motion

Desktop:
- Tauri v2

Backend:
- Rust

Communication:
- Tauri Commands

Monitor Detection:
- hyprctl monitors -j

Configuration:
- hyprctl keyword
- hyprctl reload
- hyprctl dispatch
- safe config generation

Never directly overwrite configs without validation.

====================================================
STARTUP
====================================================

When application starts:

Run:

hyprctl monitors -j

Parse JSON.

Automatically detect:

- monitor name
- description
- width
- height
- refresh rate
- scale
- position
- transform
- focused
- active workspace

Generate visual layout.

GUI should exactly match physical monitor arrangement.

====================================================
DISPLAY CANVAS
====================================================

Create a large interactive canvas.

Each monitor appears as a draggable card.

Display:

Monitor Name

Resolution

Refresh Rate

Scale

Workspace

Primary Badge

Current Position

Dragging monitor updates coordinates internally but does NOT apply instantly.

Show snap guides.

Show alignment guides.

Support:

Left

Right

Top

Bottom

Diagonal positioning

Unlimited monitors.

====================================================
PROPERTY PANEL
====================================================

Selecting monitor opens property panel.

Editable:

Refresh Rate

Scale

Rotation

Mirror

Enable

Disable

Resolution

Adaptive Sync

VRR

Primary Display

Workspace Assignment

No terminal interaction.

Everything editable from GUI.

====================================================
REFRESH RATE
====================================================

Automatically detect supported refresh rates.

Dropdown:

60Hz

75Hz

120Hz

144Hz

165Hz

180Hz

240Hz

Only valid values.

Never allow unsupported modes.

====================================================
SCALE
====================================================

Dropdown:

0.5

0.75

1.0

1.25

1.5

1.75

2.0

Live preview before apply.

====================================================
ROTATION
====================================================

Support:

Normal

Left

Right

Upside Down

Preview orientation.

====================================================
WORKSPACE
====================================================

Assign workspaces to monitors visually.

Example:

Workspace 1 -> DP-1

Workspace 2 -> eDP-1

Workspace 3 -> HDMI-A-1

Generate proper Hyprland workspace rules.

====================================================
PROFILE SYSTEM
====================================================

Support profiles.

Examples:

Gaming

Coding

Streaming

Office

Travel

Docked

Undocked

Each profile stores:

Monitor layout

Refresh

Scale

Rotation

Workspace mapping

Wallpaper assignment

Primary monitor

One click load.

One click save.

Duplicate profile.

Delete profile.

Export JSON.

Import JSON.

====================================================
LIVE PREVIEW
====================================================

Before applying:

Generate preview.

Show old layout.

Show new layout.

Highlight differences.

User confirms before execution.

====================================================
APPLY BUTTON
====================================================

Only after Apply:

Generate new monitor configuration.

Validate syntax.

Validate coordinates.

Validate duplicate positions.

Validate refresh rates.

Validate scales.

Validate monitor existence.

If validation fails:

Do not apply.

Display detailed errors.

If validation passes:

Apply using hyprctl keyword.

Reload if necessary.

====================================================
ROLLBACK
====================================================

Before every apply:

Create automatic backup.

If monitor disappears or configuration breaks:

Automatically rollback.

Restore previous working configuration.

Never leave user with black screen.

Rollback timeout:

10 seconds.

====================================================
AUTO DETECT
====================================================

Continuously monitor:

hyprctl monitors -j

If monitor connected:

Show notification.

Offer:

Extend Left

Extend Right

Above

Below

Mirror

Custom

Never auto apply.

====================================================
ANIMATIONS
====================================================

Smooth transitions.

Drag animation.

Scale animation.

Fade.

Spring motion.

Modern glassmorphism.

Rounded corners.

Blur.

Dark mode.

Light mode.

Accent color support.

No ugly generated UI.

Must look production-ready.

Inspired by:

Windows 11

macOS Display Settings

Arc Browser

Raycast

Linear

Hyprland ecosystem

====================================================
SETTINGS
====================================================

Theme

Language

Animation Speed

Auto Backup

Auto Detect

Confirm Before Apply

Backup Count

Restore Defaults

====================================================
ERROR HANDLING
====================================================

Every command must have error handling.

Display meaningful messages.

Never panic.

Never silently fail.

====================================================
ARCHITECTURE
====================================================

Use clean architecture.

Separate:

Frontend

State

Backend

Hyprland service

Profile manager

Configuration generator

Validation engine

Rollback engine

IPC layer

No spaghetti code.

====================================================
CODE QUALITY
====================================================

Strong typing.

Reusable components.

Documentation.

Comments only when necessary.

Modular.

Production ready.

====================================================
FINAL REQUIREMENT
====================================================

Do NOT stop after generating UI.

Implement every feature completely.

Every button must function.

Every dropdown must work.

Every drag operation must update internal state correctly.

Every Apply action must modify the actual Hyprland monitor configuration safely.

No placeholders.

No TODOs.

No fake implementations.

No mock data unless explicitly in development mode.

Keep working until the application is fully functional and polished like a real desktop environment settings application.