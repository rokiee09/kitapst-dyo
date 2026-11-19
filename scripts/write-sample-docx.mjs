import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "ornekler", "docx");
mkdirSync(outDir, { recursive: true });

const mod = await import(pathToFileURL(path.join(root, "src/features/import/fixtures/buildSampleDocx.ts")).href);
const kinds = ["baslikli", "tablolu", "gorselli", "listeli", "iki-sutunlu", "uzun-sayfalar"];

for (const kind of kinds) {
  const bytes = await mod.buildSampleDocx(kind);
  const dest = path.join(outDir, `${kind}.docx`);
  writeFileSync(dest, bytes);
  console.log("yazıldı", dest);
}
