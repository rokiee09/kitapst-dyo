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

  it("hizalama ve görseli korur", () => {
    const blocks = htmlToDraftBlocks(
      '<p style="text-align:right">Sağ</p><p style="text-align:center"><img src="data:image/png;base64,aa" alt="foto" /></p>',
    );
    expect(blocks[0]?.style?.align).toBe("right");
    expect(blocks[1]?.type).toBe("image");
  });

  it("yazı tipi, girinti, aralık ve boş paragrafı korur", () => {
    const blocks = htmlToDraftBlocks(
      '<p style="text-align:justify;font-family:Georgia, serif;font-size:18pt;margin-left:36pt;text-indent:18pt;line-height:1.5;margin-bottom:0pt">Satır</p><p></p>',
    );
    expect(blocks[0]?.style).toMatchObject({
      align: "justify",
      fontFamily: "Georgia, serif",
      fontSize: 24,
      marginLeft: 48,
      textIndent: 24,
      lineHeight: 1.5,
      marginBottom: 0,
    });
    expect(JSON.stringify(blocks[0])).toContain("Georgia, serif");
    expect(blocks[1]?.type).toBe("paragraph");
    expect(JSON.stringify(blocks[1])).toContain("\u00a0");
  });

  it("iç içe listeyi düzleştirmez", () => {
    const blocks = htmlToDraftBlocks("<ul><li>Bir<ul><li>İki</li></ul></li></ul>");
    expect(blocks).toHaveLength(1);
    const json = JSON.stringify(blocks[0]);
    expect(json).toContain("Bir");
    expect(json).toContain("İki");
    expect(json).toContain('"type":"bulletList"');
    const nested = json.split('"type":"bulletList"').length - 1;
    expect(nested).toBe(2);
  });

  it("sayfa sonunu ayırır", () => {
    const blocks = htmlToDraftBlocks('<p>Önce</p><hr class="page" /><p>Sonra</p>');
    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "pageBreak", "paragraph"]);
  });
});

describe("plainTextToDraftBlocks", () => {
  it("boşluklu paragrafları ayırır", () => {
    const blocks = plainTextToDraftBlocks("Bir\n\nİki");
    expect(blocks).toHaveLength(2);
  });
});
