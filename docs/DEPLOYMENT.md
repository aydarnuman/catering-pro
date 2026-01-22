# Deployment Rehberi

## 🎯 Genel Bakış

Bu döküman Catering Pro'nun farklı ortamlara deployment sürecini açıklar.

**Mevcut Production:**
- **Domain:** https://catering-tr.com
- **Server:** DigitalOcean Droplet (46.101.172.210)
- **SSL:** Cloudflare (Flexible mode)
- **DNS:** Cloudflare

---

## 🖥️ Local Development

### Gereksinimler
- Node.js 20+
- Git

### Kurulum

```bash
# 1. Repo'yu klonla
git clone https://github.com/aydarnuman/catering-pro.git
cd CATERİNG

# 2. Backend kurulum
cd backend
cp ../.env.example .env
# .env dosyasını düzenle (Supabase credentials)
npm install
npm start

# 3. Frontend kurulum (yeni terminal)
cd frontend
npm install
npm run dev
```

### Portlar
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Database: Supabase (cloud)

---

## 🌊 DigitalOcean Deployment (Mevcut)

> Detaylı bilgi için: [DIGITALOCEAN.md](./DIGITALOCEAN.md)

### Hızlı Deploy

```bash
# Lokal makineden tek komutla deploy
./scripts/deploy.sh              # Tam deploy
./scripts/deploy.sh frontend     # Sadece frontend
./scripts/deploy.sh backend      # Sadece backend
```

### Manuel Deploy

```bash
# SSH ile bağlan
ssh -i ~/.ssh/procheff_deploy root@46.101.172.210

# Deploy
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

### 1. Proje Oluştur
- https://supabase.com'dan yeni proje

### 2. Connection String
```
Project Settings → Database → Connection string (URI)
```

### 3. Migrations Çalıştır
```bash
# Local'den Supabase'e
export DATABASE_URL="postgresql://postgres:xxx@xxx.supabase.co:5432/postgres"
npm run migrate
```

### 4. RLS Policies
Supabase Dashboard → Authentication → Policies

---

## 🔧 Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Authentication
JWT_SECRET=random-32-char-string
JWT_EXPIRES_IN=7d

# AI Services
GEMINI_API_KEY=AIza...
CLAUDE_API_KEY=sk-ant-...

# Scraper
IHALEBUL_USERNAME=xxx
IHALEBUL_PASSWORD=xxx

# Server
NODE_ENV=production
PORT=3001
```

### Frontend (.env.production) - Production için
```env
# API - Domain üzerinden (Cloudflare proxy)
NEXT_PUBLIC_API_URL=https://catering-tr.com
```

### Frontend (.env.local) - Local Development için
```env
# API - Localhost
NEXT_PUBLIC_API_URL=http://localhost:3001
```

> ⚠️ **ÖNEMLİ:** Production'da `.env.local` dosyası OLMAMALI!
> Next.js'de `.env.local` dosyası `.env.production`'dan önceliklidir.
> Sadece `.env.production` kullanın.

---

## 🔄 CI/CD Pipeline

### GitHub Actions (Örnek)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: railwayapp/railway-action@v0.3.0
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: backend

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: railwayapp/railway-action@v0.3.0
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: frontend
```

---

## 📊 Monitoring

### Logging
```javascript
// Backend'de winston kullanımı (önerilen)
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

### Health Check
```javascript
// Backend /health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
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
- [ ] Database backup planı var
- [ ] Uploads backup planı var

### Monitoring
- [ ] Health check endpoint çalışıyor
- [ ] Error logging aktif
- [ ] Uptime monitoring kurulu

---

## 🐛 Troubleshooting

### Database Bağlantı Hatası
```bash
# Connection string kontrol
echo $DATABASE_URL

# Bağlantı testi
psql $DATABASE_URL -c "SELECT 1"
```

### Build Hatası
```bash
# Cache temizle
rm -rf node_modules
rm package-lock.json
npm install
```

### Port Çakışması
```bash
# Kullanılan portları kontrol et
lsof -i :3000
lsof -i :3001
```

---

## 📞 Destek

Sorun yaşarsan:
1. Logs kontrol et
2. Environment variables doğrula
3. Database bağlantısını test et
4. Network/firewall ayarlarını kontrol et
