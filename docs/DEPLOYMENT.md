# Deployment Rehberi

## 🎯 Genel Bakış

Bu döküman Catering Pro'nun farklı ortamlara deployment sürecini açıklar.

---

## 🖥️ Local Development

### Gereksinimler
- Node.js 18+
- Docker & Docker Compose
- Git

### Kurulum

```bash
# 1. Repo'yu klonla
git clone <repo-url>
cd CATERİNG

# 2. Environment dosyalarını oluştur
cp .env.example .env
# .env dosyasını düzenle

# 3. PostgreSQL başlat
docker-compose up -d

# 4. Backend kurulum
cd backend
npm install
npm run migrate
npm run dev

# 5. Frontend kurulum (yeni terminal)
cd frontend
npm install
npm run dev
```

### Portlar
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- PostgreSQL: localhost:5432

---

## ☁️ Railway Deployment

### 1. Railway Hesabı
- https://railway.app adresinden hesap oluştur
- GitHub ile bağla

### 2. Yeni Proje Oluştur
```
Railway Dashboard → New Project → Deploy from GitHub repo
```

### 3. Backend Service

```yaml
# railway.toml (backend klasöründe)
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 100
```

**Environment Variables:**
```
DATABASE_URL=postgresql://...
JWT_SECRET=xxx
GEMINI_API_KEY=xxx
CLAUDE_API_KEY=xxx
NODE_ENV=production
PORT=3001
```

### 4. Frontend Service

```yaml
# railway.toml (frontend klasöründe)
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm start"
```

**Environment Variables:**
```
NEXT_PUBLIC_API_URL=https://backend-xxx.railway.app
NEXTAUTH_URL=https://frontend-xxx.railway.app
NEXTAUTH_SECRET=xxx
```

### 5. Custom Domain (Opsiyonel)
```
Service Settings → Networking → Custom Domain
```

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

### Frontend (.env.local)
```env
# API
NEXT_PUBLIC_API_URL=http://localhost:3001

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=random-32-char-string

# Other
NODE_ENV=production
```

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
