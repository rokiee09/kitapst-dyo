# Google Drive OAuth kurulumu (drive.file)

Kitap Stüdyosu, klasör yolu yapıştırmadan Google hesabıyla senkron için **Drive API + OAuth** kullanır.
İzin: yalnızca `https://www.googleapis.com/auth/drive.file`.

Uygulama Drive’da kendi **“Kitap Stüdyosu”** klasörünü oluşturur. Aynı Google hesabıyla iki PC’de giriş yaparsanız aynı klasörü görürsünüz. Elle oluşturduğunuz klasör linki bu izinle kullanılamaz.

## 1. Google Cloud projesi

1. [Google Cloud Console](https://console.cloud.google.com/) → proje oluştur.
2. **APIs & Services → Library** → **Google Drive API**’yi etkinleştir.
3. **OAuth consent screen**:
   - User type: External (kişisel Gmail için).
   - Uygulama adı: `Kitap Stüdyosu`
   - Destek e-postası: kendi adresin
   - Yetkili alanlar: isteğe bağlı
   - **Privacy policy URL**: `https://codeba.dev/...` altına `docs/privacy-policy.html` içeriğini koy
   - Scopes: `drive.file`, `userinfo.email` (veya `openid` + email)
4. **Credentials → Create credentials → OAuth client ID**
   - Application type: **Desktop app**
   - Client ID ve Client Secret’i kopyala

## 2. Testing vs Production

| Durum | Sonuç |
| --- | --- |
| **Testing** | Test kullanıcıları eklenmeli. Refresh token ~7 günde düşer; haftada bir yeniden giriş. |
| **In production** (yayın) | Normal kullanıcılar girebilir; uzun ömürlü refresh (politika sayfası + doğrulama gerekir). |

`drive.file` hassas olmayan (non-sensitive) bir izindir; yayınlama süreci geniş `drive` iznine göre daha hafiftir.

## 3. Uygulamaya Client ID / Secret

**Yöntem A — Ayarlar ekranı (önerilen):**  
Ayarlar → Google Drive → Client ID ve Secret yapıştır → Kaydet → **Google ile giriş**.

**Yöntem B — Dosya:**  
`src-tauri/google_oauth.example.json` dosyasını `src-tauri/google_oauth.json` olarak kopyala ve doldur (git’e ekleme; `.gitignore`’da).

**Yöntem C — Ortam değişkeni:**  
`KITAP_GOOGLE_CLIENT_ID` ve `KITAP_GOOGLE_CLIENT_SECRET`.

Desktop OAuth için redirect: `http://127.0.0.1:<rastgele-port>/oauth2callback` (uygulama otomatik açar). Cloud Console’da Desktop client seçildiyse ekstra redirect eklemen gerekmez.

## 4. İki PC

1. Her iki PC’de aynı Google hesabıyla giriş.
2. Canlı senkronu aç.
3. Aynı anda iki tarafta yazma; kilit dosyası uyarı verir, son yazan kazanır.

## 5. Gizlilik politikası

Repodaki `docs/privacy-policy.html` dosyasını codeba.dev üzerinde sabit bir URL’ye koy ve OAuth consent screen’e yapıştır.
