# Kitap Stüdyosu

Windows’ta çevrimdışı çalışan masaüstü kitap yazma ve yayınlama uygulaması.

## Başka bilgisayarda kullanmak

Kaynak kod kurmana gerek yok. Adımlar: [KURULUM.md](KURULUM.md)

Kısaca: `Uygulama/Kurulum.exe` dosyasını hedef Windows 10/11 makineye kopyala, çift tıkla. Kitaplar `Belgeler\KitapStudioProjects` altına yazılır.

## Geliştirme

Gereksinimler: Node.js 22+, Rust (stable, MSVC), Visual Studio Build Tools (C++).

Tarayıcıda arayüze bakmak (kitap bu sekmenin belleğinde durur, Windows kurulumunun yerine geçmez):

```bash
npm install
npm run dev
```

Masaüstü uygulaması:

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

## Yeni bölüm ve Drive senkronu

- Yeni üst düzey bölüm oluşturulunca altında **Önsöz**, **Giriş** ve **İçindekiler** sayfaları otomatik gelir; kitap kökündeki İçindekiler listesi de güncellenir.
- **Ayarlar → Çoklu çalışma (Drive klasörü)** ile Google Drive masaüstü klasörünü seç. Kaydettiğin içerik o klasöre yazılır; başka bilgisayarda aynı klasör seçilince uygulama açılışında güncel kitap alınır. Aynı anda iki kişi düzenlemesin.
