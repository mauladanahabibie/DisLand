import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Copy } from "lucide-react";
import { isTauri } from "@/lib/api";
import { cn } from "@/lib/utils";

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    const w = getCurrentWindow();
    w.isMaximized().then(setMaximized).catch(() => {});
    const unlisten = w.onResized(() => {
      w.isMaximized().then(setMaximized).catch(() => {});
    });
    return () => {
      unlisten.then((u) => u()).catch(() => {});
    };
  }, []);

  const onMinimize = () => isTauri() && getCurrentWindow().minimize();
  const onToggleMax = () =>
    isTauri() && getCurrentWindow().toggleMaximize();
  const onClose = () => isTauri() && getCurrentWindow().close();

  return (
    <div
      data-tauri-drag-region
      className="h-10 shrink-0 flex items-center justify-between px-3 border-b border-border-subtle bg-bg-elevated/80 backdrop-blur-xl"
    >
      <div data-tauri-drag-region className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          <span className="text-xs font-semibold text-fg">DisplaySet</span>
        </div>
        <span className="text-[10px] text-fg-subtle hidden sm:block">
          · Hyprland Display Manager
        </span>
      </div>

      <div className="flex items-center gap-0.5">
        <button
          onClick={onMinimize}
          className={cn(
            "h-7 w-9 inline-flex items-center justify-center text-fg-muted",
            "hover:bg-bg-hover hover:text-fg rounded-md transition-colors",
          )}
          aria-label="Minimize"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onToggleMax}
          className={cn(
            "h-7 w-9 inline-flex items-center justify-center text-fg-muted",
            "hover:bg-bg-hover hover:text-fg rounded-md transition-colors",
          )}
          aria-label="Maximize"
        >
          {maximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
        </button>
        <button
          onClick={onClose}
          className={cn(
            "h-7 w-9 inline-flex items-center justify-center text-fg-muted",
            "hover:bg-danger hover:text-danger-fg rounded-md transition-colors",
          )}
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
