import { motion } from "framer-motion";
import { Monitor as MonitorIcon, Star, Wifi } from "lucide-react";
import type { MonitorConfig } from "@/types";
import { formatHz } from "@/lib/utils";
import { Badge } from "@/components/ui/Misc";

interface Props {
  monitor: MonitorConfig;
  selected: boolean;
  scale: number;
  left: number;
  top: number;
  width: number;
  height: number;
  onAnimationEnd?: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
}

export function MonitorCard({
  monitor,
  selected,
  left,
  top,
  width,
  height,
  onPointerDown,
}: Props) {
  const resolution = `${monitor.width}×${monitor.height}`;
  const tooSmall = width < 150 || height < 90;

  return (
    <motion.div
      className={
        "absolute cursor-grab active:cursor-grabbing select-none " +
        "rounded-lg border overflow-hidden " +
        (selected
          ? "border-accent shadow-pop z-20"
          : "border-border-strong hover:border-border-strong z-10")
      }
      style={{
        left,
        top,
        width,
        height,
        background:
          "linear-gradient(180deg, hsl(var(--bg-elevated) / 0.85), hsl(var(--bg-surface) / 0.95))",
        backdropFilter: "blur(8px)",
      }}
      initial={{ opacity: 0.6 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      onPointerDown={onPointerDown}
      role="button"
      aria-label={`Monitor ${monitor.name}`}
      tabIndex={0}
    >
      {/* subtle inner top highlight */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "hsl(0 0% 100% / 0.06)" }}
      />

      {/* header */}
      <div className="absolute top-0 inset-x-0 px-2.5 py-1.5 flex items-center gap-1.5">
        <MonitorIcon className="h-3 w-3 text-fg-muted shrink-0" />
        <span className="text-[11px] font-medium text-fg truncate flex-1">
          {monitor.name}
        </span>
        {monitor.primary && (
          <Badge variant="accent" className="h-4 px-1">
            <Star className="h-2.5 w-2.5" />
            Primary
          </Badge>
        )}
        {monitor.mirrorOf && (
          <Badge variant="outline" className="h-4 px-1">
            <Wifi className="h-2.5 w-2.5" />
            Mirror
          </Badge>
        )}
      </div>

      {/* center info */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2 pointer-events-none">
        {!tooSmall ? (
          <>
            <div className="text-base font-semibold text-fg leading-tight">
              {resolution}
            </div>
            <div className="text-[11px] text-fg-muted mt-0.5">
              {formatHz(monitor.refreshRate)} · {monitor.scale}×
            </div>
            <div className="text-[10px] text-fg-subtle mt-1">
              WS {monitor.activeWorkspace} · {monitor.x},{monitor.y}
            </div>
          </>
        ) : (
          <div className="text-[10px] text-fg-muted">{monitor.name}</div>
        )}
      </div>

      {/* disabled overlay */}
      {!monitor.enabled && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <span className="text-[10px] uppercase tracking-wide text-fg-muted">
            Disabled
          </span>
        </div>
      )}
    </motion.div>
  );
}
