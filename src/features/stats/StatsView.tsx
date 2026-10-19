import { tr } from "@/i18n/tr";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function StatsView() {
  const stats = useWorkspaceStore((state) => state.stats);

  if (!stats) {
    return <div className="p-8 text-sm text-[#8aa0bd]">İstatistikler yüklenemedi.</div>;
  }

  const cards = [
    { label: tr.stats.chapters, value: stats.chapterCount },
    { label: tr.stats.words, value: stats.wordCount },
    { label: tr.stats.characters, value: stats.characterCount },
    { label: tr.stats.images, value: stats.imageCount },
    { label: tr.stats.videos, value: stats.videoCount },
    { label: tr.stats.qr, value: stats.qrCount },
    { label: tr.stats.files, value: stats.fileCount },
    { label: tr.stats.pages, value: stats.estimatedPages },
  ];

  return (
    <div className="h-full overflow-auto bg-[#0d1524] p-8">
      <h1 className="mb-6 text-xl font-semibold">İstatistik</h1>
      <div className="grid max-w-4xl grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-[#1c2a44] bg-[#070b14] p-4">
            <div className="text-xs text-[#8aa0bd]">{card.label}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{card.value.toLocaleString("tr-TR")}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 max-w-4xl text-xs text-[#8aa0bd]">{tr.stats.pagesHint}</p>
    </div>
  );
}
