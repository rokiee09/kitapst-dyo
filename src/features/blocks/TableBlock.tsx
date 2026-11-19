import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/stores/editorStore";
import type { ContentBlock } from "@/types/domain";

type CellValue = string | { text?: string; colspan?: number; rowspan?: number };

function cellText(cell: CellValue): string {
  return typeof cell === "string" ? cell : String(cell?.text ?? "");
}

function cellSpan(cell: CellValue): { colspan: number; rowspan: number } {
  if (typeof cell === "string") return { colspan: 1, rowspan: 1 };
  return {
    colspan: Math.max(1, cell.colspan ?? 1),
    rowspan: Math.max(0, cell.rowspan ?? 1),
  };
}

function readRows(data: unknown): CellValue[][] {
  if (!data || typeof data !== "object") return [["", ""], ["", ""]];
  const rows = (data as { rows?: unknown }).rows;
  if (!Array.isArray(rows) || rows.length === 0) return [["", ""], ["", ""]];
  return rows.map((row) => (Array.isArray(row) ? (row as CellValue[]) : [""]));
}

function readWidths(data: unknown): number[] | undefined {
  if (!data || typeof data !== "object") return;
  const widths = (data as { columnWidthsPct?: unknown }).columnWidthsPct;
  if (!Array.isArray(widths) || !widths.length) return;
  return widths.map((w) => Number(w) || 0);
}

export function TableBlock({ block, editable }: { block: ContentBlock; editable: boolean }) {
  const rows = readRows(block.data);
  const widths = readWidths(block.data);
  const borders =
    !block.data || typeof block.data !== "object" || (block.data as { borders?: boolean }).borders !== false;
  const caption =
    block.data && typeof block.data === "object" && typeof (block.data as { caption?: unknown }).caption === "string"
      ? (block.data as { caption: string }).caption
      : "";

  function patch(next: CellValue[][]) {
    useEditorStore.getState().updateBlockLocal(block.id, {
      data: {
        ...(typeof block.data === "object" && block.data ? block.data : {}),
        rows: next,
        caption,
        columnWidthsPct: widths,
        borders,
      },
    });
    useEditorStore.getState().scheduleSave(block.id);
  }

  return (
    <div className="overflow-x-auto">
      {caption ? <div className="mb-2 text-sm font-medium">{caption}</div> : null}
      <table className="w-full border-collapse text-sm" style={{ tableLayout: widths ? "fixed" : undefined }}>
        {widths ? (
          <colgroup>
            {widths.map((w, index) => (
              <col key={index} style={{ width: `${w}%` }} />
            ))}
          </colgroup>
        ) : null}
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => {
                const { colspan, rowspan } = cellSpan(cell);
                if (rowspan === 0) return null;
                return (
                  <td
                    key={cellIndex}
                    colSpan={colspan}
                    rowSpan={rowspan > 1 ? rowspan : undefined}
                    className={borders ? "border border-[#d6d0c4] p-1" : "p-1"}
                  >
                    {editable ? (
                      <input
                        className="w-full bg-transparent px-1 py-1 outline-none"
                        value={cellText(cell)}
                        onChange={(event) => {
                          const next = rows.map((item) => [...item]);
                          const current = next[rowIndex]?.[cellIndex];
                          if (typeof current === "object" && current) {
                            next[rowIndex][cellIndex] = { ...current, text: event.target.value };
                          } else {
                            next[rowIndex][cellIndex] = event.target.value;
                          }
                          patch(next);
                        }}
                      />
                    ) : (
                      cellText(cell)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {editable ? (
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            variant="paper"
            onClick={() => patch([...rows, Array.from({ length: rows[0]?.length || 2 }, () => "")])}
          >
            Satır ekle
          </Button>
          <Button size="sm" variant="paper" onClick={() => patch(rows.map((row) => [...row, ""]))}>
            Sütun ekle
          </Button>
        </div>
      ) : null}
    </div>
  );
}
