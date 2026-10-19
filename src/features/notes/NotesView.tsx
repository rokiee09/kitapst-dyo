import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { noteService } from "@/services";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Note } from "@/types/domain";

export function NotesView() {
  const chapters = useWorkspaceStore((state) => state.chapters);
  const selectedChapterId = useWorkspaceStore((state) => state.selectedChapterId);
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function refresh() {
    try {
      setNotes(await noteService.list());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Notlar yüklenemedi.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      try {
        const items = await noteService.list();
        if (!cancelled) setNotes(items);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Notlar yüklenemedi.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="h-full overflow-auto bg-[#0d1524] p-8">
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          <h1 className="text-xl font-semibold">Notlar</h1>
          <Input placeholder="Başlık" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Textarea rows={8} placeholder="Notunuz" value={body} onChange={(event) => setBody(event.target.value)} />
          <Button
            onClick={() => {
              void noteService
                .upsert({
                  id: editingId,
                  chapterId: selectedChapterId,
                  title,
                  body,
                })
                .then(() => {
                  setTitle("");
                  setBody("");
                  setEditingId(null);
                  return refresh();
                })
                .then(() => toast.success("Not kaydedildi."))
                .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Not kaydedilemedi."));
            }}
          >
            {editingId ? "Güncelle" : "Kaydet"}
          </Button>
        </div>
        <div className="space-y-2">
          {notes.map((note) => (
            <button
              key={note.id}
              type="button"
              className="w-full rounded-lg border border-[#1c314c] bg-[#102038] p-3 text-left"
              onClick={() => {
                setEditingId(note.id);
                setTitle(note.title);
                setBody(note.body);
              }}
            >
              <div className="font-medium">{note.title}</div>
              <div className="mt-1 line-clamp-2 text-xs text-[#8aa0b8]">{note.body}</div>
              <div className="mt-2 flex justify-between text-[10px] text-[#8aa0b8]">
                <span>
                  {chapters.find((chapter) => chapter.id === note.chapterId)?.title ?? "Genel"}
                </span>
                <span
                  role="link"
                  onClick={(event) => {
                    event.stopPropagation();
                    void noteService.remove(note.id).then(refresh);
                  }}
                >
                  Sil
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
