/** @vitest-environment jsdom */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";
import { buildSampleDocx, type SampleKind } from "@/features/import/fixtures/buildSampleDocx";

const KINDS: SampleKind[] = [
  "baslikli",
  "tablolu",
  "gorselli",
  "listeli",
  "iki-sutunlu",
  "uzun-sayfalar",
];

describe("örnek docx dosyaları", () => {
  it("ornekler/docx altına yazar", async () => {
    const outDir = path.resolve(process.cwd(), "ornekler", "docx");
    mkdirSync(outDir, { recursive: true });
    for (const kind of KINDS) {
      const bytes = await buildSampleDocx(kind);
      writeFileSync(path.join(outDir, `${kind}.docx`), bytes);
    }
  });
});
