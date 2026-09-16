import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { tr } from "@/i18n/tr";
import { useEditorStore } from "@/stores/editorStore";

export function SaveStatusBadge() {
  const status = useEditorStore((state) => state.saveStatus);
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-blue-300">
        <LoaderCircle size={12} className="animate-spin" />
        {tr.save.saving}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-400">
        <TriangleAlert size={12} />
        {tr.save.error}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-emerald-300">
      <Check size={12} />
      {tr.save.saved}
    </span>
  );
}
