import type { FitWarning } from "@/features/blocks/pageFit";

export function PageFitNotice({ warnings }: { warnings: FitWarning[] }) {
  if (warnings.length === 0) return null;
  const shown = warnings.slice(0, 6);
  const rest = warnings.length - shown.length;
  return (
    <div className="w-full rounded-md bg-amber-100 px-3 py-2 text-[11px] font-medium leading-relaxed text-amber-950">
      <p>Sayfa sınırında paragraf bölünmedi. Düzeni korunarak ya bu sayfada bırakıldı ya da sonraki sayfaya alındı.</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {shown.map((warning) => (
          <li key={`${warning.id}-${warning.action}`}>
            {warning.action === "next-page"
              ? `“${warning.label}” sığmadığı için sonraki sayfaya alındı.`
              : `“${warning.label}” bir sayfadan uzun olduğu için bölünmeden bu sayfada bırakıldı.`}
          </li>
        ))}
      </ul>
      {rest > 0 ? <p className="mt-1">ve {rest} blok daha</p> : null}
    </div>
  );
}
