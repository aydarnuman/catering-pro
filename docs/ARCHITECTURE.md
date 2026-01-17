# Catering Pro - Sistem Mimarisi

## Genel Bakis

Catering Pro, hazir yemek sektoru icin gelistirilmis kapsamli ERP-benzeri kurumsal is yonetim sistemidir. Ihale takibinden bordro hesaplamaya, stok yonetiminden menu planlamaya kadar tum operasyonel surecleri tek platformda yonetir.

**Hedef Kullanici:** ~10 aktif kullanici
**Son Guncelleme:** Ocak 2026

---

## Mimari Diyagram

```
CLOUDFLARE (DNS + CDN + SSL)
           |
           v
DIGITALOCEAN DROPLET (Ubuntu 22.04)
  |
  +-- NGINX (Reverse Proxy) - catering-tr.com
  |     |
  |     +-- :3000 (/) --> PM2: Frontend (Next.js 14)
  |     |
  |     +-- :3001 (/api) --> PM2: Backend (Express.js)
  |
  +-- External Services
        |
        +-- SUPABASE (PostgreSQL)
        +-- CLAUDE API (Anthropic)
        +-- GEMINI API (Google)
```

---

## Frontend Mimarisi

**Framework:** Next.js 14 (App Router)
**Port:** 3000

### Moduller
- Dashboard (/)
- Ihale Modulu (/tenders)
- Muhasebe Modulu (/muhasebe)
- Planlama Modulu (/planlama)
- AI Chat (/ai-chat)
- Admin Panel (/admin)
- Ayarlar (/ayarlar)

### UI Stack
- Mantine UI v7
- Tailwind CSS
- Tabler Icons
- Recharts

### Onemli Dosyalar
- `lib/config.ts` - API_BASE_URL (ONEMLI!)
- `context/AuthContext.tsx` - Auth provider
- `components/Navbar.tsx` - Navigation
- `components/FloatingAIChat.tsx` - AI asistan

---

## Backend Mimarisi

**Framework:** Express.js (Node.js)
**Port:** 3001

### Routes (39 dosya)
- Auth, Tenders, Documents, Cariler, Stok
- Personel, Bordro, Invoices, Kasa-Banka
- Planlama, AI, Notifications, Search, Export
- Teklifler, Tracking, ve digerleri

### Services (33+ dosya)
- claude-ai-service.js - Claude AI entegrasyonu
- gemini.js - Gemini AI/OCR
- document-analysis.js - Dokuman isleme
- bordro-service.js - Bordro hesaplama
- sync-scheduler.js - Otomatik sync
- tender-scheduler.js - Ihale scraper

### AI Tools Registry (10 dosya)
- cari-tools.js
- personel-tools.js
- satin-alma-tools.js
- web-tools.js
- piyasa-tools.js
- menu-tools.js

### Scraper
- Puppeteer ile ihalebul.com otomasyonu
- Session management
- Pagination support

---

## Moduller Detay

### 1. Ihale Takip Modulu
- Otomatik scraping (ihalebul.com)
- Dokuman yukleme ve AI analizi
- Ihale takip listesi (durum yonetimi)
- Teklif hazirlama sistemi
- Ihale sonuclari kayit

### 2. Muhasebe Modulu
- Cari Hesaplar (Musteri/Tedarikci)
- Fatura Yonetimi
- Stok/Depo Yonetimi
- Kasa-Banka
- Gelir-Gider
- Cek-Senet
- Demirbas

### 3. Insan Kaynaklari Modulu
- Personel Kayitlari
- Proje Atamalari
- Bordro Hesaplama (SGK, Vergi, AGI)
- Izin Yonetimi
- Maas Odemeleri
- Tazminat Hesaplama

### 4. Uretim Planlama Modulu
- Recete Yonetimi
- Menu Olusturma
- Gramaj Sartnameleri
- Malzeme Ihtiyac Hesaplama

### 5. AI Asistan Modulu
- Claude AI Chat (streaming)
- Tool calling (sistem entegrasyonu)
- Dokuman analizi (Gemini)
- Konusma hafizasi

### 6. Bildirim Modulu
- Real-time bildirimler
- Okundu/okunmadi takibi
- Ihale hatirlaticilari

---

## Veritabani

**Platform:** Supabase (PostgreSQL)
**Migrations:** 54 dosya

### Ana Tablolar
- tenders, documents, tender_tracking
- cariler, invoices, cari_hareketleri
- stok_kartlari, depolar, stok_hareketleri
- personeller, bordro, izin_talepleri
- receteler, menuler, sartnameler
- notifications, ai_memory, users

---

## Guvenlik

### Authentication
- JWT token based
- NextAuth.js (frontend)
- bcrypt password hashing

### Data Protection
- Parameterized SQL queries
- Input validation
- CORS configuration
- HTTPS (Cloudflare Flexible SSL)

---

## Deployment

### Production (DigitalOcean)
```
Server: Droplet (Ubuntu 22.04)
Domain: catering-tr.com
DNS/CDN: Cloudflare
SSL: Cloudflare Flexible
Process Manager: PM2
Reverse Proxy: Nginx
Database: Supabase
```

### PM2 Commands
```bash
pm2 start backend/src/server.js --name catering-backend
pm2 start npm --name catering-frontend -- start
pm2 status
pm2 logs
```

### Development
```bash
cd backend && npm run dev    # :3001
cd frontend && npm run dev   # :3000
```

---

## Logging

Winston logger ile gunluk log dosyalari:
- logs/app-YYYY-MM-DD.log
- logs/error-YYYY-MM-DD.log
- logs/exceptions-YYYY-MM-DD.log

---

## Gelecek Gelistirmeler

1. e-Fatura - GIB entegrasyonu
2. Uyumsoft Sync - Tam muhasebe entegrasyonu
3. Mobile App - React Native
4. Email Notifications - SMTP
5. Multi-tenant - Coklu firma destegi
