# Deployment ve Geliştirme Rehberi

Bu döküman Catering Pro'nun lokal geliştirme ortamı kurulumu ve farklı ortamlara deployment sürecini açıklar.

**Son Güncelleme:** 29 Ocak 2026

---

## 🎯 Genel Bakış

**Mevcut Production:**
- **Domain:** https://catering-tr.com
- **Server:** DigitalOcean Droplet (46.101.172.210)
- **SSL:** Cloudflare (Flexible mode)
- **DNS:** Cloudflare
- **Database:** Supabase (external)

---

## 🖥️ Lokal Geliştirme Ortamı

### Gereksinimler

- Node.js v20+ (LTS onerilen)
- npm
- Git

> **NOT:** PostgreSQL kurmanıza gerek yok - Supabase cloud kullanılıyor.

### İlk Kurulum

```bash
# 1. Repo'yu klonla
git clone https://github.com/aydarnuman/catering-pro.git
cd CATERİNG

# 2. Backend kurulum
cd backend
cp ../.env.example .env
# .env dosyasını düzenle (aşağıdaki Environment Variables bölümüne bak)
npm install

# 3. Frontend kurulum (yeni terminal)
cd frontend
npm install
```

### Servisleri Başlatma

```bash
# Backend (Terminal 1)
cd backend
npm run dev          # Hot reload ile (önerilen)
# veya
npm start            # Manuel restart gerekir

# Frontend (Terminal 2)
cd frontend
npm run dev
```

### Portlar

| Servis | URL | Açıklama |
|--------|-----|----------|
| Frontend | http://localhost:3000 | Next.js UI |
| Backend | http://localhost:3001 | Express API |
| Database | Supabase cloud | PostgreSQL |

### Geliştirme Workflow'u

**Frontend (Next.js):**
- Dosyayı kaydet → Tarayıcı otomatik yenilenir (Hot Reload)
- http://localhost:3000 üzerinden test et

**Backend (Express):**
- `npm run dev` kullanıyorsan → Otomatik restart (Node.js --watch flag)
- `npm start` kullanıyorsan → Manuel restart gerekir (`Ctrl+C` → `npm start`)

### Production vs Development Karşılaştırması

| Özellik | Development | Production |
|---------|-------------|------------|
| **Frontend** | `npm run dev` | `npm run build` + `npm start` |
| **Backend** | `npm run dev` | PM2 ile çalışır |
| **Hot Reload** | ✅ Var | ❌ Yok |
| **Source Maps** | ✅ Var | ❌ Yok |
| **Minification** | ❌ Yok | ✅ Var |

---

## 🌐 API URL Yapılandırması

Frontend'de API URL'leri `config.ts` tarafından runtime'da otomatik belirlenir.

### Nasıl Çalışıyor?

| Ortam | hostname | API_BASE_URL |
|-------|----------|--------------|
| Local | `localhost` | `http://localhost:3001` |
| Production | `catering-tr.com` | `https://catering-tr.com` |

### Kullanım

```typescript
// ❌ YANLIŞ - Hardcoded URL kullanma
const API_URL = 'http://localhost:3001/api';
fetch('http://localhost:3001/api/cariler');

// ✅ DOĞRU - config.ts kullan
import { API_BASE_URL } from '@/lib/config';
fetch(`${API_BASE_URL}/api/cariler`);
```

> **NOT:** Frontend artık `NEXT_PUBLIC_API_URL` env variable'a ihtiyaç duymuyor.
> `config.ts` runtime'da hostname'e göre otomatik belirliyor.
> Aynı kod her ortamda çalışır!

---

## 🔧 Environment Variables

### Backend (.env)

```env
# Database (Supabase)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Supabase
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_SERVICE_KEY=eyJhbG...

# Authentication
JWT_SECRET=random-32-char-string
API_SECRET_KEY=random-secret

# AI Services
ANTHROPIC_API_KEY=sk-ant-api03-...
AZURE_DOCUMENT_AI_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_AI_KEY=your-azure-key

# Scraper (ihalebul.com)
IHALEBUL_USERNAME=xxx
IHALEBUL_PASSWORD=xxx

# Server
NODE_ENV=development
PORT=3001
LOG_LEVEL=info
```

### Frontend (.env.local) - Lokal Geliştirme

```env
# Realtime (opsiyonel)
NEXT_PUBLIC_ENABLE_REALTIME=true
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
```

### Frontend (.env.production) - Production

```env
NEXT_PUBLIC_ENABLE_REALTIME=true
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
```

> ⚠️ **ÖNEMLİ:** Production sunucusunda `.env.local` dosyası OLMAMALI!
> Next.js'de `.env.local` dosyası `.env.production`'dan önceliklidir.

---

## 🌊 DigitalOcean Deployment

> Detaylı sunucu yönetimi için: [DIGITALOCEAN.md](./DIGITALOCEAN.md)

### Hızlı Deploy (Önerilen)

```bash
# Lokal makineden tek komutla deploy
./scripts/deploy.sh              # Tam deploy
./scripts/deploy.sh frontend     # Sadece frontend
./scripts/deploy.sh backend      # Sadece backend
./scripts/deploy.sh quick        # Sadece git pull
```

### Manuel Deploy

```bash
# 1. SSH ile bağlan
ssh -i ~/.ssh/procheff_deploy root@46.101.172.210

# 2. Deploy
cd /root/catering-pro
git pull origin main
cd frontend && npm run build
pm2 restart all
```

### Sunucu Bilgileri

| Özellik | Değer |
|---------|-------|
| IP | 46.101.172.210 |
| OS | Ubuntu 22.04 |
| Process Manager | PM2 |
| Reverse Proxy | Nginx |
| Database | Supabase (external) |

---

## 🐘 Supabase Database

### Migration Yönetimi

Migration'lar artık **Supabase CLI** ile yönetiliyor.

```bash
# Migration durumunu gör
cd /path/to/project
supabase migration list

# Yeni migration oluştur
supabase migration new migration_name

# Migration'ları uygula
supabase db push

# Dry-run (değişiklik yapmadan önizle)
supabase db push --dry-run

# Şema farklarını tespit et
supabase db diff
```

### TypeScript Tipleri Oluşturma

```bash
supabase gen types typescript --local > frontend/src/types/database.ts
```

---

## 📱 Mobil Test (Aynı Ağdaki Telefon)

1. Mac IP'nizi öğrenin:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
# Örnek: 192.168.1.100
```

2. Frontend'te `.env.local` oluşturun:
```env
NEXT_PUBLIC_API_URL=http://192.168.1.100:3001
```

3. Telefondan erişin:
```
http://192.168.1.100:3000
```

---

## 📊 Monitoring

### Health Check

```bash
# Lokal
curl http://localhost:3001/health

# Production (script ile)
./scripts/health-check.sh

# Production (manuel)
curl https://catering-tr.com/health
```

### Loglar

```bash
# PM2 logları (production)
pm2 logs --lines 100
pm2 logs catering-backend
pm2 logs catering-frontend
```

---

## 🔒 Production Checklist

### Güvenlik
- [ ] Environment variables güvenli saklandı
- [ ] JWT secret güçlü ve unique
- [ ] CORS doğru yapılandırıldı
- [ ] Rate limiting aktif
- [ ] HTTPS zorunlu

### Performans
- [ ] Database indexes kontrol edildi
- [ ] Connection pooling aktif
- [ ] Static assets cached
- [ ] Gzip compression aktif

### Backup
- [ ] Database backup planı var (Supabase otomatik)
- [ ] Uploads backup planı var

### Monitoring
- [ ] Health check endpoint çalışıyor
- [ ] Error logging aktif
- [ ] Uptime monitoring kurulu

---

## 🐛 Sorun Giderme

### Frontend Backend'e Bağlanamıyor

```bash
# Backend çalışıyor mu?
curl http://localhost:3001/health

# Port kullanımda mı?
lsof -i :3001
```

### Database Bağlantı Hatası

```bash
# Connection string kontrol
grep DATABASE_URL backend/.env

# Bağlantı testi
psql $DATABASE_URL -c "SELECT 1"
```

### Build Hatası

```bash
# Cache temizle
rm -rf node_modules package-lock.json
npm install

# Frontend cache temizle
cd frontend
rm -rf .next node_modules/.cache
npm run build
```

### Port Çakışması

```bash
# Portları öldür
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

---

## IDE Ayarlari (VS Code / Cursor)

### Onerilen Extensions

- **Biome** - Linter & Formatter (ESLint/Prettier KULLANILMIYOR)
- **ES7+ React/Redux/React-Native snippets** - Hizli snippet'ler
- **GitLens** - Git entegrasyonu

---

## 📝 Önemli Notlar

- `.env` dosyaları **GIT'e eklenmez** (.gitignore'da)
- Sensitive bilgiler sadece lokal ve sunucuda olmalı
- **Production'a push etmeden önce lokal test et**
- Migration'lar için `npm run migrate` yerine `supabase db push` kullan

---

## 📞 Destek

Sorun yaşarsan:
1. Logları kontrol et (`pm2 logs` veya terminal çıktısı)
2. Environment variables doğrula
3. Database bağlantısını test et
4. Network/firewall ayarlarını kontrol et
