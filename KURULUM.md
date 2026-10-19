# Kitap Stüdyosu — başka bilgisayarda kurulum

Kaynak kod veya Node/Rust **gerekmez**. Hedef makine: Windows 10 veya 11 (64 bit).

## Ne götürülür

USB, e-posta veya GitHub üzerinden yalnızca şu dosya yeter:

| Dosya | Ne işe yarar |
| --- | --- |
| `Uygulama/Kurulum.exe` | Önerilen yol. Programı kurar, Başlat menüsüne ekler, gerekirse WebView2’yi yükler. |
| `Uygulama/Kitap Stüdyosu.exe` | Kurulum istemezsen yedek: çift tıkla çalıştır. |

`.msi` artık üretilmez; tek kurulum paketi `Kurulum.exe` (NSIS).

## Hedef makinede adımlar

1. `Kurulum.exe` dosyasını kopyala (USB veya indirme).
2. Çift tıkla çalıştır. Yönetici şifresi **istenmez** (yalnızca bu kullanıcıya kurulur).
3. Bitince Başlat menüsünden **Kitap Stüdyosu** aç.
4. Windows Defender ilk açılışta uyarı verirse **Ek bilgi → Yine de çalıştır**.

WebView2 yoksa kurulum onu da ekler (Edge bileşeni; Windows 11’de genelde zaten vardır). İlk WebView2 kurulumu için kısa bir internet bağlantısı faydalıdır; bootstrapper paketin içindedir.

## Veri nerede durur (makineye özel)

Kurulum programı taşınmaz; **kitaplar o bilgisayarın diskine** yazılır.

- Kitap klasörleri: `Belgeler\KitapStudioProjects\`
- Son açık kitap kaydı: `%LOCALAPPDATA%\com.kitapstudiosu.desktop\app-state.json`

Başka bir PC’ye **çalışmayı** taşımak için `Belgeler\KitapStudioProjects` içindeki kitap klasörünü (içinde `project.sqlite` olan) kopyala. Kitaplık ekranından klasörü açabilir veya aynı yola koyup uygulamayı yeniden başlatabilirsin.

## Kaldırma

Windows → Uygulamalar → Kitap Stüdyosu → Kaldır. Kitap klasörleri Belgeler’de kalır; silinmez.

## Geliştirici (bu makinede paket yenilemek)

```bash
npm install
npm run package:win
```

Çıktı `Uygulama\Kurulum.exe` olur.
