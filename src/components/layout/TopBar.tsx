import {
  BookOpen,
  ChevronDown,
  Cloud,
  Download,
  Eye,
  FileInput,
  FolderOpen,
  History,
  Library,
  MoreHorizontal,
  Plus,
  Settings,
  Smartphone,
  SpellCheck,
  Tablet,
} from "lucide-react";
import { toast } from "sonner";
import { tr } from "@/i18n/tr";
import { Button } from "@/components/ui/button";
import { SaveStatusBadge } from "@/components/layout/SaveStatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEditorStore } from "@/stores/editorStore";
import { useUiStore } from "@/stores/uiStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { chapterService, folderService, projectService } from "@/services";
import { importWordIntoChapter } from "@/features/import/importWord";
import { addBookPage } from "@/features/templates/addBookPage";
import { BOOK_PAGE_STRUCTURES, type BookPageStructureId } from "@/features/templates/bookPages";
import { pickLocalFile } from "@/utils/filePicker";
import type { ReactNode } from "react";

export function TopBar() {
  const book = useWorkspaceStore((state) => state.book);
  const driveSync = useWorkspaceStore((state) => state.driveSync);
  const createChapter = useWorkspaceStore((state) => state.createChapter);
  const setView = useUiStore((state) => state.setView);
  const previewing = useUiStore((state) => state.previewing);
  const previewMode = useUiStore((state) => state.previewMode);
  const togglePreview = useUiStore((state) => state.togglePreview);
  const setPreviewMode = useUiStore((state) => state.setPreviewMode);
  const openProofread = useUiStore((state) => state.openProofread);
  const openBookSettings = useUiStore((state) => state.openBookSettings);

  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#1c314c] bg-[#0c1829] px-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white shadow">
          <BookOpen size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-bold tracking-wide">{tr.appName.toLocaleUpperCase("tr")}</div>
          <div className="truncate text-[11px] text-[#8aa0b8]">{book?.title || tr.subtitle}</div>
        </div>
        <FileMenu
          createChapter={createChapter}
          setView={setView}
          openBookSettings={openBookSettings}
        />
      </div>

      <div className="flex items-center gap-2">
        {driveSync?.enabled ? (
          <button
            type="button"
            className="hidden items-center gap-1.5 text-xs text-emerald-300 md:flex"
            onClick={() => setView("settings")}
            title={driveSync.folderPath || "Drive senkronu açık"}
          >
            <Cloud size={14} />
            Drive
          </button>
        ) : null}
        <Button size="sm" variant="secondary" onClick={openProofread} title="Yazım denetimi">
          <SpellCheck size={14} />
          <span className="hidden lg:inline">Denetim</span>
        </Button>
        <Button size="sm" variant={previewing ? "default" : "secondary"} onClick={togglePreview}>
          <Eye size={14} />
          Önizle
        </Button>
        {previewing ? (
          <>
            <PreviewModeButton active={previewMode === "book"} label="Kitap" onClick={() => setPreviewMode("book")}>
              <BookOpen size={14} />
            </PreviewModeButton>
            <PreviewModeButton
              active={previewMode === "tablet"}
              label="Tablet"
              onClick={() => setPreviewMode("tablet")}
            >
              <Tablet size={14} />
            </PreviewModeButton>
            <PreviewModeButton
              active={previewMode === "phone"}
              label="Telefon"
              onClick={() => setPreviewMode("phone")}
            >
              <Smartphone size={14} />
            </PreviewModeButton>
          </>
        ) : null}
        <Button size="sm" onClick={() => setView("export")}>
          <Download size={14} />
          Dışa Aktar
        </Button>
        <SaveStatusBadge />
        <Button size="icon" variant="ghost" onClick={openBookSettings} aria-label="Kitap ayarları" title="Kitap ayarları">
          <Settings size={16} />
        </Button>
      </div>
    </header>
  );
}

function FileMenu({
  createChapter,
  setView,
  openBookSettings,
}: {
  createChapter: ReturnType<typeof useWorkspaceStore.getState>["createChapter"];
  setView: (view: Parameters<ReturnType<typeof useUiStore.getState>["setView"]>[0]) => void;
  openBookSettings: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary" className="ml-2">
          Dosya
          <ChevronDown size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Dosya</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => {
            void (async () => {
              const chapter = await createChapter(null);
              if (chapter) {
                const blocks = await chapterService.setActive(chapter.id);
                useEditorStore.getState().setBlocks(blocks);
              }
            })();
          }}
        >
          <Plus size={14} className="mr-2" />
          Yeni bölüm
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setView("library")}>
          <Library size={14} className="mr-2" />
          Kitaplar
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void folderService
              .open("project")
              .then((path) => toast.success(`Proje klasörü: ${path}`))
              .catch((error: unknown) =>
                toast.error(error instanceof Error ? error.message : "Klasör açılamadı."),
              );
          }}
        >
          <FolderOpen size={14} className="mr-2" />
          Proje klasörü
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void importWordIntoChapter()}>
          <FileInput size={14} className="mr-2" />
          Word içe aktar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Sayfa yapıları</DropdownMenuLabel>
        {BOOK_PAGE_STRUCTURES.map((page) => (
          <DropdownMenuItem key={page.id} onSelect={() => void addBookPage(page.id as BookPageStructureId)}>
            {page.title}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            const version = window.prompt("Sürüm numarası", "1.1.0");
            if (!version?.trim()) return;
            const changelog = window.prompt("Değişiklik notu (isteğe bağlı)", "") ?? "";
            void useWorkspaceStore.getState().createVersion(version.trim(), changelog);
          }}
        >
          <History size={14} className="mr-2" />
          Sürüm oluştur
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void projectService
              .createBackup()
              .then((path) => toast.success(`Yedek oluşturuldu: ${path}`))
              .catch((error: unknown) =>
                toast.error(error instanceof Error ? error.message : "Yedek oluşturulamadı."),
              );
          }}
        >
          ZIP yedek oluştur
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void (async () => {
              const path = await pickLocalFile("zip");
              if (!path) return;
              if (!window.confirm("Seçilen yedek mevcut projenin üzerine yazılacak. Devam edilsin mi?")) return;
              try {
                await projectService.restoreBackup(path);
                const snapshot = await useWorkspaceStore.getState().load();
                if (snapshot) useEditorStore.getState().setBlocks(snapshot.selectedBlocks);
                toast.success("Yedek geri yüklendi.");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Yedek geri yüklenemedi.");
              }
            })();
          }}
        >
          ZIP yedekten geri yükle
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={openBookSettings}>
          <Settings size={14} className="mr-2" />
          Kitap ayarları
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setView("settings")}>
          <MoreHorizontal size={14} className="mr-2" />
          Uygulama ayarları
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PreviewModeButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button size="sm" variant={active ? "default" : "secondary"} title={label} onClick={onClick}>
      {children}
      <span className="hidden xl:inline">{label}</span>
    </Button>
  );
}
