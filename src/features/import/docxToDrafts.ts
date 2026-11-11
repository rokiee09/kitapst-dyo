import mammoth from "mammoth";
import { htmlToDraftBlocks, type DraftBlock } from "@/features/import/htmlToDraftBlocks";
import { readWordLayout } from "@/features/import/wordLayout";

export async function draftsFromDocx(bytes: Uint8Array): Promise<DraftBlock[]> {
  const imported = await importDocx(bytes);
  return imported.drafts;
}

export async function importDocx(bytes: Uint8Array): Promise<{ html: string; drafts: DraftBlock[] }> {
  const layout = await readWordLayout(bytes);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const result = await mammoth.convertToHtml(
    { arrayBuffer, buffer: bytes } as Parameters<typeof mammoth.convertToHtml>[0],
    {
      styleMap: layout.styleMap,
      transformDocument: layout.transformDocument,
      ignoreEmptyParagraphs: false,
      convertImage: mammoth.images.imgElement(async (image) => {
        const encoded = await image.read("base64");
        return { src: `data:${image.contentType};base64,${encoded}` };
      }),
    },
  );
  return { html: result.value, drafts: htmlToDraftBlocks(result.value) };
}
