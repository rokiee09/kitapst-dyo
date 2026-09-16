import { useEditorStore } from "@/stores/editorStore";
import {
  blockOrdinal,
  composeCaption,
  mediaLabel,
  type CaptionKind,
} from "@/features/blocks/captionLogic";
import type { QrTarget } from "@/types/domain";

export function MediaCaption({
  blockId,
  kind,
  note,
  custom,
  visible,
  editable,
  qrTarget,
  onChange,
}: {
  blockId: string;
  kind: CaptionKind;
  note: string;
  custom: boolean;
  visible: boolean;
  editable: boolean;
  qrTarget?: QrTarget;
  onChange: (next: { caption: string; captionCustom: boolean; captionVisible: boolean }) => void;
}) {
  const index = useEditorStore((state) => blockOrdinal(state.blocks, blockId, kind));
  const composed = composeCaption({
    kind,
    index,
    note,
    custom,
    visible,
    qrTarget,
  });
  const prefix = `${mediaLabel(kind)} ${index}:`;

  if (!editable) {
    if (!composed) return null;
    return <figcaption className="media-cap mt-1.5 text-center text-[11px] leading-snug text-[#6b6478]">{composed}</figcaption>;
  }

  if (!visible) {
    return (
      <div className="mt-1.5 text-center">
        <button
          type="button"
          className="text-[10px] text-[#8a8273] underline"
          onClick={() => onChange({ caption: note, captionCustom: false, captionVisible: true })}
        >
          Alt yazıyı göster
        </button>
      </div>
    );
  }

  return (
    <figcaption className="media-cap mt-1.5 space-y-1">
      {custom ? (
        <input
          className="w-full bg-transparent text-center text-[11px] leading-snug text-[#6b6478] outline-none"
          value={note}
          placeholder={`${prefix} not`}
          onChange={(event) =>
            onChange({ caption: event.target.value, captionCustom: true, captionVisible: true })
          }
          onPointerDown={(event) => event.stopPropagation()}
        />
      ) : (
        <div className="flex items-baseline justify-center gap-1">
          <span className="shrink-0 text-[11px] text-[#6b6478]">{prefix}</span>
          <input
            className="min-w-0 flex-1 bg-transparent text-[11px] leading-snug text-[#6b6478] outline-none"
            value={note}
            placeholder="kısa not (isteğe bağlı)"
            onChange={(event) =>
              onChange({ caption: event.target.value, captionCustom: false, captionVisible: true })
            }
            onPointerDown={(event) => event.stopPropagation()}
          />
        </div>
      )}
      <div className="flex justify-center gap-2 text-[10px]">
        {custom ? (
          <button
            type="button"
            className="text-[#8a8273] underline"
            onClick={() => onChange({ caption: "", captionCustom: false, captionVisible: true })}
          >
            Otomatik yazı
          </button>
        ) : (
          <button
            type="button"
            className="text-[#8a8273] underline"
            onClick={() =>
              onChange({
                caption: composed ?? `${mediaLabel(kind)} ${index}.`,
                captionCustom: true,
                captionVisible: true,
              })
            }
          >
            Tümünü düzenle
          </button>
        )}
        <button
          type="button"
          className="text-[#8a8273] underline"
          onClick={() => onChange({ caption: note, captionCustom: custom, captionVisible: false })}
        >
          Sil
        </button>
      </div>
    </figcaption>
  );
}
