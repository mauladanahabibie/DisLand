import { useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import { api, isTauri } from "@/lib/api";
import { toast } from "@/hooks/useToast";

/** Continuously polls hyprctl for monitor hotplug events.
 *  When a monitor is connected or disconnected (and autoDetect is on),
 *  shows a non-intrusive toast offering to refresh.
 */
export function useHotplugWatcher() {
  const autoDetect = useStore((s) => s.settings.autoDetect);
  const dirty = useStore((s) => s.dirty);
  const refresh = useStore((s) => s.refresh);
  const knownRef = useRef<string[]>([]);

  // capture current known names
  useEffect(() => {
    knownRef.current = useStore.getState().monitors.map((m) => m.name);
  }, [useStore.getState().monitors]);

  useEffect(() => {
    if (!isTauri() || !autoDetect) return;
    const POLL_MS = 4000;
    const id = window.setInterval(async () => {
      try {
        const known = knownRef.current;
        const ev = await api.detectHotplug(known);
        // Monitors being mirrored are omitted by `hyprctl monitors -j`
        // (they clone another output). Exclude them from "disconnected"
        // so we don't spam a false toast while mirroring is active.
        const mirroringNames = new Set(
          useStore
            .getState()
            .monitors.filter((m) => m.mirrorOf)
            .map((m) => m.name),
        );
        const realDisconnected = ev.disconnected.filter(
          (n) => !mirroringNames.has(n),
        );
        const hasChange = ev.connected.length > 0 || realDisconnected.length > 0;
        if (!hasChange) return;
        // update known — keep mirrored names in `known` so they don't re-trigger
        knownRef.current = ev.connected.length
          ? [...known, ...ev.connected]
          : known.filter((n) => !realDisconnected.includes(n));
        if (realDisconnected.length > 0) {
          toast.warning(
            "Monitor disconnected",
            `${realDisconnected.join(", ")} — refresh layout?`,
          );
          // auto-refresh so the canvas stays accurate, but never auto-apply.
          if (!dirty) await refresh();
        }
        if (ev.connected.length > 0) {
          toast.info(
            "Monitor connected",
            `${ev.connected.join(", ")} — refresh to configure.`,
          );
          if (!dirty) await refresh();
        }
      } catch {
        // silent — hyprctl may briefly fail during transitions
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [autoDetect, dirty, refresh]);
}
