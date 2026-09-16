import { describe, expect, it } from "vitest";
import { buildChapterTree, displayChapterLabel, pageSheetFamily } from "@/utils/chapterTree";
import type { Chapter } from "@/types/domain";

function chapter(partial: Partial<Chapter> & Pick<Chapter, "id" | "title">): Chapter {
  return {
    bookId: "book",
    parentId: null,
    number: null,
    order: 0,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("buildChapterTree", () => {
  it("iç içe bölümleri hiyerarşik sıraya koyar", () => {
    const chapters: Chapter[] = [
      chapter({ id: "4", title: "Hayatta Kalma", number: "4", order: 4 }),
      chapter({ id: "42", title: "Uygulama", number: "4.2", parentId: "4", order: 1 }),
      chapter({
        id: "426",
        title: "Nefes",
        number: "4.2.6",
        parentId: "42",
        order: 5,
      }),
      chapter({ id: "preface", title: "Önsöz", order: 0 }),
    ];

    const tree = buildChapterTree(chapters);
    expect(tree[0]?.title).toBe("Önsöz");
    expect(tree[1]?.children[0]?.children[0]?.title).toBe("Nefes");
  });
});

describe("displayChapterLabel", () => {
  it("Türkçe karakterleri korur", () => {
    expect(
      displayChapterLabel({
        number: "4.2.6",
        title: "Doğru Bir Teknikle Nefes Alıp Verin",
      }),
    ).toBe("4.2.6  Doğru Bir Teknikle Nefes Alıp Verin");
  });
});

describe("pageSheetFamily", () => {
  it("4.1 ve 4.2 devam sayfalarını üretir", () => {
    const chapters: Chapter[] = [
      chapter({ id: "4", title: "Hayatta Kalma", number: "4", order: 4 }),
      chapter({ id: "41", title: "Sayfa 4.1", number: "4.1", parentId: "4", order: 0 }),
      chapter({ id: "42", title: "Sayfa 4.2", number: "4.2", parentId: "4", order: 1 }),
    ];
    const family = pageSheetFamily(chapters, "41");
    expect(family?.sheets.map((item) => item.number)).toEqual(["4", "4.1", "4.2"]);
    expect(family?.nextLabel).toBe("4.3");
  });
});
