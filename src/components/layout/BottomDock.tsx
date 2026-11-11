import {
  BookOpen,
  FileArchive,
  FileCode2,
  FileText,
  Moon,
  Smartphone,
} from "lucide-react";
import { runBookExport } from "@/features/export/runExport";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/uiStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const EXPORTS = [
  { id: "epub", label: "EPUB", hint: "e-kitap", color: "bg-emerald-600 hover:bg-emerald-500", enabled: true },
  { id: "pdf", label: "PDF", hint: "Baskı / Paylaşım", color: "bg-rose-600 hover:bg-rose-500", enabled: true },
  { id: "html", label: "HTML", hint: "Web sürümü", color: "bg-sky-600 hover:bg-sky-500", enabled: true },
  { id: "mobile", label: "MOBİL", hint: "Telefon HTML", color: "bg-violet-600 hover:bg-violet-500", enabled: true },
  { id: "zip", label: "ZIP", hint: "Proje yedeği", color: "bg-cyan-600 hover:bg-cyan-500", enabled: true },
] as const;

export function BottomDock() {
  const paperDark = useUiStore((state) => state.paperDark);
  const togglePaperDark = useUiStore((state) => state.togglePaperDark);
  const stats = useWorkspaceStore((state) => state.stats);
  const versions = useWorkspaceStore((state) => state.versions);
  const latest = versions[0];
  const wordCount = stats?.wordCount ?? 0;

  return (
    <div
      id="studio-dock"
      className="grid h-[158px] shrink-0 grid-cols-[1.15fr_1.35fr_0.9fr_0.95fr] gap-3 border-t border-[#1c314c] bg-[#0a1628] px-3 py-2.5"
    >
      <section className="min-w-0">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#8aa0b8]">
          Dışa Aktar / Yayınla
        </h3>
        <div className="flex gap-2">
          {EXPORTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "flex h-[92px] w-[72px] flex-col items-center justify-center gap-1 rounded-lg text-white shadow-sm",
                item.color,
                !item.enabled && "opacity-90",
              )}
              onClick={() => void runBookExport(item.id)}
            >
              {item.id === "epub" ? <BookOpen size={18} /> : null}
              {item.id === "pdf" ? <FileText size={18} /> : null}
              {item.id === "html" ? <FileCode2 size={18} /> : null}
              {item.id === "mobile" ? <Smartphone size={18} /> : null}
              {item.id === "zip" ? <FileArchive size={18} /> : null}
              <span className="text-[11px] font-bold">{item.label}</span>
              <span className="px-1 text-center text-[9px] leading-3 text-white/80">{item.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="min-w-0">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#8aa0b8]">Görünüm</h3>
        <div className="flex items-start gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={togglePaperDark}
            className={cn(
              "flex w-[88px] flex-col items-center gap-1 rounded-lg border border-[#1c314c] bg-[#102038] p-2 text-[#9fb3c9] hover:bg-[#152844]",
              paperDark && "border-blue-500 bg-[#163056] text-white",
            )}
          >
            <div className="flex h-12 w-full items-center justify-center rounded bg-[#0b1524]">
              <Moon size={18} />
            </div>
            <span className="text-[10px]">Karanlık Mod</span>
          </button>
        </div>
      </section>

      <section className="min-w-0">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#8aa0b8]">Sürüm Bilgileri</h3>
        <div className="rounded-lg border border-[#1c314c] bg-[#102038] px-3 py-2">
          <div className="text-lg font-bold">v{latest?.version ?? "1.0.0"}</div>
          <div className="mt-0.5 text-[10px] text-[#8aa0b8]">
            {latest?.createdAt ? formatStamp(latest.createdAt) : "Henüz sürüm kaydı yok"}
          </div>
        </div>
      </section>

      <section className="min-w-0">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#8aa0b8]">Proje İstatistikleri</h3>
        <div className="flex items-center gap-3 rounded-lg border border-[#1c314c] bg-[#102038] px-3 py-2">
          <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[#9fb3c9]">
            <Stat label="Toplam Bölüm" value={stats?.chapterCount ?? 0} />
            <Stat label="Tahmini Sayfa" value={stats?.estimatedPages ?? 0} />
            <Stat label="Görsel" value={stats?.imageCount ?? 0} />
            <Stat label="Video" value={stats?.videoCount ?? 0} />
            <Stat label="QR Kod" value={stats?.qrCount ?? 0} />
            <Stat label="Dosya" value={stats?.fileCount ?? 0} />
          </div>
          <WordCountBadge value={wordCount} />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className="font-semibold tabular-nums text-white">{value.toLocaleString("tr-TR")}</span>
    </div>
  );
}

function WordCountBadge({ value }: { value: number }) {
  return (
    <div
      className="flex h-16 min-w-16 shrink-0 flex-col items-center justify-center rounded-full border border-blue-500/50 bg-[#07111f] px-2 text-center"
      title="Toplam kelime — üst sınır yok"
    >
      <span className="text-sm font-bold leading-none tabular-nums">{value.toLocaleString("tr-TR")}</span>
      <span className="mt-0.5 text-[8px] text-[#8aa0b8]">Kelime</span>
    </div>
  );
}

function formatStamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
