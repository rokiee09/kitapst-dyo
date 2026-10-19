import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { updateBookSchema } from "@/types/schemas";
import { assetService } from "@/services/assets";
import { pickLocalFile } from "@/utils/filePicker";

export function BookSettingsView() {
  const book = useWorkspaceStore((state) => state.book);
  const versions = useWorkspaceStore((state) => state.versions);
  const updateBook = useWorkspaceStore((state) => state.updateBook);
  const [title, setTitle] = useState(book?.title ?? "");
  const [subtitle, setSubtitle] = useState(book?.subtitle ?? "");
  const [author, setAuthor] = useState(book?.author ?? "");
  const [description, setDescription] = useState(book?.description ?? "");
  const [language, setLanguage] = useState(book?.language ?? "tr");
  const [isbn, setIsbn] = useState(book?.isbn ?? "");
  const [publisher, setPublisher] = useState(book?.publisher ?? "");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const coverId = book?.coverAssetId;
      if (!coverId) {
        await Promise.resolve();
        if (!cancelled) setCoverUrl(null);
        return;
      }
      try {
        const assets = await assetService.list("image");
        const cover = assets.find((item) => item.id === coverId);
        if (!cover) {
          if (!cancelled) setCoverUrl(null);
          return;
        }
        const url = await assetService.readDataUrl(cover.relativePath);
        if (!cancelled) setCoverUrl(url);
      } catch {
        if (!cancelled) setCoverUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [book?.coverAssetId]);

  if (!book) return null;

  return (
    <div className="h-full overflow-auto bg-[#0d1524] p-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-xl font-semibold">Kitap bilgileri</h1>
        <Field label="Kitap adı" value={title} onChange={setTitle} />
        <Field label="Alt başlık" value={subtitle} onChange={setSubtitle} />
        <Field label="Yazar" value={author} onChange={setAuthor} />
        <div>
          <Label>Açıklama</Label>
          <Textarea className="mt-1" value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>
        <Field label="Dil" value={language} onChange={setLanguage} />
        <Field label="ISBN" value={isbn} onChange={setIsbn} />
        <Field label="Yayınevi" value={publisher} onChange={setPublisher} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Sayfa rengi</Label>
            <input
              type="color"
              className="mt-1 h-8 w-full cursor-pointer rounded border border-[#1c2a44] bg-[#070b14]"
              value={book.pageColor || "#ffffff"}
              onChange={(event) => {
                void updateBook({
                  title,
                  subtitle,
                  author,
                  description,
                  language,
                  isbn,
                  publisher,
                  pageColor: event.target.value,
                  inkColor: book.inkColor,
                  fontFamily: book.fontFamily,
                }, { silent: true });
              }}
            />
          </div>
          <div>
            <Label>Yazı rengi</Label>
            <input
              type="color"
              className="mt-1 h-8 w-full cursor-pointer rounded border border-[#1c2a44] bg-[#070b14]"
              value={book.inkColor || "#152033"}
              onChange={(event) => {
                void updateBook({
                  title,
                  subtitle,
                  author,
                  description,
                  language,
                  isbn,
                  publisher,
                  pageColor: book.pageColor,
                  inkColor: event.target.value,
                  fontFamily: book.fontFamily,
                }, { silent: true });
              }}
            />
          </div>
        </div>
        <div className="rounded-md border border-[#1c2a44] p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-blue-600"
              checked={Boolean(book.pageNumbers)}
              onChange={(event) => {
                void updateBook(
                  {
                    title,
                    subtitle,
                    author,
                    description,
                    language,
                    isbn,
                    publisher,
                    pageColor: book.pageColor,
                    inkColor: book.inkColor,
                    fontFamily: book.fontFamily,
                    pageNumbers: event.target.checked,
                    pageNumberAlign: book.pageNumberAlign,
                    pageNumberStart: book.pageNumberStart,
                  },
                  { silent: true },
                );
              }}
            />
            Sayfa numarası göster
          </label>
          {book.pageNumbers ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label>Hizalama</Label>
                <select
                  className="mt-1 h-8 w-full rounded-md border border-[#1c2a44] bg-[#070b14] px-2 text-sm"
                  value={book.pageNumberAlign || "center"}
                  onChange={(event) => {
                    void updateBook(
                      {
                        title,
                        subtitle,
                        author,
                        description,
                        language,
                        isbn,
                        publisher,
                        pageColor: book.pageColor,
                        inkColor: book.inkColor,
                        fontFamily: book.fontFamily,
                        pageNumbers: true,
                        pageNumberAlign: event.target.value as "left" | "center" | "right",
                        pageNumberStart: book.pageNumberStart,
                      },
                      { silent: true },
                    );
                  }}
                >
                  <option value="left">Sol</option>
                  <option value="center">Ortada</option>
                  <option value="right">Sağ</option>
                </select>
              </div>
              <div>
                <Label>Başlangıç</Label>
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  max={9999}
                  value={book.pageNumberStart ?? 1}
                  onChange={(event) => {
                    void updateBook(
                      {
                        title,
                        subtitle,
                        author,
                        description,
                        language,
                        isbn,
                        publisher,
                        pageColor: book.pageColor,
                        inkColor: book.inkColor,
                        fontFamily: book.fontFamily,
                        pageNumbers: true,
                        pageNumberAlign: book.pageNumberAlign,
                        pageNumberStart: Number(event.target.value) || 1,
                      },
                      { silent: true },
                    );
                  }}
                />
              </div>
            </div>
          ) : null}
          <p className="mt-2 text-[11px] text-[#8aa0bd]">
            Numara sayfa altına yazılır. Bölüm sırasına göre artar; başlangıcı değiştirebilirsin.
          </p>
        </div>
        <div>
          <Label>Kapak</Label>
          {coverUrl ? <img src={coverUrl} alt="Kapak" className="mt-2 h-36 rounded object-cover" /> : null}
          <Button
            className="mt-2"
            variant="secondary"
            onClick={() => {
              void (async () => {
                try {
                  const path = await pickLocalFile("image");
                  if (!path) return;
                  const asset = await assetService.import(path, "image");
                  const parsed = updateBookSchema.safeParse({
                    title,
                    subtitle,
                    author,
                    description,
                    language,
                    isbn,
                    publisher,
                  });
                  if (!parsed.success) {
                    toast.error(parsed.error.issues[0]?.message ?? "Form doğrulanamadı.");
                    return;
                  }
                  await updateBook({ ...parsed.data, coverAssetId: asset.id });
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Kapak yüklenemedi.");
                }
              })();
            }}
          >
            Kapak görseli seç
          </Button>
        </div>
        <div>
          <Label>Sürüm</Label>
          <p className="mt-1 text-sm">{versions[0] ? `v${versions[0].version}` : "1.0.0"}</p>
        </div>
        <Button
          onClick={() => {
            const parsed = updateBookSchema.safeParse({
              title,
              subtitle,
              author,
              description,
              language,
              isbn,
              publisher,
            });
            if (!parsed.success) {
              toast.error(parsed.error.issues[0]?.message ?? "Form doğrulanamadı.");
              return;
            }
            void updateBook(parsed.data);
          }}
        >
          Kaydet
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input className="mt-1" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
