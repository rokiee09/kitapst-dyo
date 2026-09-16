# Kitap Stüdyosu

Windows’ta çevrimdışı çalışan masaüstü kitap yazma ve yayınlama uygulaması.

## Başka bilgisayarda kullanmak

Kaynak kod kurmana gerek yok. Adımlar: [KURULUM.md](KURULUM.md)

Kısaca: `Uygulama/Kurulum.exe` dosyasını hedef Windows 10/11 makineye kopyala, çift tıkla. Kitaplar `Belgeler\KitapStudioProjects` altına yazılır.

## Geliştirme

Gereksinimler: Node.js 22+, Rust (stable, MSVC), Visual Studio Build Tools (C++).

```bash
npm install
npm run tauri dev
```

Kurulum paketini yenilemek:

```bash
npm run package:win
```

## Kontroller

```bash
npm run typecheck
npm run lint
npm run test
```
