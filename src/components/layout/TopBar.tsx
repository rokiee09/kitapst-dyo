import { BookOpen, Download, Eye, FileInput, FolderOpen, Library, Plus, Save, Settings } from "lucide-react";
import { toast } from "sonner";
import { tr } from "@/i18n/tr";
import { Button } from "@/components/ui/button";
import { SaveStatusBadge } from "@/components/layout/SaveStatusBadge";
import { VersionMenu } from "@/features/versions/VersionMenu";
import { useEditorStore } from "@/stores/editorStore";
import { useUiStore } from "@/stores/uiStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { chapterService, folderService } from "@/services";
import { importWordIntoChapter } from "@/features/import/importWord";

export function TopBar() {
  const book = useWorkspaceStore((state) => state.book);
  const versions = useWorkspaceStore((state) => state.versions);
  const createChapter = useWorkspaceStore((state) => state.createChapter);
  const setView = useUiStore((state) => state.setView);
  const previewing = useUiStore((state) => state.previewing);
  const togglePreview = useUiStore((state) => state.togglePreview);
  const initials = initialsFrom(book?.author || book?.title || "KS");
  const latest = versions[0]?.version ?? "1.0.0";

  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#1c314c] bg-[#0c1829] px-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white shadow">
          <BookOpen size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-bold tracking-wide">{tr.appName.toLocaleUpperCase("tr")}</div>
          <div className="text-[11px] text-[#8aa0b8]">{book?.title || tr.subtitle}</div>
        </div>
        <div className="ml-4 hidden items-center gap-1.5 md:flex">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void (async () => {
                const chapter = await createChapter(null);
                if (chapter) {
                  const blocks = await chapterService.setActive(chapter.id);
                  useEditorStore.getState().setBlocks(blocks);
                }
              })();
            }}
          >
            <Plus size={14} />
            Yeni
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setView("library")}>
            <Library size={14} />
            Kitaplar
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void folderService
                .open("project")
                .then((path) => toast.success(`Proje klasörü: ${path}`))
                .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Klasör açılamadı."));
            }}
          >
            <FolderOpen size={14} />
            Aç
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void importWordIntoChapter()}>
            <FileInput size={14} />
            Word
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void useEditorStore.getState().flushSave()}>
            <Save size={14} />
            Kaydet
          </Button>
          <Button size="sm" onClick={() => setView("export")}>
            <Download size={14} />
            Dışa Aktar
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <VersionMenu />
        <span className="hidden text-xs text-[#8aa0b8] lg:inline">v{latest}</span>
        <Button
          size="sm"
          variant={previewing ? "default" : "secondary"}
          onClick={togglePreview}
        >
          <Eye size={14} />
          {previewing ? "Önizleme açık" : "Önizleme"}
        </Button>
        <SaveStatusBadge />
        <Button size="icon" variant="ghost" onClick={() => setView("settings")} aria-label="Ayarlar">
          <Settings size={16} />
        </Button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold">
          {initials}
        </div>
      </div>
    </header>
  );
}

function initialsFrom(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toLocaleUpperCase("tr");
  return value.slice(0, 2).toLocaleUpperCase("tr") || "KS";
}
