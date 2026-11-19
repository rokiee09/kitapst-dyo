/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { importDocx } from "@/features/import/docxToDrafts";
import { readDocxMeta } from "@/features/import/docxMeta";
import { paginateDrafts } from "@/features/import/paginateDrafts";
import { buildSampleDocx, type SampleKind } from "@/features/import/fixtures/buildSampleDocx";
import { CLASSIC_PAGE } from "@/page/pageSpec";

const SAMPLES: SampleKind[] = [
  "baslikli",
  "tablolu",
  "gorselli",
  "listeli",
  "iki-sutunlu",
  "uzun-sayfalar",
];

describe("örnek docx içe aktarma", () => {
  it.each(SAMPLES)("%s import edilir ve boş gelmez", async (kind) => {
    const bytes = await buildSampleDocx(kind);
    const { drafts, meta } = await importDocx(bytes);
    expect(drafts.length).toBeGreaterThan(0);
    expect(meta.page).not.toBeNull();
    expect(meta.theme.minor).toBe("Calibri");
    expect(meta.theme.major).toBe("Cambria");
  });

  it("başlıklı: stil zinciri + tema fontu + hiza", async () => {
    const { drafts, html } = await importDocx(await buildSampleDocx("baslikli"));
    expect(html).toContain("text-align:center");
    const heading = drafts.find((d) => d.type === "heading");
    expect(heading?.style?.align).toBe("center");
    expect(heading?.style?.fontFamily).toMatch(/Cambria/i);
    expect(JSON.stringify(heading)).toMatch(/bold|1F4E79|font-size/i);
    expect(drafts.some((d) => d.type === "pageBreak")).toBe(true);
  });

  it("tablolu: sütun genişliği ve birleşik hücre", async () => {
    const meta = await readDocxMeta(await buildSampleDocx("tablolu"));
    expect(meta.tables[0]?.columnWidthsPct.length).toBe(3);
    expect(meta.tables[0]?.rows[0]?.[0]?.colspan).toBe(2);
    expect(meta.tables[0]?.borders).toBe(true);
    const { drafts } = await importDocx(await buildSampleDocx("tablolu"));
    const table = drafts.find((d) => d.type === "table");
    expect(table).toBeTruthy();
    const data = table?.data as { columnWidthsPct?: number[]; rows?: unknown[][] };
    expect(data.columnWidthsPct?.length).toBe(3);
    expect(JSON.stringify(data.rows)).toContain("Birleşik");
  });

  it("görselli: EMU boyutu ve satır içi", async () => {
    const meta = await readDocxMeta(await buildSampleDocx("gorselli"));
    expect(meta.images[0]?.widthPx).toBe(200);
    expect(meta.images[0]?.heightPx).toBe(120);
    expect(meta.images[0]?.inline).toBe(true);
    const { drafts, html } = await importDocx(await buildSampleDocx("gorselli"));
    expect(html).toMatch(/<img/i);
    const image = drafts.find((d) => d.type === "image");
    expect(image).toBeTruthy();
    expect(html).toContain("data-ks-wrap");
    expect((image?.data as { widthPx?: number }).widthPx).toBe(200);
  });

  it("iki sütunlu: sayfa ayarı columns=2", async () => {
    const meta = await readDocxMeta(await buildSampleDocx("iki-sutunlu"));
    expect(meta.page?.columns).toBe(2);
    expect(meta.page?.widthMm).toBeGreaterThan(200);
  });

  it("uzun belge tek sayfaya sığmaz; paginate böler", async () => {
    const { drafts } = await importDocx(await buildSampleDocx("uzun-sayfalar"));
    const paged = paginateDrafts(drafts, {
      pageWidthMm: CLASSIC_PAGE.widthMm,
      pageHeightMm: CLASSIC_PAGE.heightMm,
      marginTopMm: CLASSIC_PAGE.margins.top,
      marginRightMm: CLASSIC_PAGE.margins.right,
      marginBottomMm: CLASSIC_PAGE.margins.bottom,
      marginLeftMm: CLASSIC_PAGE.margins.left,
    });
    const breaks = paged.filter((d) => d.type === "pageBreak").length;
    expect(breaks).toBeGreaterThanOrEqual(2);
    expect(paged.length).toBeGreaterThan(drafts.length);
  });
});
