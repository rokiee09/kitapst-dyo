import JSZip from "jszip";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
/** document.xml içinde r:embed için */
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
/** .rels dosyalarının kök xmlns’i */
const PKG_R = "http://schemas.openxmlformats.org/package/2006/relationships";
const WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture";

export type SampleKind =
  | "baslikli"
  | "tablolu"
  | "gorselli"
  | "listeli"
  | "iki-sutunlu"
  | "uzun-sayfalar";

export async function buildSampleDocx(kind: SampleKind): Promise<Uint8Array> {
  switch (kind) {
    case "baslikli":
      return pack(stylesBasic(), bodyBaslikli(), themeCambriaCalibri());
    case "tablolu":
      return pack(stylesBasic(), bodyTablolu(), themeCambriaCalibri());
    case "gorselli":
      return pack(stylesBasic(), bodyGorselli(), themeCambriaCalibri(), { withImage: true });
    case "listeli":
      return pack(stylesBasic(), bodyListeli(), themeCambriaCalibri());
    case "iki-sutunlu":
      return pack(stylesBasic(), bodyIkiSutun(), themeCambriaCalibri(), { columns: 2 });
    case "uzun-sayfalar":
      return pack(stylesBasic(), bodyUzun(), themeCambriaCalibri());
  }
}

function pack(
  stylesXml: string,
  bodyInner: string,
  themeXml: string,
  options?: { withImage?: boolean; columns?: number },
): Promise<Uint8Array> {
  const withImage = options?.withImage ?? false;
  const columns = options?.columns ?? 1;
  const zip = new JSZip();
  const overrides = [
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>`,
    `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>`,
    `<Override PartName="/word/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>`,
  ];
  if (withImage) {
    overrides.push(
      `<Default Extension="png" ContentType="image/png"/>`,
    );
  }
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${overrides.join("\n  ")}
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="${PKG_R}">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  const rels = [
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>`,
  ];
  if (withImage) {
    rels.push(
      `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>`,
    );
    zip.file("word/media/image1.png", tinyPng());
  }
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="${PKG_R}">
  ${rels.join("\n  ")}
</Relationships>`,
  );
  zip.file("word/styles.xml", stylesXml);
  zip.file("word/theme/theme1.xml", themeXml);
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="${WP}" xmlns:a="${A}" xmlns:pic="${PIC}">
  <w:body>
    ${bodyInner}
    ${sectPr(columns)}
  </w:body>
</w:document>`,
  );
  return zip.generateAsync({ type: "uint8array" });
}

function sectPr(cols = 1): string {
  return `<w:sectPr>
  <w:pgSz w:w="11906" w:h="16838"/>
  <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
  ${cols > 1 ? `<w:cols w:num="${cols}" w:space="720"/>` : ""}
</w:sectPr>`;
}

function stylesBasic(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="${W}">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/>
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
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:asciiTheme="majorHAnsi"/>
      <w:b/>
      <w:sz w:val="32"/>
      <w:color w:val="1F4E79"/>
    </w:rPr>
    <w:pPr>
      <w:spacing w:before="240" w:after="120"/>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:asciiTheme="majorHAnsi"/>
      <w:b/>
      <w:sz w:val="26"/>
    </w:rPr>
  </w:style>
</w:styles>`;
}

function themeCambriaCalibri(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<a:theme xmlns:a="${A}" name="Office">
  <a:themeElements>
    <a:fontScheme name="Office">
      <a:majorFont><a:latin typeface="Cambria"/></a:majorFont>
      <a:minorFont><a:latin typeface="Calibri"/></a:minorFont>
    </a:fontScheme>
  </a:themeElements>
</a:theme>`;
}

function p(text: string, opts?: { style?: string; jc?: string; bold?: boolean; indent?: boolean }): string {
  const pPr = [
    opts?.style ? `<w:pStyle w:val="${opts.style}"/>` : "",
    opts?.jc ? `<w:jc w:val="${opts.jc}"/>` : "",
    opts?.indent ? `<w:ind w:left="720" w:firstLine="360"/>` : "",
  ]
    .filter(Boolean)
    .join("");
  const rPr = opts?.bold ? `<w:rPr><w:b/></w:rPr>` : "";
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}<w:r>${rPr}<w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function bodyBaslikli(): string {
  return [
    p("Örnek Başlık", { style: "Heading1", jc: "center" }),
    p("Alt başlık", { style: "Heading2" }),
    p("Bu paragraf iki yana yaslı, girintili ve kalın kelime içerir.", {
      jc: "both",
      indent: true,
      bold: true,
    }),
    `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`,
    p("İkinci sayfa metni."),
  ].join("\n");
}

function bodyTablolu(): string {
  return [
    p("Tablo örneği", { style: "Heading1" }),
    `<w:tbl>
      <w:tblPr>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:color="000000"/>
          <w:left w:val="single" w:sz="4" w:color="000000"/>
          <w:bottom w:val="single" w:sz="4" w:color="000000"/>
          <w:right w:val="single" w:sz="4" w:color="000000"/>
          <w:insideH w:val="single" w:sz="4" w:color="000000"/>
          <w:insideV w:val="single" w:sz="4" w:color="000000"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tblGrid>
        <w:gridCol w:w="2400"/>
        <w:gridCol w:w="3600"/>
        <w:gridCol w:w="2400"/>
      </w:tblGrid>
      <w:tr>
        <w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t>Birleşik</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>C</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:tcPr><w:vMerge w:val="restart"/></w:tcPr><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>C2</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:tcPr><w:vMerge/></w:tcPr><w:p><w:r><w:t></w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>B2</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>C3</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>`,
  ].join("\n");
}

function bodyGorselli(): string {
  // 200x120 px → EMU
  const cx = 200 * 9525;
  const cy = 120 * 9525;
  return [
    p("Görsel örnek", { style: "Heading1" }),
    `<w:p>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="${cx}" cy="${cy}"/>
            <wp:docPr id="1" name="Picture 1"/>
            <a:graphic>
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic xmlns:pic="${PIC}">
                  <pic:nvPicPr>
                    <pic:cNvPr id="0" name="image1.png"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="rId3"/>
                    <a:stretch><a:fillRect/></a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm>
                      <a:off x="0" y="0"/>
                      <a:ext cx="${cx}" cy="${cy}"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>`,
    p("Görselin altında açıklama."),
  ].join("\n");
}

function bodyListeli(): string {
  return [
    p("Liste örneği", { style: "Heading1" }),
    `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Birinci madde</w:t></w:r></w:p>`,
    `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>İkinci madde</w:t></w:r></w:p>`,
    p("Liste sonrası paragraf.", { jc: "both" }),
  ].join("\n");
}

function bodyIkiSutun(): string {
  return [
    p("İki sütunlu bölüm", { style: "Heading1", jc: "center" }),
    p("Sol sütun metni — kısa."),
    p("Sağ sütun metni — kısa."),
    p("Sütunlu alanda devam eden gövde metni."),
  ].join("\n");
}

function bodyUzun(): string {
  const paras = Array.from({ length: 80 }, (_, i) =>
    p(
      `Paragraf ${i + 1}. Bu metin otomatik sayfalama testidir. Word belgesi tek sayfaya sığmamalı, sayfalara bölünerek gelmelidir. Satır uzunluğu ve punto ile yükseklik tahmini yapılır.`,
      { jc: "both" },
    ),
  );
  return [p("Uzun belge", { style: "Heading1" }), ...paras].join("\n");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 1×1 PNG */
function tinyPng(): Uint8Array {
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
