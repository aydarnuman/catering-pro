# Session & Cookie Yönetimi

> **Versiyon:** 1.0.0
> **Son Güncelleme:** 2026-02-07
> **Durum:** ✅ Çalışıyor

---

## Genel Bakış

ihalebul.com'a her seferinde login olmak yerine, session cookie'leri dosyada saklanır ve yeniden kullanılır.

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  İlk Login      │────→│  Cookie Kaydet   │────→│ session.json   │
└─────────────────┘     └──────────────────┘     └────────────────┘
         │                                              │
         │              ┌──────────────────┐            │
         └─────────────→│  Sonraki İstek   │←───────────┘
                        │  (Cookie Yükle)  │
                        └──────────────────┘
```

---

## Dosya Yapısı

```
ihale-motoru/
├── src/scraper/shared/
│   ├── ihalebul-cookie.js   # Cookie saklama/yükleme
│   └── ihalebul-login.js    # Authentication mantığı
└── storage/
    └── session.json         # Saklanan session verisi
```

---

## Session Dosyası

**Konum:** `storage/session.json`

### Yapı

```json
{
  "id": "sess_1770021489309_hdpznx",
  "cookies": [
    {
      "name": "auth",
      "value": "CfDJ8MPhOoN2...",
      "domain": "ihalebul.com",
      "path": "/",
      "expires": 1771231084,
      "httpOnly": true,
      "secure": true
    },
    {
      "name": "csrf",
      "value": "CfDJ8MPhOoN2...",
      "domain": "ihalebul.com",
      "expires": -1,
      "session": true
    }
  ],
  "username": "aydarnuman",
  "createdAt": 1770021489309,
  "expiresAt": 1770050289309,
  "lastUsedAt": 1770022023010
}
```

### Alanlar

| Alan | Tip | Açıklama |
|------|-----|----------|
| `id` | string | Unique session ID |
| `cookies` | array | Puppeteer cookie formatı |
| `username` | string | Login yapan kullanıcı |
| `createdAt` | timestamp | Session oluşturma zamanı |
| `expiresAt` | timestamp | Session bitiş zamanı |
| `lastUsedAt` | timestamp | Son kullanım zamanı |

### Cookie'ler

ihalebul.com 2 ana cookie kullanır:

| Cookie | Açıklama | Süre |
|--------|----------|------|
| `auth` | Ana authentication token | 14 gün |
| `csrf` | CSRF koruma token | Session-based |

---

## Konfigürasyon

```env
# Session geçerlilik süresi (saat)
SESSION_TTL_HOURS=8
```

**Not:** `SESSION_TTL_HOURS` bizim kendi sınırımız. ihalebul.com'un `auth` cookie'si 14 gün geçerli ama biz 8 saatte yeniliyoruz (güvenlik için).

---

## Session Manager API

### `saveSession(cookies, username)`

Login başarılı olduktan sonra cookie'leri kaydet.

```javascript
const cookies = await page.cookies();
await sessionManager.saveSession(cookies, 'aydarnuman');
```

### `loadSession()`

Kayıtlı session'ı yükle. Süresi dolmuşsa `null` döner.

```javascript
const session = await sessionManager.loadSession();
if (session?.cookies) {
  await page.setCookie(...session.cookies);
}
```

### `clearSession()`

Session dosyasını sil (logout veya yeniden login için).

```javascript
sessionManager.clearSession();
```

### `applyCookies(page, cookies)`

Cookie'leri Puppeteer sayfasına uygula.

```javascript
await sessionManager.applyCookies(page, session.cookies);
```

### `isSessionValid()`

Session geçerli mi kontrol et.

```javascript
if (await sessionManager.isSessionValid()) {
  // Session kullanılabilir
}
```

---

## Login Service Akışı

```
┌─────────────────────────────────────────────────────────────────┐
│                      performLogin(page)                          │
├─────────────────────────────────────────────────────────────────┤
│  1. loadSession() → Kayıtlı session var mı?                     │
│     ├─ VAR → applyCookies() → isLoggedIn()?                     │
│     │        ├─ EVET → return true ✓                            │
│     │        └─ HAYIR → freshLogin()                            │
│     └─ YOK → freshLogin()                                       │
│                                                                  │
│  2. freshLogin()                                                 │
│     ├─ ihalebul.com ana sayfaya git                             │
│     ├─ Login formunu doldur                                      │
│     ├─ Submit                                                    │
│     ├─ isLoggedIn()?                                            │
│     │   ├─ EVET → saveSession() → return true ✓                 │
│     │   └─ HAYIR → throw Error                                  │
│     └─                                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Login Kontrolü

`isLoggedIn(page)` fonksiyonu şu kriterlere bakar:

### Başarısız (Login değil)
- Sayfada `***` maskelenmiş veri var
- "Bu bölüm sadece aktif üye" yazısı var

### Başarılı (Login)
- Sayfada "Çıkış" veya "logout" butonu var

---

## Hata Senaryoları

### 1. Session Süresi Dolmuş

```
⚠️ [Session] Session süresi dolmuş (45 dk önce), siliniyor
✅ [Login] ihalebul.com'a giriş yapılıyor... (aydarnuman)
✅ [Login] ✓ Giriş başarılı, session kaydedildi
```

**Çözüm:** Otomatik yeniden login.

### 2. Cookie Geçersiz (Site Tarafı)

```
✅ [Login] Kayıtlı session bulundu, deneniyor...
⚠️ [Login] Session geçersiz, yeniden giriş yapılacak
```

**Çözüm:** Session silinir, fresh login yapılır.

### 3. Credentials Yanlış

```
❌ [Login] Giriş başarısız - kullanıcı adı veya şifre hatalı
```

**Çözüm:** `.env` dosyasını kontrol et.

---

## Manuel İşlemler

### Session'ı Temizle

```bash
rm storage/session.json
```

### Session Durumunu Gör

```bash
cat storage/session.json | jq '{
  username: .username,
  created: (.createdAt / 1000 | todate),
  expires: (.expiresAt / 1000 | todate),
  cookies: (.cookies | length)
}'
```

### Zorla Yeniden Login

```javascript
// Kod içinde
await loginService.forceRelogin(page);
```

---

## Güvenlik Notları

1. **session.json'ı .gitignore'a ekle** - Cookie'ler hassas veri
2. **SESSION_TTL_HOURS'ı düşük tut** - 8 saat makul
3. **Credentials'ı .env'de sakla** - Asla koda yazma

### .gitignore

```gitignore
# Session dosyası
storage/session.json
storage/*.json

# Env dosyası
.env
.env.local
```

---

## Sorun Giderme

### "Session geçersiz" hatası sürekli alınıyor

1. Cookie'lerin domain'i doğru mu? (`ihalebul.com`)
2. ihalebul.com hesabı aktif mi?
3. Başka bir yerden login yapıldı mı? (session invalidate)

### Session dosyası oluşmuyor

1. `storage/` klasörü var mı?
2. Yazma izni var mı?
3. Disk dolu mu?

### Login başarılı ama hemen logout oluyor

1. CSRF cookie eksik olabilir
2. User-Agent değişmiş olabilir
3. IP değişmiş olabilir (nadiren)

---

## Örnek Log Çıktısı

### İlk Login (Session Yok)

```
08:45:12 ✅ [ListScraper] Tarama başlıyor (max 2 sayfa)
08:45:15 🔍 [Session] Kayıtlı session bulunamadı
08:45:15 ✅ [Login] ihalebul.com'a giriş yapılıyor... (aydarnuman)
08:45:22 ✅ [Login] ✓ Giriş başarılı, session kaydedildi
08:45:22 ✅ [Session] Session kaydedildi (2 cookie, 8 saat geçerli)
```

### Sonraki Çalıştırma (Session Var)

```
08:50:12 ✅ [ListScraper] Tarama başlıyor (max 2 sayfa)
08:50:12 🔍 [Session] Session yüklendi (7.2 saat kaldı)
08:50:12 ✅ [Login] Kayıtlı session bulundu, deneniyor...
08:50:15 ✅ [Login] Session geçerli, giriş başarılı
```

---

## İyileştirme Önerileri

1. **Encrypted Storage:** session.json'ı şifrele
2. **Multiple Sessions:** Farklı kullanıcılar için ayrı session
3. **Redis/Memory Store:** Dosya yerine memory cache
4. **Auto-Refresh:** Session bitmeden önce otomatik yenile
