# Kitap Stüdyosu

Yerel, çevrimdışı çalışan masaüstü kitap yazma ve yayınlama uygulaması.

## İlk milestone

Çalışan uygulama kabuğu, SQLite, bölüm sistemi ve temel blok editörü.

## Geliştirme

Gereksinimler:

- Node.js 22+
- Rust (stable, MSVC)
- Visual Studio Build Tools (C++ workload)

```bash
npm install
npm run tauri dev
```

## Kontroller

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Masaüstü paket:

```bash
npm run tauri build
```

## Notlar

- Geliştirme derlemesinde `TAKTİK EĞİTİM` demo kitabı otomatik oluşturulur.
- Production derlemesinde boş bir kitap açılır.
- HTML/EPUB/PDF dışa aktarma bu milestonda gerçek dosya üretmez.
- Görsel, video ve QR sistemleri sonraki milestona bırakıldı.
