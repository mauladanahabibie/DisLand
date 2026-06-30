import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MonitorCog, FolderCog, Settings as SettingsIcon, Sliders } from "lucide-react";
import { useStore } from "@/store/useStore";
import { applyThemeToDocument } from "@/store/useStore";
import { LayoutPresets } from "@/components/LayoutPresets";
import { useHotplugWatcher } from "@/hooks/useHotplugWatcher";
import { TitleBar } from "@/components/TitleBar";
import { DisplayCanvas } from "@/components/canvas/DisplayCanvas";
import { PropertyPanel } from "@/components/panels/PropertyPanel";
import { ProfilesPanel } from "@/components/panels/ProfilesPanel";
import { SettingsDialog } from "@/components/panels/SettingsDialog";
import { ApplyBar } from "@/components/ApplyBar";
import { Toast, ToastProvider, ToastViewport } from "@/components/ui/Toast";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";

type SidebarTab = "displays" | "profiles" | "settings";

const TABS: { id: SidebarTab; label: string; icon: typeof MonitorCog }[] = [
  { id: "displays", label: "Displays", icon: MonitorCog },
  { id: "profiles", label: "Profiles", icon: FolderCog },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          variant={t.variant}
          title={t.title}
          description={t.description}
          onOpenChange={(o) => !o && dismiss(t.id)}
        />
      ))}
      <ToastViewport />
    </>
  );
}

function AppInner() {
  const init = useStore((s) => s.init);
  const loading = useStore((s) => s.loading);
  const theme = useStore((s) => s.settings.theme);
  const accent = useStore((s) => s.settings.accent);
  const animSpeed = useStore((s) => s.settings.animationSpeed);
  const monitors = useStore((s) => s.monitors);

  const [tab, setTab] = useState<SidebarTab>("displays");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useHotplugWatcher();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    applyThemeToDocument(theme, accent as never);
  }, [theme, accent]);

  const dur = 0.18 / Math.max(0.1, animSpeed);

  return (
    <div className="h-screen w-screen flex flex-col bg-bg text-fg overflow-hidden">
      <TitleBar />

      <div className="flex-1 flex min-h-0">
        {/* sidebar */}
        <nav className="w-14 shrink-0 border-r border-border-subtle bg-bg-elevated/60 backdrop-blur-xl flex flex-col items-center py-3 gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() =>
                t.id === "settings" ? setSettingsOpen(true) : setTab(t.id)
              }
              className={cn(
                "h-10 w-10 rounded-md flex items-center justify-center transition-colors",
                "text-fg-muted hover:text-fg hover:bg-bg-hover",
                tab === t.id && t.id !== "settings" && "bg-bg-hover text-fg",
              )}
              title={t.label}
              aria-label={t.label}
            >
              <t.icon className="h-4 w-4" />
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => setSettingsOpen(true)}
            className="h-10 w-10 rounded-md flex items-center justify-center text-fg-muted hover:text-fg hover:bg-bg-hover"
            title="Settings"
            aria-label="Settings"
          >
            <Sliders className="h-4 w-4" />
          </button>
        </nav>

        {/* content */}
        <main className="flex-1 flex min-w-0">
          {/* canvas + right panel for displays tab */}
          <div className="flex-1 flex flex-col min-w-0">
            {tab === "displays" && !loading && (
              <div className="h-11 shrink-0 flex items-center gap-2 px-3 border-b border-border-subtle bg-bg-elevated/40">
                <LayoutPresets />
                <span className="text-[10px] text-fg-subtle">
                  Atur otomatis posisi monitor
                </span>
              </div>
            )}
            <div className="flex-1 flex min-h-0">
              <div className="flex-1 p-3 min-w-0">
                {loading ? (
                  <div className="h-full w-full rounded-xl border border-border-subtle bg-bg-elevated/40 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-5 w-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                      <span className="text-xs text-fg-muted">Detecting monitors...</span>
                    </div>
                  </div>
                ) : (
                  <DisplayCanvas />
                )}
              </div>

              {/* right panel: property or profiles */}
              <AnimatePresence mode="wait">
                {tab === "displays" ? (
                  <motion.aside
                    key="props"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 320 }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: dur, ease: [0.2, 0.8, 0.2, 1] }}
                    className="shrink-0 border-l border-border-subtle bg-bg-elevated/60 backdrop-blur-xl overflow-hidden"
                  >
                    <div className="h-full w-80">
                      <PropertyPanel />
                    </div>
                  </motion.aside>
                ) : (
                  <motion.aside
                    key="profiles"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 320 }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: dur, ease: [0.2, 0.8, 0.2, 1] }}
                    className="shrink-0 border-l border-border-subtle bg-bg-elevated/60 backdrop-blur-xl overflow-hidden"
                  >
                    <div className="h-full w-80">
                      <ProfilesPanel />
                    </div>
                  </motion.aside>
                )}
              </AnimatePresence>
            </div>

            <ApplyBar />
          </div>
        </main>
      </div>

      {monitors.length === 0 && !loading && (
        <div className="absolute inset-0 top-10 flex items-center justify-center pointer-events-none">
          <div className="surface-flat rounded-xl px-6 py-5 text-center max-w-sm pointer-events-auto">
            <MonitorCog className="h-7 w-7 text-fg-subtle mx-auto mb-2" />
            <div className="text-sm font-medium text-fg">No monitors detected</div>
            <div className="text-xs text-fg-muted mt-1">
              Make sure Hyprland is running, then press Refresh.
            </div>
          </div>
        </div>
      )}

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider duration={4000}>
      <TooltipProvider delayDuration={200}>
        <AppInner />
        <Toaster />
      </TooltipProvider>
    </ToastProvider>
  );
}
