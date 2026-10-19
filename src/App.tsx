import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export default function App() {
  const load = useWorkspaceStore((state) => state.load);

  useEffect(() => {
    void load().then((snapshot) => {
      if (snapshot) {
        useEditorStore.getState().setBlocks(snapshot.selectedBlocks);
      }
    });
  }, [load]);

  return <AppShell />;
}
