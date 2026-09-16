import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { isTauriRuntime } from "@/services/tauri/invoke";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { tr } from "@/i18n/tr";

export default function App() {
  const load = useWorkspaceStore((state) => state.load);
  const error = useWorkspaceStore((state) => state.error);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    void load().then((snapshot) => {
      if (snapshot) {
        useEditorStore.getState().setBlocks(snapshot.selectedBlocks);
      }
    });
  }, [load]);

  if (!isTauriRuntime()) {
    return (
      <div className="flex h-full items-center justify-center bg-[#070b14] p-8 text-[#d7e3f4]">
        <div className="max-w-lg rounded-lg border border-[#1c2a44] bg-[#0d1524] p-6">
          <h1 className="mb-2 text-lg font-semibold">{tr.appName}</h1>
          <p className="text-sm text-[#8aa0bd]">{tr.errors.tauriMissing}</p>
          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        </div>
      </div>
    );
  }

  return <AppShell />;
}
