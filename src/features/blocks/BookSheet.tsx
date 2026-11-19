import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { pagePixels, resolvePageSpec, sheetInlineStyle, type PageBookFields } from "@/page/pageSpec";

/** @deprecated Ortak motor kullanın: resolvePageSpec / pagePixels */
export const BOOK_PAGE_WIDTH = 760;
/** @deprecated Ortak motor kullanın: resolvePageSpec / pagePixels */
export const BOOK_PAGE_HEIGHT = 920;

/** Klasik sayfa kenar boşlukları (px) — editör, önizleme ve PDF aynı kaynağı kullanır. */
export const BOOK_PAGE_PADDING = { top: 56, x: 64, bottom: 96 } as const;

export function BookSheet({
  children,
  book,
  dark = false,
  clip = false,
  showGuide = true,
  quietOverflow = false,
  className,
  style,
  footer,
  id,
  sheetRef,
}: {
  children: ReactNode;
  book?: PageBookFields | null;
  dark?: boolean;
  clip?: boolean;
  showGuide?: boolean;
  quietOverflow?: boolean;
  className?: string;
  style?: CSSProperties;
  footer?: ReactNode;
  id?: string;
  sheetRef?: (node: HTMLElement | null) => void;
}) {
  const pageRef = useRef<HTMLElement>(null);
  const [overflow, setOverflow] = useState(false);
  const spec = useMemo(() => resolvePageSpec(book), [
    book?.pageSizePreset,
    book?.pageWidthMm,
    book?.pageHeightMm,
    book?.marginTopMm,
    book?.marginRightMm,
    book?.marginBottomMm,
    book?.marginLeftMm,
  ]);
  const px = useMemo(() => pagePixels(spec), [spec]);

  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const measure = () => {
      const over = page.scrollHeight - page.clientHeight > 6;
      setOverflow(over);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(page);
    const mutations = new MutationObserver(measure);
    mutations.observe(page, { childList: true, subtree: true, characterData: true });
    page.addEventListener("input", measure);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      page.removeEventListener("input", measure);
    };
  }, [children, px.width, px.height]);

  return (
    <div className={cn("relative mx-auto")} style={{ width: px.width }}>
      {overflow && !quietOverflow ? (
        <div
          className={cn(
            "mb-2 rounded-md px-3 py-1.5 text-[11px] font-medium",
            dark ? "bg-amber-500/20 text-amber-200" : "bg-amber-100 text-amber-900",
          )}
        >
          Bu sayfa doldu. Çizginin altındaki yazı kitap sayfasına sığmaz; yeni sayfa ekleyin veya metni kısaltın.
        </div>
      ) : null}
      <article
        id={id}
        ref={(node) => {
          pageRef.current = node;
          sheetRef?.(node);
        }}
        className={cn(
          "book-page relative shadow-[0_18px_50px_rgba(0,0,0,0.35)]",
          dark ? "book-page-dark" : "bg-white",
          clip ? "overflow-hidden" : "overflow-visible",
          className,
        )}
        style={sheetInlineStyle(spec, style)}
        data-page-width-mm={spec.widthMm}
        data-page-height-mm={spec.heightMm}
      >
        {children}
        {showGuide ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 border-t-2 border-dashed",
              overflow ? "border-amber-500" : dark ? "border-white/25" : "border-[#c5d0de]",
            )}
            style={{
              left: px.paddingLeft,
              right: px.paddingRight,
              bottom: px.paddingBottom,
            }}
            title="Sayfa sonu"
          />
        ) : null}
        {footer}
      </article>
    </div>
  );
}
