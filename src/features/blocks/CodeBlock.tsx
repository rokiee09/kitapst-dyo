import { useEditorStore } from "@/stores/editorStore";
import type { ContentBlock } from "@/types/domain";

function readCode(data: unknown) {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return {
    language: typeof record.language === "string" ? record.language : "text",
    code: typeof record.code === "string" ? record.code : "",
  };
}

export function CodeBlock({ block, editable }: { block: ContentBlock; editable: boolean }) {
  const data = readCode(block.data);

  function patch(next: Partial<{ language: string; code: string }>) {
    useEditorStore.getState().updateBlockLocal(block.id, { data: { ...data, ...next } });
    useEditorStore.getState().scheduleSave(block.id);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#1c314c] bg-[#0f172a]">
      <div className="flex items-center justify-between border-b border-[#1c314c] px-3 py-1.5">
        {editable ? (
          <select
            className="h-7 rounded bg-[#102038] px-2 text-xs text-white"
            value={data.language}
            onChange={(event) => patch({ language: event.target.value })}
          >
            <option value="text">Metin</option>
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="rust">Rust</option>
            <option value="sql">SQL</option>
          </select>
        ) : (
          <span className="text-xs text-[#8aa0b8]">{data.language}</span>
        )}
      </div>
      {editable ? (
        <textarea
          className="min-h-32 w-full resize-y bg-transparent p-3 font-mono text-sm text-[#e2e8f0] outline-none"
          value={data.code}
          onChange={(event) => patch({ code: event.target.value })}
          spellCheck={false}
        />
      ) : (
        <pre className="overflow-auto p-3 font-mono text-sm text-[#e2e8f0]">{data.code}</pre>
      )}
    </div>
  );
}
