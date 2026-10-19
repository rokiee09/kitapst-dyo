import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { orderedChapterIds, proofreadPages } from "@/features/proofread/runProofread";
import type { ProofIssue } from "@/features/proofread/types";
import { useEditorStore } from "@/stores/editorStore";
import { useUiStore } from "@/stores/uiStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { hasProofreadAi, loadProofreadAiSettings, persistProofreadAiSettings } from "@/features/proofread/settings";
import { displayChapterLabel } from "@/utils/chapterTree";

const KIND_LABEL: Record<ProofIssue["kind"], string> = {
  spelling: "Yazım",
  grammar: "Dil",
  meaning: "Anlam",
  simple: "Basit",
};

type Scope = "book" | "pages";

export function ProofreadPanel() {
  const chapters = useWorkspaceStore((state) => state.chapters);
  const selectedChapterId = useWorkspaceStore((state) => state.selectedChapterId);
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<ProofIssue[] | null>(null);
  const [usedAi, setUsedAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("pages");
  const [picked, setPicked] = useState<string[]>(() => (selectedChapterId ? [selectedChapterId] : []));
  const [aiSettings, setAiSettings] = useState(loadProofreadAiSettings);
  const aiReady = hasProofreadAi(aiSettings);

  useEffect(() => {
    void persistProofreadAiSettings(loadProofreadAiSettings()).then(setAiSettings);
  }, []);

  const ordered = useMemo(() => {
    const ids = orderedChapterIds();
    return ids
      .map((id) => chapters.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [chapters]);

  function togglePage(id: string) {
    setPicked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
    setScope("pages");
  }

  async function run() {
    const ids = scope === "book" ? ordered.map((item) => item.id) : picked;
    if (ids.length === 0) {
      toast.error("Taranacak sayfa seçin.");
      return;
    }
    setLoading(true);
    try {
      const result = await proofreadPages(ids);
      setIssues(result.issues);
      setUsedAi(result.usedAi);
      setAiError(result.aiError);
      if (result.aiError) {
        toast.error(result.aiError);
      } else if (result.usedAi) {
        toast.success("Yapay zeka önerileri eklendi.");
      }
      if (result.issues.length === 0 && !result.aiError) {
        toast.success("Belirgin yazım veya basit hata bulunamadı.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Denetim yapılamadı.");
    } finally {
      setLoading(false);
    }
  }

  async function goToIssue(issue: ProofIssue) {
    useUiStore.getState().exitPreview();
    useUiStore.getState().setView("book");
    if (issue.chapterId && issue.chapterId !== useWorkspaceStore.getState().selectedChapterId) {
      const blocks = await useWorkspaceStore.getState().selectChapter(issue.chapterId);
      useEditorStore.getState().setBlocks(blocks);
    }
    window.setTimeout(() => {
      if (issue.blockId) {
        useEditorStore.getState().locateInBlock(issue.blockId, issue.excerpt);
      }
    }, 60);
  }

  return (
    <div className="space-y-3 p-3">
      <p className="text-xs font-semibold text-white">Yazım ve basit hata tarama</p>
      <p className="text-[11px] text-[#8aa0b8]">Tüm kitabı veya seçtiğiniz sayfaları tarar. Metin değişmez, yalnızca uyarı verir.</p>
      <p className={`text-[11px] ${aiReady ? "text-emerald-300" : "text-amber-300"}`}>
        {aiReady
          ? `Yapay zeka kayıtlı · model: ${aiSettings.model || "gpt-4o-mini"}`
          : "Yapay zeka kayıtlı değil. Ayarlar’da Kaydet’e basılmadan tarama yalnızca yerelde kalır."}
      </p>
      <div className="flex gap-1">
        <button
          type="button"
          className={`h-8 flex-1 rounded text-[11px] ${scope === "book" ? "bg-blue-600 text-white" : "bg-[#102038] text-[#9fb3c9]"}`}
          onClick={() => {
            setScope("book");
            setPicked(ordered.map((item) => item.id));
          }}
        >
          Tüm kitap
        </button>
        <button
          type="button"
          className={`h-8 flex-1 rounded text-[11px] ${scope === "pages" ? "bg-blue-600 text-white" : "bg-[#102038] text-[#9fb3c9]"}`}
          onClick={() => setScope("pages")}
        >
          Seçili sayfalar
        </button>
      </div>
      <div className="max-h-40 space-y-1 overflow-auto rounded border border-[#1c314c] p-1.5">
        {ordered.length === 0 ? (
          <p className="px-1 text-[11px] text-[#8aa0b8]">Sayfa yok.</p>
        ) : (
          ordered.map((chapter) => {
            const checked = scope === "book" || picked.includes(chapter.id);
            return (
              <label
                key={chapter.id}
                className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-[11px] text-[#d7e3f4] hover:bg-[#163056]"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 accent-blue-600"
                  checked={checked}
                  disabled={scope === "book"}
                  onChange={() => togglePage(chapter.id)}
                />
                <span className="min-w-0 flex-1 leading-4">{displayChapterLabel(chapter)}</span>
              </label>
            );
          })
        )}
      </div>
      <Button className="w-full" disabled={loading} onClick={() => void run()}>
        {loading ? "Taranıyor…" : scope === "book" ? "Tüm kitabı tara" : "Seçilen sayfaları tara"}
      </Button>
      {!loading && issues && issues.length === 0 ? (
        <p className="text-[11px] text-[#8aa0b8]">Belirgin uyarı yok.</p>
      ) : null}
      {!loading && issues && issues.length > 0 ? (
        <ul className="app-scroll max-h-64 space-y-2 overflow-auto">
          {issues.map((issue, index) => (
            <li key={`${issue.chapterId}-${issue.excerpt}-${index}`}>
              <button
                type="button"
                className="w-full rounded border border-[#1c314c] bg-[#102038] p-2 text-left hover:border-amber-400 hover:bg-[#163056]"
                onClick={() => void goToIssue(issue)}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                    {KIND_LABEL[issue.kind]}
                  </span>
                  {issue.pageTitle ? (
                    <span className="truncate text-[10px] text-blue-300">{issue.pageTitle}</span>
                  ) : null}
                </div>
                <p className="text-[11px] text-white">{issue.message}</p>
                {issue.suggestion ? (
                  <p className="mt-1 text-[11px] text-emerald-300">Öneri: {issue.suggestion}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-[#8aa0b8]">“{issue.excerpt}”</p>
                {issue.source === "ai" ? (
                  <p className="mt-1 text-[10px] text-violet-300">Yapay zeka</p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {aiError ? <p className="text-[11px] text-red-400">{aiError}</p> : null}
      <p className="text-[10px] text-[#6d7f94]">
        {usedAi
          ? "Yerel tarama ve yapay zeka önerileri birlikte listelendi."
          : "Yerel tarama. Yapay zeka için Ayarlar’da adres, anahtar ve model kaydedin."}
      </p>
    </div>
  );
}
