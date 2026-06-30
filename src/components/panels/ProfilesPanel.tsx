import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Save,
  Copy,
  Trash2,
  Download,
  Upload,
  FolderOpen,
  MonitorCog,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { isTauri } from "@/lib/api";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";

export function ProfilesPanel() {
  const profiles = useStore((s) => s.profiles);
  const monitors = useStore((s) => s.monitors);
  const loadProfiles = useStore((s) => s.loadProfiles);
  const applyProfile = useStore((s) => s.applyProfile);
  const deleteProfile = useStore((s) => s.deleteProfile);
  const duplicateProfile = useStore((s) => s.duplicateProfile);
  const saveCurrentAsProfile = useStore((s) => s.saveCurrentAsProfile);
  const exportProfile = useStore((s) => s.exportProfile);
  const importProfile = useStore((s) => s.importProfile);
  const animSpeed = useStore((s) => s.settings.animationSpeed);

  const [newName, setNewName] = useState("");
  const [renameFor, setRenameFor] = useState<string | null>(null);
  const [rename, setRename] = useState("");

  const dur = 0.16 / Math.max(0.1, animSpeed);

  const onSaveCurrent = async () => {
    if (!newName.trim()) return;
    await saveCurrentAsProfile(newName.trim());
    setNewName("");
  };

  const onExport = async (id: string, name: string) => {
    if (!isTauri()) return;
    const json = await exportProfile(id);
    const path = await save({
      defaultPath: `${name.replace(/\s+/g, "-").toLowerCase()}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (path) await writeTextFile(path, json);
  };

  const onImport = async () => {
    if (!isTauri()) return;
    const path = await open({
      filters: [{ name: "JSON", extensions: ["json"] }],
      multiple: false,
    });
    if (typeof path === "string") {
      const text = await readTextFile(path);
      await importProfile(text);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
        <MonitorCog className="h-4 w-4 text-fg-muted" />
        <h3 className="text-sm font-semibold text-fg">Profiles</h3>
        <span className="ml-auto text-[10px] text-fg-subtle">{profiles.length}</span>
      </div>

      <div className="px-4 py-3 border-b border-border-subtle space-y-2">
        <Input
          placeholder="Profile name (e.g. Gaming, Docked)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSaveCurrent()}
        />
        <Button className="w-full" size="sm" onClick={onSaveCurrent} disabled={!newName.trim()}>
          <Save className="h-3.5 w-3.5" />
          Save current as profile
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onImport}>
            <Upload className="h-3.5 w-3.5" />
            Import
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={loadProfiles}>
            <Plus className="h-3.5 w-3.5" />
            Reload
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
        <AnimatePresence initial={false}>
          {profiles.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-3 py-8 text-center"
            >
              <FolderOpen className="h-6 w-6 text-fg-subtle mx-auto mb-2" />
              <div className="text-xs text-fg-muted">No profiles yet</div>
              <div className="text-[10px] text-fg-subtle mt-1">
                Save your current layout to reuse it later
              </div>
            </motion.div>
          )}
          {profiles.map((p) => (
            <motion.div
              key={p.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: dur }}
              className="group rounded-md border border-border-subtle bg-bg-surface hover:bg-bg-hover transition-colors"
            >
              {renameFor === p.id ? (
                <div className="p-2 flex gap-1.5">
                  <Input
                    value={rename}
                    onChange={(e) => setRename(e.target.value)}
                    autoFocus
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && rename.trim()) {
                        await duplicateProfile(p.id, rename.trim());
                        setRenameFor(null);
                        setRename("");
                      } else if (e.key === "Escape") {
                        setRenameFor(null);
                      }
                    }}
                    className="h-7 text-xs"
                  />
                  <Button size="sm" onClick={async () => {
                    if (rename.trim()) {
                      await duplicateProfile(p.id, rename.trim());
                    }
                    setRenameFor(null);
                    setRename("");
                  }}>
                    OK
                  </Button>
                </div>
              ) : (
                <>
                  <button
                    className="w-full text-left px-3 py-2"
                    onClick={() => applyProfile(p)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-fg truncate flex-1">{p.name}</span>
                    </div>
                    <div className="text-[10px] text-fg-subtle mt-0.5">
                      {p.monitors.length} monitors ·{" "}
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </div>
                  </button>
                  <div className="flex items-center gap-0.5 px-1.5 pb-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      title="Duplicate"
                      onClick={() => {
                        setRenameFor(p.id);
                        setRename(`${p.name} copy`);
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      title="Export JSON"
                      onClick={() => onExport(p.id, p.name)}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-danger hover:text-danger"
                      title="Delete"
                      onClick={() => deleteProfile(p.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {monitors.length === 0 && (
        <div className="px-4 py-2 text-[10px] text-fg-subtle border-t border-border-subtle">
          Load a profile then press Apply to activate it.
        </div>
      )}
    </div>
  );
}
