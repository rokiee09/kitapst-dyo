import { describe, expect, it } from "vitest";
import { fitBlocksToPages, textExcerpt, type FitItem } from "@/features/blocks/pageFit";

function block(id: string, height: number, label = id): FitItem {
  return { id, height, kind: "block", label };
}

describe("fitBlocksToPages", () => {
  it("sığan paragrafları aynı sayfada bırakır", () => {
    const result = fitBlocksToPages([block("a", 100), block("b", 80)], 250);
    expect(result.pages).toEqual([["a", "b"]]);
    expect(result.warnings).toEqual([]);
  });

  it("sığmayan paragrafı bölmeden sonraki sayfaya alır", () => {
    const result = fitBlocksToPages([block("a", 180, "İlk"), block("b", 120, "İkinci")], 250);
    expect(result.pages).toEqual([["a"], ["b"]]);
    expect(result.warnings).toEqual([{ id: "b", action: "next-page", label: "İkinci" }]);
  });

  it("sayfadan uzun paragrafı böldürmeden bulunduğu sayfada bırakır", () => {
    const result = fitBlocksToPages([block("uzun", 400, "Uzun"), block("son", 40, "Son")], 250);
    expect(result.pages).toEqual([["uzun"], ["son"]]);
    expect(result.warnings).toEqual([{ id: "uzun", action: "kept", label: "Uzun" }]);
  });

  it("elle konmuş sayfa sonundan sonra yeni sayfa açar", () => {
    const result = fitBlocksToPages(
      [block("a", 40), { id: "break", height: 20, kind: "break", label: "Sayfa sonu" }, block("b", 40)],
      250,
    );
    expect(result.pages).toEqual([["a", "break"], ["b"]]);
    expect(result.warnings).toEqual([]);
  });

  it("sığmayan paragrafı ölçü titremesiyle geri almaz", () => {
    const result = fitBlocksToPages([block("a", 200), block("b", 40)], 250, 0, [["a"], ["b"]]);
    expect(result.pages).toEqual([["a"], ["b"]]);
  });

  it("yer açılınca paragrafı önceki sayfaya geri alır", () => {
    const result = fitBlocksToPages([block("a", 100), block("b", 40, "Kısa")], 250, 0, [["a"], ["b"]]);
    expect(result.pages).toEqual([["a", "b"]]);
    expect(result.warnings).toEqual([]);
  });

  it("yükseklik ölçülmeden bölmez", () => {
    const result = fitBlocksToPages([block("a", 0), block("b", 80)], 250);
    expect(result.pages).toEqual([["a", "b"]]);
    expect(result.warnings).toEqual([]);
  });
});

describe("textExcerpt", () => {
  it("paragrafın başını alır", () => {
    expect(textExcerpt({ content: { text: "Merhaba dünya" } }, "Paragraf")).toBe("Merhaba dünya");
    expect(textExcerpt({ title: "Kutu nefesi uygulaması" }, "Video")).toBe("Kutu nefesi uygulaması");
  });
});
