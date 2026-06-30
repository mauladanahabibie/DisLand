import { useMemo } from "react";
import { motion } from "framer-motion";
import { Check, X, AlertTriangle, ArrowRight } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Misc";
import { effectiveSize } from "@/lib/layout";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function LivePreviewDialog({ open, onClose, onConfirm }: Props) {
  const monitors = useStore((s) => s.monitors);
  const applying = useStore((s) => s.applying);
  const confirmBefore = useStore((s) => s.settings.confirmBeforeApply);

  const snapshot = useMemo(() => monitors, [monitors]);
  const hasChanges = snapshot.length > 0;
  void confirmBefore;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Confirm changes
          </DialogTitle>
          <DialogDescription>
            Review the pending configuration before applying it to Hyprland.
            A backup will be created automatically; you can roll back anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto scrollbar-thin space-y-2 -mx-1 px-1">
          {snapshot.map((m) => {
            const [w, h] = effectiveSize(m);
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-md border border-border-subtle bg-bg-surface px-3 py-2"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-fg">{m.name}</span>
                  {m.primary && <Badge variant="accent">Primary</Badge>}
                  {!m.enabled && <Badge variant="warning">Disabled</Badge>}
                  <span className="ml-auto text-[10px] text-fg-subtle">
                    {w}×{h} · {Math.round(m.refreshRate)}Hz · {m.scale}×
                  </span>
                </div>
                <div className="text-[11px] text-fg-muted">
                  Position {m.x}, {m.y}
                  {m.mirrorOf && ` · mirrors ${m.mirrorOf}`}
                  {m.vrr && " · VRR on"}
                </div>
              </motion.div>
            );
          })}
          {!hasChanges && (
            <div className="text-center py-8 text-xs text-fg-muted">
              No monitors to apply.
            </div>
          )}
        </div>

        <div className="mt-4 rounded-md bg-bg-surface border border-border-subtle px-3 py-2 text-[11px] text-fg-muted flex items-center gap-2">
          <ArrowRight className="h-3 w-3 text-accent" />
          Applying will run <code className="text-fg">hyprctl keyword monitor ...</code> for each display.
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button variant="accent" onClick={onConfirm} disabled={applying || !hasChanges}>
            <Check className="h-3.5 w-3.5" />
            {applying ? "Applying..." : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
