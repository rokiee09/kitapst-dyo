import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/stores/editorStore";
import type { ContentBlock } from "@/types/domain";

function readRows(data: unknown): string[][] {
  if (!data || typeof data !== "object") return [["", ""], ["", ""]];
  const rows = (data as { rows?: unknown }).rows;
  if (!Array.isArray(rows) || rows.length === 0) return [["", ""], ["", ""]];
  return rows.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [""]));
}

export function TableBlock({ block, editable }: { block: ContentBlock; editable: boolean }) {
  const rows = readRows(block.data);
  const caption =
    block.data && typeof block.data === "object" && typeof (block.data as { caption?: unknown }).caption === "string"
      ? (block.data as { caption: string }).caption
      : "";

  function patch(next: string[][]) {
    useEditorStore.getState().updateBlockLocal(block.id, { data: { rows: next, caption } });
    useEditorStore.getState().scheduleSave(block.id);
  }

  return (
    <div className="overflow-x-auto">
      {caption ? <div className="mb-2 text-sm font-medium">{caption}</div> : null}
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border border-[#d6d0c4] p-1">
                  {editable ? (
                    <input
                      className="w-full bg-transparent px-1 py-1 outline-none"
                      value={cell}
                      onChange={(event) => {
                        const next = rows.map((item) => [...item]);
                        next[rowIndex][cellIndex] = event.target.value;
                        patch(next);
                      }}
                    />
                  ) : (
                    cell
                  )}
                </td>
              ))}
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
          <Button
            size="sm"
            variant="paper"
            onClick={() => patch(rows.map((row) => [...row, ""]))}
          >
            Sütun ekle
          </Button>
        </div>
      ) : null}
    </div>
  );
}
