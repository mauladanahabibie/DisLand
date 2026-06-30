# DisplaySet

A modern GUI Display Manager for **Hyprland**. Replace manual `hyprland.conf`
editing with a drag-and-drop interface inspired by Windows Display Settings,
KDE Plasma, and end-4/dots-hyprland.

> This is not a CLI wrapper. It is a real desktop settings application.

## Features

- **Visual canvas** with draggable monitor cards, snap/alignment guides,
  zoom/pan, and keyboard nudging (arrow keys, shift = 50px step).
- **Property panel** — resolution, refresh rate, scale, rotation, mirror,
  enable/disable, VRR, adaptive sync, primary, workspace assignment.
- **Live preview + Apply** — changes only apply when you press Apply.
  Validation runs first (overlaps, unsupported modes, duplicate positions,
  mirror targets, scale bounds). A backup is taken before every apply.
- **Automatic rollback** — if monitors disappear after apply, the previous
  configuration is restored automatically (never leaves you with a black screen).
- **Profiles** — save / load / duplicate / delete / export JSON / import JSON.
- **Hotplug detection** — polls `hyprctl monitors -j` and notifies on connect
  / disconnect. Never auto-applies.
- **Settings** — theme (dark/light), accent color, animation speed, language,
  auto-backup, auto-detect, confirm-before-apply, backup count.
- **Design language** — neutral dark, monochrome-first, accent only on
  interaction, thin 1px borders, subtle blur, minimal shadows. Matches the
  Hyprland ricing ecosystem aesthetic.

## Tech stack

| Layer        | Tech                                              |
| ------------ | ------------------------------------------------- |
| Frontend     | React, TypeScript, Vite, TailwindCSS, Framer Motion |
| Primitives   | Radix UI (unstyled) + custom CSS components       |
| Desktop      | Tauri v2                                          |
| Backend      | Rust                                              |
| IPC          | Tauri commands                                    |
| Detection    | `hyprctl monitors -j` / `hyprctl workspaces -j`  |
| Application  | `hyprctl keyword monitor` + `hyprctl reload`      |

## Project structure

```
DisplaySet/
├── src/                          # React frontend
│   ├── components/
│   │   ├── canvas/               # DisplayCanvas + MonitorCard (drag & drop)
│   │   ├── panels/               # PropertyPanel, ProfilesPanel, SettingsDialog, LivePreviewDialog
│   │   ├── ui/                   # Custom Radix-based primitives (Button, Select, Switch, …)
│   │   ├── ApplyBar.tsx          # Apply / rollback / discard / refresh toolbar
│   │   └── TitleBar.tsx          # Custom window controls (no decorations)
│   ├── hooks/                    # useToast, useHotplugWatcher, useTheme
│   ├── lib/                      # api.ts (IPC bindings), layout.ts (snap math), utils.ts
│   ├── store/useStore.ts         # zustand global state
│   ├── types/index.ts            # shared types (mirror Rust models)
│   ├── App.tsx                   # app shell (sidebar + canvas + panels)
│   └── main.tsx
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── hyprland/             # hyprctl wrapper + models + service
│   │   ├── config/               # generator, validation, rollback, profile
│   │   ├── hotplug.rs            # hotplug detection
│   │   ├── settings.rs           # settings store (persisted JSON)
│   │   ├── commands.rs           # Tauri IPC commands
│   │   ├── error.rs              # typed errors (no panics)
│   │   └── lib.rs                # Tauri builder
│   ├── capabilities/             # Tauri permissions
│   └── tauri.conf.json
└── package.json
```

## Architecture

Clean separation:

- **Frontend** — React UI, only knows about typed `MonitorConfig` objects.
- **State** — zustand store holds the editable layout; every mutation marks
  the state `dirty`. Nothing is written to Hyprland until `apply()`.
- **IPC layer** — `src/lib/api.ts` wraps every `#[tauri::command]` with a
  typed signature.
- **Hyprland service** (`src-tauri/src/hyprland/service.rs`) — high-level
  operations: `snapshot_configs`, `apply_monitor`, `apply_workspace_rule`.
- **Config generator** (`config/generator.rs`) — renders canonical
  `monitor=...` spec lines.
- **Validation engine** (`config/validation.rs`) — overlap detection, mode
  validation, mirror-target checks, scale bounds.
- **Rollback engine** (`config/rollback.rs`) — snapshot/restore with a
  known-good log.
- **Profile manager** (`config/profile.rs`) — JSON files under
  `~/.config/displayset/profiles/`.

## Development

```bash
# 1. Install JS deps
npm install

# 2. Run the app (launches Vite + Tauri dev window)
npx tauri dev

# 3. Type-check
npm run typecheck

# 4. Production build (binary + .deb + .rpm)
npx tauri build
```

The binary is written to `src-tauri/target/release/displayset`.

## System requirements

- Hyprland (running, with `hyprctl` on `$PATH`)
- WebKitGTK 4.1, GTK3, libsoup-3 (standard on Arch/Fedora/Debian with Tauri deps)
- Rust 1.77+, Node 20+

## Dev mode

When the frontend is opened in a plain browser (outside Tauri), the store
falls back to mock monitor data so the UI is fully explorable without
Hyprland. All Apply / Profile actions toast a "dev mode" message instead of
touching the system.
