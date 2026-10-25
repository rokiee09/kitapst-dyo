import { useEffect } from "react";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function DriveLiveSync() {
  const loaded = useWorkspaceStore((state) => state.loaded);
  const startDriveLiveSync = useWorkspaceStore((state) => state.startDriveLiveSync);

  useEffect(() => {
    if (!loaded) return;
    return startDriveLiveSync();
  }, [loaded, startDriveLiveSync]);

  return null;
}
