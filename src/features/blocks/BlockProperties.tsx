import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { readImageData, readQrData, readVideoData } from "@/features/blocks/blockData";
import { insertQrBlock } from "@/features/blocks/insertQr";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { isSafeExternalUrl } from "@/utils/security";
import type { ContentBlock, QrTarget } from "@/types/domain";

export function BlockProperties() {
  const block = useEditorStore((state) =>
    state.blocks.find((item) => item.id === state.selectedBlockId),
  );

  if (!block) {
    return <p className="p-3 text-xs text-[#8aa0bd]">Özellikleri görmek için bir blok seçin.</p>;
  }

  return (
    <div className="space-y-3 p-3">
      <Meta block={block} />
      {block.type === "heading" ? <HeadingFields block={block} /> : null}
      {typeof (block.data as { title?: unknown } | null)?.title === "string" &&
      block.type !== "image" &&
      block.type !== "video" &&
      block.type !== "qr" ? (
        <TextField
          id="generic-title"
          label="Başlık"
          value={String((block.data as { title: string }).title)}
          onChange={(title) => patchBlock(block, { ...(block.data as object), title })}
        />
      ) : null}
      {block.type === "image" ? <ImageFields block={block} /> : null}
      {block.type === "video" ? <VideoFields block={block} /> : null}
      {block.type === "qr" ? <QrFields block={block} /> : null}
      {block.type === "table" ? <TableFields block={block} /> : null}
      {block.type === "file" ? <FileFields block={block} /> : null}
      {block.type === "code" ? <CodeFields block={block} /> : null}
    </div>
  );
}

function Meta({ block }: { block: ContentBlock }) {
  return (
    <>
      <div>
        <Label>Tür</Label>
        <div className="mt-1 text-sm">{block.type}</div>
      </div>
      <div>
        <Label>Kimlik</Label>
        <div className="mt-1 break-all text-[11px] text-[#8aa0bd]">{block.id}</div>
      </div>
    </>
  );
}

function HeadingFields({ block }: { block: ContentBlock }) {
  const data = (block.data ?? {}) as Record<string, unknown>;
  return (
    <div>
      <Label htmlFor="heading-level">Başlık seviyesi</Label>
      <select
        id="heading-level"
        className="mt-1 h-8 w-full rounded-md border border-[#1c2a44] bg-[#070b14] px-2 text-sm"
        value={typeof data.level === "number" ? data.level : 2}
        onChange={(event) => patchBlock(block, { ...data, level: Number(event.target.value) })}
      >
        <option value={1}>H1</option>
        <option value={2}>H2</option>
        <option value={3}>H3</option>
      </select>
    </div>
  );
}

function ImageFields({ block }: { block: ContentBlock }) {
  const data = readImageData(block.data);
  return (
    <>
      <TextField id="img-alt" label="Alternatif metin" value={data.alt} onChange={(alt) => patchBlock(block, { ...data, alt })} />
      <TextField
        id="img-desc"
        label="Açıklama"
        value={data.description}
        onChange={(description) => patchBlock(block, { ...data, description })}
      />
      <TextField
        id="img-caption"
        label="Resim notu"
        value={data.caption}
        onChange={(caption) => patchBlock(block, { ...data, caption, captionCustom: false, captionVisible: true })}
      />
      <NumberField
        id="img-width"
        label="Genişlik (%)"
        value={data.width}
        min={8}
        max={100}
        onChange={(width) => patchBlock(block, { ...data, width })}
      />
      <input
        type="range"
        min={8}
        max={100}
        value={data.width}
        onChange={(event) => patchBlock(block, { ...data, width: Number(event.target.value) })}
        className="w-full accent-blue-600"
      />
      <SelectField
        id="img-align"
        label="Hizalama"
        value={data.align}
        options={[
          { value: "left", label: "Sol" },
          { value: "center", label: "Orta" },
          { value: "right", label: "Sağ" },
        ]}
        onChange={(align) => patchBlock(block, { ...data, align })}
      />
      <NumberField
        id="img-radius"
        label="Köşe yuvarlaklığı"
        value={data.borderRadius}
        min={0}
        max={48}
        onChange={(borderRadius) => patchBlock(block, { ...data, borderRadius })}
      />
      <button
        type="button"
        className="h-8 rounded-md border border-[#1c2a44] bg-[#102038] px-2 text-xs text-white"
        onClick={() =>
          void insertQrBlock({
            afterBlockId: block.id,
            target: "chapter",
            chapterId: useWorkspaceStore.getState().selectedChapterId,
            title: data.caption || data.alt || "Görsel",
            description: "Sayfa içi yönlendirme",
          })
        }
      >
        QR olarak ekle
      </button>
      <VisibilityFields
        epub={data.showInEpub}
        pdf={data.showInPdf}
        html={data.showInHtml}
        onChange={(next) => patchBlock(block, { ...data, ...next })}
      />
    </>
  );
}

function VideoFields({ block }: { block: ContentBlock }) {
  const data = readVideoData(block.data);
  const urlInvalid = data.url.trim() !== "" && !isSafeExternalUrl(data.url);
  return (
    <>
      <p className="text-[11px] text-[#8aa0bd]">
        Yerel dosya ve internet bağlantısı birlikte kullanılabilir. Telefona yönlendirmek için QR bloğu ekleyin.
      </p>
      <p className="text-[11px] text-[#8aa0bd]">
        {data.relativePath ? `Yerel: ${data.relativePath}` : "Yerel dosya seçilmedi."}
      </p>
      <TextField id="video-title" label="Başlık" value={data.title} onChange={(title) => patchBlock(block, { ...data, title })} />
      <TextField
        id="video-caption"
        label="Video notu"
        value={data.caption}
        onChange={(caption) => patchBlock(block, { ...data, caption, captionCustom: false, captionVisible: true })}
      />
      <AreaField
        id="video-desc"
        label="Açıklama"
        value={data.description}
        onChange={(description) => patchBlock(block, { ...data, description })}
      />
      <TextField
        id="video-url"
        label="İnternet URL"
        value={data.url}
        onChange={(url) =>
          patchBlock(block, { ...data, url, sourceType: data.relativePath ? "local" : "external" })
        }
      />
      {urlInvalid ? <p className="text-[11px] text-red-400">Yalnızca http/https adresleri kabul edilir.</p> : null}
      <TextField
        id="video-duration"
        label="Süre"
        value={data.duration}
        onChange={(duration) => patchBlock(block, { ...data, duration })}
      />
      <button
        type="button"
        className="h-8 rounded-md border border-[#1c2a44] bg-[#102038] px-2 text-xs text-white"
        onClick={() => {
          if (urlInvalid || !data.url.trim()) return;
          void insertQrBlock({
            afterBlockId: block.id,
            target: "video",
            value: data.url.trim(),
            title: data.title || "Video",
            description: "Videoya telefondan ulaş",
          });
        }}
      >
        QR olarak ekle
      </button>
      {urlInvalid || !data.url.trim() ? (
        <p className="text-[11px] text-amber-400">Video QR’si için geçerli bir http/https adresi gerekli.</p>
      ) : null}
      <CheckField
        id="video-pdf-preview"
        label="PDF görünümünü göster (küçük resim + başlık + QR)"
        checked={data.previewAsPdf}
        onChange={(previewAsPdf) => patchBlock(block, { ...data, previewAsPdf })}
      />
      <VisibilityFields
        epub={data.showInEpub}
        pdf={data.showInPdf}
        html={data.showInHtml}
        onChange={(next) => patchBlock(block, { ...data, ...next })}
      />
    </>
  );
}

function QrFields({ block }: { block: ContentBlock }) {
  const data = readQrData(block.data);
  const chapters = useWorkspaceStore((state) => state.chapters);
  const urlInvalid =
    (data.target === "video" || data.target === "url") &&
    data.value.trim() !== "" &&
    !isSafeExternalUrl(data.value);

  function setTarget(target: QrTarget) {
    patchBlock(block, {
      ...data,
      target,
      mode: target === "text" ? "text" : "url",
      chapterId: target === "chapter" ? data.chapterId : null,
    });
  }

  return (
    <>
      <p className="text-[11px] text-[#8aa0bd]">
        QR tek yönlendirme alanıdır: video bağlantısı veya kitap içi bölüm.
      </p>
      <SelectField
        id="qr-target"
        label="Yönlendirme"
        value={data.target}
        options={[
          { value: "video", label: "Video (https)" },
          { value: "chapter", label: "Sayfa içi bölüm" },
          { value: "url", label: "Harici URL" },
          { value: "text", label: "Düz metin" },
        ]}
        onChange={(value) => setTarget(value as QrTarget)}
      />
      {data.target === "chapter" ? (
        <SelectField
          id="qr-chapter"
          label="Bölüm"
          value={data.chapterId ?? ""}
          options={[
            { value: "", label: "Bölüm seçin" },
            ...chapters.map((chapter) => ({ value: chapter.id, label: chapter.title })),
          ]}
          onChange={(chapterId) =>
            patchBlock(block, {
              ...data,
              chapterId: chapterId || null,
              value: chapterId ? `#chapter-${chapterId}` : "",
            })
          }
        />
      ) : (
        <AreaField
          id="qr-value"
          label={data.target === "video" ? "Video URL" : data.target === "url" ? "URL" : "Metin"}
          value={data.value}
          onChange={(value) => patchBlock(block, { ...data, value })}
        />
      )}
      {urlInvalid ? <p className="text-[11px] text-red-400">Yalnızca http/https adresleri kabul edilir.</p> : null}
      <TextField
        id="qr-caption"
        label="QR alt yazısı / not"
        value={data.caption}
        onChange={(caption) => patchBlock(block, { ...data, caption, captionCustom: false, captionVisible: true })}
      />
      <TextField id="qr-title" label="Başlık" value={data.title} onChange={(title) => patchBlock(block, { ...data, title })} />
      <AreaField
        id="qr-desc"
        label="Açıklama"
        value={data.description}
        onChange={(description) => patchBlock(block, { ...data, description })}
      />
      <NumberField id="qr-size" label="Boyut" value={data.size} min={64} max={512} onChange={(size) => patchBlock(block, { ...data, size })} />
      <SelectField
        id="qr-ecc"
        label="Hata düzeltme"
        value={data.errorCorrection}
        options={[
          { value: "L", label: "L (düşük)" },
          { value: "M", label: "M (orta)" },
          { value: "Q", label: "Q" },
          { value: "H", label: "H (yüksek)" },
        ]}
        onChange={(errorCorrection) => patchBlock(block, { ...data, errorCorrection })}
      />
      <NumberField
        id="qr-margin"
        label="Dış boşluk"
        value={data.margin}
        min={0}
        max={16}
        onChange={(margin) => patchBlock(block, { ...data, margin })}
      />
    </>
  );
}

function TableFields({ block }: { block: ContentBlock }) {
  const data = (block.data ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(data.rows) ? (data.rows as unknown[][]) : [["", ""], ["", ""]];
  const caption = typeof data.caption === "string" ? data.caption : "";
  return (
    <>
      <TextField
        id="table-caption"
        label="Tablo başlığı"
        value={caption}
        onChange={(next) => patchBlock(block, { ...data, caption: next })}
      />
      <p className="text-[11px] text-[#8aa0bd]">
        {rows.length} satır · {Array.isArray(rows[0]) ? rows[0].length : 0} sütun
      </p>
    </>
  );
}

function FileFields({ block }: { block: ContentBlock }) {
  const data = (block.data ?? {}) as Record<string, unknown>;
  const filename = typeof data.filename === "string" ? data.filename : "";
  const relativePath = typeof data.relativePath === "string" ? data.relativePath : "";
  return (
    <>
      <TextField
        id="file-name"
        label="Dosya adı"
        value={filename}
        onChange={(next) => patchBlock(block, { ...data, filename: next })}
      />
      {relativePath ? <p className="break-all text-[11px] text-[#8aa0bd]">{relativePath}</p> : null}
    </>
  );
}

function CodeFields({ block }: { block: ContentBlock }) {
  const data = (block.data ?? {}) as Record<string, unknown>;
  const language = typeof data.language === "string" ? data.language : "text";
  return (
    <SelectField
      id="code-lang"
      label="Dil"
      value={language}
      options={[
        { value: "text", label: "Metin" },
        { value: "javascript", label: "JavaScript" },
        { value: "python", label: "Python" },
        { value: "rust", label: "Rust" },
        { value: "sql", label: "SQL" },
      ]}
      onChange={(next) => patchBlock(block, { ...data, language: next })}
    />
  );
}

function VisibilityFields({
  epub,
  pdf,
  html,
  onChange,
}: {
  epub: boolean;
  pdf: boolean;
  html: boolean;
  onChange: (next: { showInEpub: boolean; showInPdf: boolean; showInHtml: boolean }) => void;
}) {
  return (
    <div className="space-y-2 border-t border-[#1c2a44] pt-3">
      <CheckField id="vis-epub" label="EPUB’da göster" checked={epub} onChange={(showInEpub) => onChange({ showInEpub, showInPdf: pdf, showInHtml: html })} />
      <CheckField id="vis-pdf" label="PDF’de göster" checked={pdf} onChange={(showInPdf) => onChange({ showInEpub: epub, showInPdf, showInHtml: html })} />
      <CheckField id="vis-html" label="HTML’de göster" checked={html} onChange={(showInHtml) => onChange({ showInEpub: epub, showInPdf: pdf, showInHtml })} />
    </div>
  );
}

function patchBlock(block: ContentBlock, data: unknown) {
  useEditorStore.getState().updateBlockLocal(block.id, { data });
  useEditorStore.getState().scheduleSave(block.id);
}

function TextField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className="mt-1" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function AreaField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} className="mt-1 min-h-16" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        className="mt-1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="mt-1 h-8 w-full rounded-md border border-[#1c2a44] bg-[#070b14] px-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function CheckField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-blue-500"
      />
      {label}
    </label>
  );
}
