/** @vitest-environment jsdom */
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { importDocx } from "@/features/import/docxToDrafts";

describe("docx layout import", () => {
  it("Word hizası, punto ve girintisini bloklara taşır", async () => {
    const { html, drafts } = await importDocx(await sampleDocx());
    expect(html).toContain("text-align:center");
    expect(html).toContain("text-align:justify");
    expect(html).toContain("font-size:");
    expect(drafts.map((block) => block.type)).toContain("pageBreak");
    expect(drafts[0]?.type).toBe("heading");
    expect(drafts[0]?.style).toMatchObject({
      align: "center",
      fontFamily: '"Times New Roman",serif',
      fontSize: 21,
    });
    const body = drafts.find((block) => JSON.stringify(block).includes("Gövde"));
    expect(body?.type).toBe("paragraph");
    expect(body?.style).toMatchObject({
      align: "justify",
      fontFamily: "Calibri,sans-serif",
      fontSize: 15,
      marginLeft: 48,
      textIndent: 24,
      marginBottom: 11,
      lineHeight: 1.15,
    });
    expect(JSON.stringify(body)).toContain("bold");
    expect(drafts.some((block) => JSON.stringify(block).includes("\u00a0"))).toBe(true);
  });
});

async function sampleDocx(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  );
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="Calibri"/>
      <w:sz w:val="22"/>
    </w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr>
      <w:spacing w:after="160" w:line="276" w:lineRule="auto"/>
    </w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Başlık 1"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman"/>
      <w:sz w:val="32"/>
    </w:rPr>
  </w:style>
</w:styles>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r><w:t>Başlık</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:br w:type="page"/></w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Normal"/>
        <w:jc w:val="both"/>
        <w:ind w:left="720" w:firstLine="360"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:b/></w:rPr>
        <w:t>Gövde</w:t>
      </w:r>
    </w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
  </w:body>
</w:document>`,
  );
  return zip.generateAsync({ type: "uint8array" });
}
