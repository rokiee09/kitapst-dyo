import { useState } from "react";
import { History } from "lucide-react";
import { tr } from "@/i18n/tr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { chapterService } from "@/services";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function VersionMenu() {
  const versions = useWorkspaceStore((state) => state.versions);
  const createVersion = useWorkspaceStore((state) => state.createVersion);
  const restoreVersion = useWorkspaceStore((state) => state.restoreVersion);
  const [version, setVersion] = useState("1.1.0");
  const [changelog, setChangelog] = useState("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm">
          <History size={14} />
          {tr.versions.title}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>{tr.versions.title}</DropdownMenuLabel>
        {versions.length === 0 ? (
          <div className="px-2 py-2 text-xs text-[#8aa0bd]">{tr.versions.empty}</div>
        ) : (
          versions.map((item) => (
            <DropdownMenuItem
              key={item.id}
              className="flex-col items-start gap-1"
              onSelect={() => {
                if (!item.hasSnapshot) return;
                if (!window.confirm(`v${item.version} geri yüklensin mi? Mevcut içerik bu sürüme döner.`)) return;
                void restoreVersion(item.id).then(async () => {
                  const chapterId = useWorkspaceStore.getState().selectedChapterId;
                  if (chapterId) {
                    const blocks = await chapterService.setActive(chapterId);
                    useEditorStore.getState().setBlocks(blocks);
                  }
                });
              }}
            >
              <span className="font-medium">v{item.version}</span>
              <span className="text-xs text-[#8aa0bd]">{item.changelog ?? "—"}</span>
              <span className="text-[10px] text-blue-300">
                {item.hasSnapshot ? "Tıkla: geri yükle" : "İçerik kopyası yok"}
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <div className="space-y-2 p-2" onClick={(event) => event.stopPropagation()}>
          <Label htmlFor="version-number">{tr.versions.version}</Label>
          <Input id="version-number" value={version} onChange={(event) => setVersion(event.target.value)} />
          <Label htmlFor="version-notes">{tr.versions.changelog}</Label>
          <Textarea
            id="version-notes"
            value={changelog}
            onChange={(event) => setChangelog(event.target.value)}
            rows={3}
          />
          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              void createVersion(version, changelog);
              setChangelog("");
            }}
          >
            {tr.versions.create}
          </Button>
          <p className="text-[11px] leading-4 text-[#8aa0bd]">
            İlk sürüm oluşturma kitabın o andaki tam kopyasını saklar. Listeden tıklayarak geri yükleyebilirsiniz.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
