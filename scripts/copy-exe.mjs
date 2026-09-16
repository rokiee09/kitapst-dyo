import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "Uygulama");
mkdirSync(outDir, { recursive: true });

const searchRoots = [
  path.join(root, "src-tauri", "target", "release"),
  process.env.CARGO_TARGET_DIR ? path.join(process.env.CARGO_TARGET_DIR, "release") : "",
].filter(Boolean);

const tempRoot = process.env.TEMP || process.env.TMP;
if (tempRoot) {
  const cache = path.join(tempRoot, "cursor-sandbox-cache");
  if (existsSync(cache)) {
    for (const name of readdirSync(cache, { withFileTypes: true })) {
      if (!name.isDirectory()) continue;
      searchRoots.push(path.join(cache, name.name, "cargo-target", "release"));
    }
  }
}

function collectExes(dir, into) {
  if (!dir || !existsSync(dir)) return;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory() && (name.name === "bundle" || name.name === "nsis" || name.name === "msi")) {
      collectExes(full, into);
      continue;
    }
    if (name.isFile() && /\.(exe|msi)$/i.test(name.name)) {
      into.push(full);
    }
  }
}

const found = [];
for (const dir of [...new Set(searchRoots)]) {
  collectExes(dir, found);
}

if (found.length === 0) {
  throw new Error(
    `Exe bulunamadı. Denenen yerler:\n${searchRoots.join("\n")}\nCARGO_TARGET_DIR=${process.env.CARGO_TARGET_DIR ?? "(yok)"}`,
  );
}

const appExe =
  found.find((file) => /kitap_studiosu\.exe$/i.test(file) && !/bundle/i.test(file)) ??
  found.find((file) => /kitap_studiosu\.exe$/i.test(file)) ??
  found.find((file) => file.toLowerCase().endsWith(".exe") && !/setup/i.test(file)) ??
  found[0];

const destExe = path.join(outDir, "Kitap Stüdyosu.exe");
copyFileSync(appExe, destExe);

const installer = found.find((file) => /setup\.exe$/i.test(file));
if (installer) {
  copyFileSync(installer, path.join(outDir, "Kurulum.exe"));
}

writeFileSync(
  path.join(outDir, "OKU.txt"),
  `Kitap Stüdyosu — başka bilgisayarda kurulum
============================================
1) Bu klasörü USB veya indirme ile hedef Windows 10/11 PC'ye kopyala.
2) Kurulum.exe dosyasını çift tıkla (yönetici gerekmez).
3) Başlat menüsünden "Kitap Stüdyosu"nu aç.

Kurulum istemezsen: "Kitap Stüdyosu.exe" yeterli olabilir.
WebView2 yoksa Kurulum.exe onu da yükler.

Kitapların kaydı bu makinede:
  Belgeler\\KitapStudioProjects

Ayrıntı: proje kökündeki KURULUM.md
`,
  "utf8",
);

writeFileSync(
  path.join(root, "Kitap Stüdyosu.bat"),
  `@echo off
set EXE=%~dp0Uygulama\\Kitap Stüdyosu.exe
if exist "%EXE%" (
  start "" "%EXE%"
) else (
  echo Exe henuz olusturulmadi. Once npm run package:win calistirin.
  pause
)
`,
  "utf8",
);

console.log(`Kopyalandı: ${destExe}`);
console.log(`Kaynak: ${appExe}`);
if (installer) console.log(`Kurulum: ${installer}`);
else console.warn("NSIS Kurulum.exe bulunamadı; yalnız uygulama exe kopyalandı.");
