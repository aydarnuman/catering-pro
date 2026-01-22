# 📱 WhatsApp Entegrasyonu

## 🎯 Genel Bakış

Catering Pro için WhatsApp Business entegrasyonu. Müşterilerle doğrudan iletişim, dosya paylaşımı ve mesajlaşma özellikleri sunar.

---

## 🏗️ Mimari

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│     Backend     │────▶│  WhatsApp Svc   │
│   (Next.js)     │     │   (Express)     │     │   (Baileys)     │
│   Port: 3000    │     │   Port: 3001    │     │   Port: 3002    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │   WhatsApp Web  │
                                               │    (QR Auth)    │
                                               └─────────────────┘
```

---

## 📦 Bağımlılıklar

### WhatsApp Servisi (`services/whatsapp/`)
```json
{
  "@whiskeysockets/baileys": "^6.x",  // WhatsApp Web API
  "express": "^4.x",                   // HTTP server
  "pg": "^8.x",                        // PostgreSQL client
  "qrcode": "^1.x",                    // QR kod oluşturma
  "pino": "^8.x"                       // Logging
}
```

### Frontend (`frontend/`)
```json
{
  "@cyntler/react-doc-viewer": "^1.x",  // PDF/Excel önizleme
  "mammoth": "^1.x",                     // DOCX → HTML dönüşümü
  "qrcode.react": "^3.x"                 // QR kod gösterimi
}
```

---

## 🗄️ Veritabanı Şeması

### Tablolar (Migration: `077_whatsapp_integration.sql`)

```sql
-- Sohbetler
whatsapp_chats (
  id, user_id, wa_id, name, is_group, 
  last_message, last_message_time, unread_count
)

-- Kişiler
whatsapp_contacts (
  id, user_id, wa_id, name, push_name, is_group
)

-- Mesajlar (chat başına son 500)
whatsapp_messages (
  id, user_id, chat_id, message_id, body, 
  from_me, timestamp, message_type
)

-- Medya dosyaları (manuel kayıt)
whatsapp_media (
  id, user_id, message_id, chat_id, 
  filename, mimetype, filesize, local_path, supabase_url
)
```

---

## 🚀 Kurulum

### 1. WhatsApp Servisi
```bash
cd services/whatsapp
npm install
npm start
```

### 2. İlk Bağlantı
1. Frontend'de WhatsApp sayfasına git: `/sosyal-medya/whatsapp`
2. QR kodu telefonunla tara (WhatsApp > Bağlı Cihazlar > Cihaz Bağla)
3. Bağlantı kurulduktan sonra sohbetler otomatik senkronize olur

### 3. Tüm Servisleri Başlatma
```bash
./start-all.sh
```

---

## 📁 Dosya Yapısı

```
services/whatsapp/
├── src/
│   └── index.js          # Ana servis dosyası
├── auth_info/            # Session verileri (gitignore'da)
├── cache/                # JSON cache dosyaları
│   ├── contacts.json
│   ├── chats.json
│   ├── messages.json
│   └── media/            # Kaydedilen medya dosyaları
└── package.json

frontend/src/
├── app/sosyal-medya/whatsapp/
│   └── page.tsx          # Tam sayfa WhatsApp arayüzü
└── components/WhatsAppWidget/
    ├── WhatsAppWidget.tsx    # Drawer widget
    └── WhatsAppNavButton.tsx # Navbar butonu
```

---

## 🔌 API Endpoints

### WhatsApp Servisi (Port 3002)

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/status` | Bağlantı durumu |
| GET | `/qr` | QR kod (base64) |
| GET | `/chats` | Sohbet listesi |
| GET | `/chats/:chatId/messages` | Mesajlar |
| POST | `/send` | Mesaj gönder |
| GET | `/media/:messageId` | Medya indir |
| POST | `/media/:messageId/save` | Medyayı sunucuya kaydet |
| GET | `/contacts` | Kişi listesi |
| POST | `/logout` | Çıkış yap |

### Backend Proxy (Port 3001)

Tüm istekler `/api/social/whatsapp/*` üzerinden proxy edilir.

---

## 📄 Dosya Önizleme Özellikleri

| Format | Kütüphane | Özellik |
|--------|-----------|---------|
| **PDF** | Native iframe | Tarayıcı desteği |
| **DOCX** | Mammoth.js | HTML'e dönüştürme |
| **XLSX** | DocViewer | Tablo görüntüleme |
| **Resimler** | Native img | Direkt görüntüleme |

### Önizleme Akışı
```
1. Kullanıcı dosyaya tıklar
2. Base64 data URL alınır (WhatsApp'tan)
3. Blob URL'e dönüştürülür (URL kısaltma)
4. Dosya tipine göre renderer seçilir
5. Modal'da gösterilir
```

---

## ⚠️ Önemli Notlar

### Medya Dosyaları
- WhatsApp medyayı sunucularında **sınırlı süre** tutar
- Eski mesajların medyası erişilemez olabilir
- Önemli dosyalar için **"Kaydet"** butonunu kullanın

### Session Yönetimi
- `auth_info/` klasörü session bilgilerini içerir
- Bu klasör **gitignore'da** olmalı
- Session silinirse QR kod ile yeniden bağlanılmalı

### Rate Limiting
- WhatsApp spam koruması var
- Çok hızlı mesaj gönderimi engellenebilir
- Toplu mesaj için dikkatli olun

---

## 🔒 Güvenlik

1. **Session Dosyaları**: `auth_info/` klasörü gitignore'da
2. **Medya Dosyaları**: `cache/media/` gitignore'da
3. **Veritabanı**: `user_id` ile izole edilmiş veriler
4. **API**: Backend proxy üzerinden erişim

---

## 🐛 Sorun Giderme

### "Medya Yüklenemedi" Hatası
- **Sebep**: Eski mesaj, WhatsApp sunucularından silinmiş
- **Çözüm**: Yeni mesajlar için medyayı hemen kaydedin

### QR Kod Görünmüyor
```bash
# WhatsApp servisini yeniden başlat
lsof -ti:3002 | xargs kill -9
cd services/whatsapp && npm start
```

### Sohbetler Yüklenmiyor
```bash
# Tüm servisleri yeniden başlat
./start-all.sh
```

### Session Bozuldu
```bash
# Session dosyalarını sil
rm -rf services/whatsapp/auth_info
# Servisi yeniden başlat ve QR tara
```

---

## 📊 Production Hazırlığı

### Checklist
- [ ] `auth_info/` gitignore'da
- [ ] `cache/` gitignore'da
- [ ] PM2 ile servis yönetimi
- [ ] Nginx reverse proxy
- [ ] SSL sertifikası
- [ ] Log rotation
- [ ] Backup stratejisi

### PM2 Yapılandırması
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'whatsapp-service',
      script: 'src/index.js',
      cwd: './services/whatsapp',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      }
    }
  ]
}
```

### Nginx Yapılandırması
```nginx
location /api/social/whatsapp/ {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
}
```

---

## 📈 Gelecek Özellikler

- [ ] Otomatik medya kaydetme (opsiyonel)
- [ ] Toplu mesaj gönderimi
- [ ] Mesaj şablonları
- [ ] Chatbot entegrasyonu
- [ ] Webhook bildirimleri
- [ ] WhatsApp Business API geçişi

---

## 📝 Değişiklik Geçmişi

| Tarih | Değişiklik |
|-------|------------|
| 2026-01-20 | İlk sürüm - Baileys entegrasyonu |
| 2026-01-20 | Mammoth.js ile DOCX önizleme |
| 2026-01-20 | DocViewer ile PDF/Excel önizleme |
| 2026-01-20 | Blob URL optimizasyonu |
| 2026-01-20 | PostgreSQL kalıcı depolama |

---

## 🤝 Katkıda Bulunma

1. Session dosyalarını commit etmeyin
2. Test için kendi WhatsApp hesabınızı kullanın
3. Rate limiting'e dikkat edin
