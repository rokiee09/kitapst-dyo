import { describe, expect, it } from "vitest";
import {
  CLASSIC_PAGE,
  MM_TO_PX,
  buildSheetCss,
  pagePixels,
  resolvePageSpec,
  roundPx,
} from "@/page/pageSpec";

describe("pageSpec", () => {
  it("klasik sayfa 760×920 px üretir", () => {
    const px = pagePixels(CLASSIC_PAGE);
    expect(Math.round(px.width)).toBe(760);
    expect(Math.round(px.height)).toBe(920);
  });

  it("1 mm ≈ 3.78 px (96 dpi)", () => {
    expect(MM_TO_PX).toBeCloseTo(3.7795, 3);
    expect(roundPx(1)).toBeCloseTo(3.78, 2);
  });

  it("A4 preset mm değerlerini korur", () => {
    const spec = resolvePageSpec({ pageSizePreset: "a4" });
    expect(spec.widthMm).toBe(210);
    expect(spec.heightMm).toBe(297);
  });

  it("PDF CSS @page boyutunu mm olarak yazar", () => {
    const css = buildSheetCss(CLASSIC_PAGE, "pdf");
    expect(css).toContain("@page{size:");
    expect(css).toContain("mm");
    expect(css).toContain("width:760px");
    expect(css).toContain("height:920px");
  });

  it("özel kenar boşluğu preset üzerine yazılır", () => {
    const spec = resolvePageSpec({
      pageSizePreset: "a5",
      marginTopMm: 12,
      marginLeftMm: 14,
    });
    expect(spec.margins.top).toBe(12);
    expect(spec.margins.left).toBe(14);
    expect(spec.margins.right).toBe(16);
  });
});
