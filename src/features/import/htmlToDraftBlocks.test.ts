/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { htmlToDraftBlocks, plainTextToDraftBlocks } from "@/features/import/htmlToDraftBlocks";

describe("htmlToDraftBlocks", () => {
  it("başlık ve paragraf üretir", () => {
    const blocks = htmlToDraftBlocks("<h1>Merhaba</h1><p>Dünya <strong>kalın</strong></p>");
    expect(blocks[0]?.type).toBe("heading");
    expect(blocks[1]?.type).toBe("paragraph");
    expect(JSON.stringify(blocks)).toContain("Merhaba");
    expect(JSON.stringify(blocks)).toContain("kalın");
  });
});

describe("plainTextToDraftBlocks", () => {
  it("boşluklu paragrafları ayırır", () => {
    const blocks = plainTextToDraftBlocks("Bir\n\nİki");
    expect(blocks).toHaveLength(2);
  });
});
