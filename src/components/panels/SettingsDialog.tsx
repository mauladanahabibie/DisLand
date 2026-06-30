import { useStore } from "@/store/useStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Slider } from "@/components/ui/Slider";
import { Separator } from "@/components/ui/Misc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { ACCENT_HUES, type AccentColor } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ACCENTS: AccentColor[] = ["blue", "violet", "emerald", "rose", "amber", "cyan"];

export function SettingsDialog({ open, onClose }: Props) {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const reset = useStore((s) => s.resetSettings);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure appearance and behaviour of DisplaySet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 max-h-[60vh] overflow-y-auto scrollbar-thin pr-1">
          {/* theme */}
          <div className="space-y-1.5">
            <Label>Theme</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {(["dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => update({ theme: t })}
                  className={
                    "h-9 rounded-md border text-xs capitalize transition-colors " +
                    (settings.theme === t
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border-subtle bg-bg-surface hover:bg-bg-hover text-fg-muted")
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* accent */}
          <div className="space-y-1.5">
            <Label>Accent color</Label>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a}
                  onClick={() => update({ accent: a })}
                  className={
                    "h-7 w-7 rounded-full border-2 transition-transform " +
                    (settings.accent === a ? "scale-110 border-fg" : "border-transparent hover:scale-105")
                  }
                  style={{ background: `hsl(${ACCENT_HUES[a]} 84% 60%)` }}
                  aria-label={a}
                />
              ))}
            </div>
          </div>

          <Separator />

          {/* animation speed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Animation speed</Label>
              <span className="text-[11px] text-fg-muted">{settings.animationSpeed.toFixed(2)}×</span>
            </div>
            <Slider
              value={settings.animationSpeed}
              min={0.5}
              max={2}
              step={0.1}
              onChange={(v) => update({ animationSpeed: v })}
              aria-label="Animation speed"
            />
          </div>

          <Separator />

          {/* language */}
          <div className="space-y-1.5">
            <Label>Language</Label>
            <Select value={settings.language} onValueChange={(v) => update({ language: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="id">Bahasa Indonesia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* toggles */}
          <Toggle
            label="Auto backup"
            description="Create a backup before every apply"
            checked={settings.autoBackup}
            onChange={(v) => update({ autoBackup: v })}
          />
          <Toggle
            label="Auto detect monitors"
            description="Watch for monitor hotplug events"
            checked={settings.autoDetect}
            onChange={(v) => update({ autoDetect: v })}
          />
          <Toggle
            label="Confirm before apply"
            description="Show a preview dialog before applying"
            checked={settings.confirmBeforeApply}
            onChange={(v) => update({ confirmBeforeApply: v })}
          />

          <Separator />

          {/* backup count */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Backup count</Label>
              <span className="text-[11px] text-fg-muted">{settings.backupCount}</span>
            </div>
            <Slider
              value={settings.backupCount}
              min={1}
              max={30}
              step={1}
              onChange={(v) => update({ backupCount: Math.round(v) })}
              aria-label="Backup count"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={reset}>
            Restore defaults
          </Button>
          <Button variant="accent" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-medium text-fg-muted">{children}</div>;
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-xs font-medium text-fg">{label}</div>
        {description && (
          <div className="text-[10px] text-fg-subtle mt-0.5">{description}</div>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
