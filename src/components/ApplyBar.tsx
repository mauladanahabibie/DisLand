import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Undo2,
  RotateCcw,
  RefreshCw,
  Eye,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/Button";
import { LivePreviewDialog } from "@/components/panels/LivePreviewDialog";
import { cn } from "@/lib/utils";

export function ApplyBar() {
  const dirty = useStore((s) => s.dirty);
  const applying = useStore((s) => s.applying);
  const apply = useStore((s) => s.apply);
  const rollback = useStore((s) => s.rollbackNow);
  const discard = useStore((s) => s.discardChanges);
  const refresh = useStore((s) => s.refresh);
  const validate = useStore((s) => s.validate);
  const lastValidation = useStore((s) => s.lastValidation);
  const confirmBefore = useStore((s) => s.settings.confirmBeforeApply);
  const monitors = useStore((s) => s.monitors);

  const [previewOpen, setPreviewOpen] = useState(false);

  const onApplyClick = async () => {
    // always validate first so the user sees issues
    const res = await validate();
    if (!res.valid) return;
    if (confirmBefore) {
      setPreviewOpen(true);
    } else {
      await apply();
    }
  };

  const onConfirm = async () => {
    setPreviewOpen(false);
    await apply();
  };

  const enabledCount = monitors.filter((m) => m.enabled).length;

  return (
    <>
      <div className="h-14 shrink-0 flex items-center gap-2 px-3 border-t border-border-subtle bg-bg-elevated/70 backdrop-blur-xl">
        {/* status */}
        <div className="flex items-center gap-2 text-[11px] text-fg-muted min-w-0">
          <AnimatePresence mode="wait">
            {dirty ? (
              <motion.span
                key="dirty"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 4 }}
                className="flex items-center gap-1.5 text-warning"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                Unsaved changes
              </motion.span>
            ) : (
              <motion.span
                key="clean"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 4 }}
                className="flex items-center gap-1.5 text-success"
              >
                <CheckCircle2 className="h-3 w-3" />
                In sync
              </motion.span>
            )}
          </AnimatePresence>
          <span className="text-fg-subtle">·</span>
          <span>{enabledCount} active</span>

          {lastValidation && !lastValidation.valid && (
            <span className="flex items-center gap-1 text-danger ml-2">
              <AlertCircle className="h-3 w-3" />
              {lastValidation.errors.length} issue{lastValidation.errors.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* validation errors popover */}
        {lastValidation && !lastValidation.valid && (
          <div className="hidden md:flex items-center max-w-[40%] overflow-hidden">
            <span className="text-[10px] text-danger truncate">
              {lastValidation.errors[0]}
            </span>
          </div>
        )}

        <Button variant="ghost" size="sm" onClick={refresh} title="Re-read from Hyprland">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={rollback}
          title="Rollback to last known-good"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Rollback
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={discard}
          disabled={!dirty}
          title="Discard pending changes"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Discard
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreviewOpen(true)}
          disabled={!dirty || applying}
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </Button>
        <Button
          variant="accent"
          size="sm"
          onClick={onApplyClick}
          disabled={!dirty || applying}
          className={cn(applying && "animate-pulse")}
        >
          <Check className="h-3.5 w-3.5" />
          {applying ? "Applying..." : "Apply"}
        </Button>
      </div>

      <LivePreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onConfirm={onConfirm}
      />
    </>
  );
}
