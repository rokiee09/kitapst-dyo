export type PageFitAction = "next-page" | "kept";

export interface FitItem {
  id: string;
  height: number;
  kind: "break" | "block";
  label: string;
}

export interface FitWarning {
  id: string;
  action: PageFitAction;
  label: string;
}

export interface FitResult {
  pages: string[][];
  warnings: FitWarning[];
}

export function fitBlocksToPages(
  items: FitItem[],
  pageHeight: number,
  firstPageOffset = 0,
  previousPages?: string[][],
): FitResult {
  if (items.length === 0) return { pages: [[]], warnings: [] };
  const pending = items.some((item) => item.kind !== "break" && item.height <= 0);
  if (pageHeight <= 0 || pending) {
    return { pages: [items.map((item) => item.id)], warnings: [] };
  }

  const previousPage = new Map<string, number>();
  previousPages?.forEach((page, index) => page.forEach((id) => previousPage.set(id, index)));
  const pages: string[][] = [[]];
  const warnings: FitWarning[] = [];
  let used = Math.max(0, firstPageOffset);

  const startPage = () => {
    pages.push([]);
    used = 0;
  };

  for (const item of items) {
    if (item.kind === "break") {
      pages[pages.length - 1].push(item.id);
      startPage();
      continue;
    }
    const height = Math.max(item.height, 1);
    const page = pages[pages.length - 1];
    if (height > pageHeight) {
      if (page.length > 0) startPage();
      pages[pages.length - 1].push(item.id);
      warnings.push({ id: item.id, action: "kept", label: item.label });
      startPage();
      continue;
    }
    const reuniting = page.length > 0 && previousPage.get(item.id) !== previousPage.get(page[0]);
    const limit = reuniting ? pageHeight - 20 : pageHeight + 6;
    if (used + height > limit && (page.length > 0 || used > 0)) {
      warnings.push({ id: item.id, action: "next-page", label: item.label });
      startPage();
    }
    pages[pages.length - 1].push(item.id);
    used += height;
  }

  while (pages.length > 1 && pages[pages.length - 1].length === 0) pages.pop();
  return { pages, warnings };
}

export function blockKindLabel(type: string): string {
  const labels: Record<string, string> = {
    heading: "Başlık",
    paragraph: "Paragraf",
    quote: "Alıntı",
    orderedList: "Numaralı liste",
    unorderedList: "Madde listesi",
    infoBox: "Bilgi kutusu",
    warningBox: "Uyarı kutusu",
    image: "Görsel",
    video: "Video",
    qr: "QR",
    table: "Tablo",
    file: "Dosya",
    code: "Kod",
    divider: "Çizgi",
    pageBreak: "Sayfa sonu",
  };
  return labels[type] ?? "Blok";
}

export function textExcerpt(data: unknown, fallback: string): string {
  const raw = JSON.stringify(data ?? {});
  const match =
    raw.match(/"(?:text|title|caption|alt|description)":"((?:\\.|[^"\\]){2,})"/);
  const text = match ? match[1].replace(/\\n/g, " ").replace(/\\"/g, '"').replace(/\\u00a0/g, "").trim() : "";
  if (!text) return fallback;
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

export function sheetContentHeight(node: HTMLElement): number {
  const style = getComputedStyle(node);
  const top = Number.parseFloat(style.paddingTop) || 0;
  const bottom = Number.parseFloat(style.paddingBottom) || 0;
  return Math.max(120, node.clientHeight - top - bottom);
}

export function measureFlowHeights(root: ParentNode): Map<string, number> {
  const heights = new Map<string, number>();
  for (const stack of root.querySelectorAll<HTMLElement>("[data-flow-stack]")) {
    const children = [...stack.children].filter(
      (node): node is HTMLElement => node instanceof HTMLElement && Boolean(node.dataset.blockId),
    );
    children.forEach((element, index) => {
      const next = children[index + 1];
      const marginBottom = Number.parseFloat(getComputedStyle(element).marginBottom) || 0;
      const height = next ? Math.max(1, next.offsetTop - element.offsetTop) : element.offsetHeight + marginBottom;
      const id = element.dataset.blockId;
      if (id) heights.set(id, height);
    });
  }
  return heights;
}

export function measureHeader(root: ParentNode): number {
  const header = root.querySelector<HTMLElement>("[data-page-header]");
  if (!header) return 0;
  const style = getComputedStyle(header);
  return header.offsetHeight + (Number.parseFloat(style.marginTop) || 0) + (Number.parseFloat(style.marginBottom) || 0);
}
