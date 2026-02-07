# Catering Pro - Sistem Mimarisi

## Genel Bakis

Catering Pro, hazir yemek sektoru icin gelistirilmis kapsamli ERP-benzeri kurumsal is yonetim sistemidir. Ihale takibinden bordro hesaplamaya, stok yonetiminden menu planlamaya kadar tum operasyonel surecleri tek platformda yonetir.

**Hedef Kullanici:** ~10 aktif kullanici
**Son Guncelleme:** Subat 2026

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
  |     +-- :3000 (/) --> PM2: Frontend (Next.js 15)
  |     |
  |     +-- :3001 (/api) --> PM2: Backend (Express.js ES Modules)
  |
  +-- External Services
        |
        +-- SUPABASE (PostgreSQL)
        +-- CLAUDE API (Anthropic)
        +-- AZURE DOCUMENT AI
```

---

## Frontend Mimarisi

**Framework:** Next.js 15 (App Router)
**Port:** 3000

### Moduller
- Dashboard (/)
- Ihale Modulu (/tenders)
- Ihale Takip (/tracking)
- Muhasebe Modulu (/muhasebe)
- Planlama Modulu (/planlama)
- AI Chat (/ai-chat)
- Admin Panel (/admin)
- Ayarlar (/ayarlar)

### UI Stack
- Mantine UI v7.17
- Tabler Icons
- Recharts
- React Query (@tanstack/react-query)

### Onemli Dosyalar
- `lib/config.ts` - API_BASE_URL (ONEMLI!)
- `context/AuthContext.tsx` - Auth provider
- `components/Navbar.tsx` - Navigation
- `components/FloatingAIChat.tsx` - AI asistan

---

## Backend Mimarisi

**Framework:** Express.js (Node.js)
**Module System:** ES Modules (import/export)
**Port:** 3001

### Routes (46 dosya)
- Auth, Tenders, Documents, Cariler, Stok
- Personel, Bordro, Invoices, Kasa-Banka
- Planlama, AI, Notifications, Search, Export
- Teklifler, Tracking, Ihale Sonuclari, Scraper
- Firmalar, Mail, Permissions, Audit-logs

### Services (~36 dosya, ai-tools dahil)
- claude-ai.js - Claude AI entegrasyonu
- ai-analyzer/ - Unified document analysis pipeline (v9)
- bordro-template-service.js - Bordro hesaplama
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
- Dokuman analizi (Azure Document AI + Claude)
- Konusma hafizasi

### 6. Bildirim Modulu
- Real-time bildirimler
- Okundu/okunmadi takibi
- Ihale hatirlaticilari

---

## Veritabani

**Platform:** Supabase (PostgreSQL)
**Migrations:** 93+ dosya (Supabase CLI ile yonetiliyor)

### Ana Tablolar
- tenders, documents, tender_tracking
- cariler, invoices, cari_hareketleri
- urun_kartlari, depolar, urun_hareketleri
- personeller, bordro, izin_talepleri
- receteler, menuler, sartnameler
- notifications, ai_memory, users

---

## Guvenlik

### Authentication
- JWT token based
- Custom AuthContext (frontend)
- bcrypt password hashing
- localStorage token storage

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
2. Mobile App - React Native
3. Email Notifications - SMTP
