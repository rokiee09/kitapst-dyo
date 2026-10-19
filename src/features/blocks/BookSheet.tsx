import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const BOOK_PAGE_WIDTH = 760;
export const BOOK_PAGE_HEIGHT = 920;

export function BookSheet({
  children,
  dark = false,
  clip = false,
  showGuide = true,
  className,
  style,
  footer,
  id,
  sheetRef,
}: {
  children: ReactNode;
  dark?: boolean;
  clip?: boolean;
  showGuide?: boolean;
  className?: string;
  style?: CSSProperties;
  footer?: ReactNode;
  id?: string;
  sheetRef?: (node: HTMLElement | null) => void;
}) {
  const pageRef = useRef<HTMLElement>(null);
  const [overflow, setOverflow] = useState(false);

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
  }, [children]);

  return (
    <div className="relative mx-auto" style={{ width: BOOK_PAGE_WIDTH }}>
      {overflow ? (
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
        style={{
          width: BOOK_PAGE_WIDTH,
          height: BOOK_PAGE_HEIGHT,
          boxSizing: "border-box",
          padding: "56px 64px 96px",
          ...style,
        }}
      >
        {children}
        {showGuide ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-10 border-t-2 border-dashed",
              overflow ? "border-amber-500" : dark ? "border-white/25" : "border-[#c5d0de]",
            )}
            style={{ bottom: 56 }}
            title="Sayfa sonu"
          />
        ) : null}
        {footer}
      </article>
    </div>
  );
}
