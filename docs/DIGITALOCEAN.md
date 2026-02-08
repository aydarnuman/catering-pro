# 🌊 DigitalOcean Droplet Deployment Rehberi

Bu döküman Catering Pro'nun DigitalOcean Droplet üzerinde çalıştırılmasını açıklar.

---

## 📋 Mevcut Sunucu Bilgileri

| Özellik | Değer |
|---------|-------|
| **Domain** | https://catering-tr.com |
| **IP** | 46.101.172.210 |
| **OS** | Ubuntu 22.04 |
| **RAM** | 8GB |
| **Disk** | 160GB SSD |
| **Region** | Frankfurt (fra1) |
| **DNS/CDN** | Cloudflare |
| **SSL** | Cloudflare Flexible |

---

## 🔧 Sunucu Yapısı

```
/root/catering-pro/
├── backend/           # Node.js API
├── frontend/          # Next.js UI
├── uploads/           # Yüklenen dosyalar
└── scripts/           # Utility scriptler
```

### Servisler

| Servis | Port | Yönetim |
|--------|------|---------|
| Backend (Express) | 3001 | PM2 |
| Frontend (Next.js) | 3000 | PM2 |
| Nginx (Proxy) | 80 | systemctl |

---

## 🚀 Deploy İşlemi

### Hızlı Deploy (Önerilen)

Lokal makineden:

```bash
./scripts/deploy.sh              # Tam deploy
./scripts/deploy.sh frontend     # Sadece frontend
./scripts/deploy.sh backend      # Sadece backend
./scripts/deploy.sh quick        # Sadece git pull
```

### Manuel Deploy

```bash
# 1. SSH ile bağlan
ssh -i ~/.ssh/procheff_deploy root@46.101.172.210

# 2. Proje dizinine git
cd /root/catering-pro

# 3. Güncellemeleri çek
git pull origin main

# 4. Frontend build (değişiklik varsa)
cd frontend
rm -rf .next
npm run build

# 5. Servisleri yeniden başlat
pm2 restart all
```

---

## 🔑 SSH Erişimi

### SSH Key Kurulumu (İlk Kez)

```bash
# 1. Lokal makinede key oluştur
ssh-keygen -t ed25519 -f ~/.ssh/procheff_deploy

# 2. Public key'i sunucuya kopyala
ssh-copy-id -i ~/.ssh/procheff_deploy.pub root@46.101.172.210
```

### Bağlantı

```bash
ssh -i ~/.ssh/procheff_deploy root@46.101.172.210
```

---

## 🖥️ PM2 Yönetimi

```bash
# Durumu gör
pm2 list
pm2 status

# Logları gör
pm2 logs                        # Tüm loglar
pm2 logs catering-backend       # Sadece backend
pm2 logs catering-frontend      # Sadece frontend

# Yeniden başlat
pm2 restart all
pm2 restart catering-backend
pm2 restart catering-frontend

# Durdur
pm2 stop all

# Başlat
pm2 start all

# PM2 başlangıçta otomatik başlasın
pm2 startup
pm2 save
```

---

## 🌐 Nginx Yapılandırması

Dosya: `/etc/nginx/sites-available/catering`

```nginx
server {
    listen 80;
    server_name catering-tr.com www.catering-tr.com 46.101.172.210;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health endpoint
    location /health {
        proxy_pass http://localhost:3001;
    }
}
```

### Nginx Komutları

```bash
# Test et
nginx -t

# Yeniden yükle
systemctl reload nginx

# Yeniden başlat
systemctl restart nginx

# Durumu kontrol et
systemctl status nginx
```

---

## 🔒 Firewall (UFW)

```bash
# Durumu gör
ufw status

# Açık portlar
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS (SSL için)

# Aktif et
ufw enable
```

---

## 📊 Monitoring

### Health Check

```bash
# Lokal makineden
./scripts/health-check.sh

# Veya manuel (domain üzerinden)
curl https://catering-tr.com/health
curl https://catering-tr.com/api/auth/me

# Veya direkt IP (Cloudflare bypass)
curl http://46.101.172.210/health
```

### Sistem Kaynakları

```bash
# RAM
free -h

# Disk
df -h

# CPU/Process
htop
```

### Loglar

```bash
# PM2 logları
pm2 logs --lines 100

# Nginx logları
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Backend logları
tail -f /root/catering-pro/backend/logs/app-$(date +%Y-%m-%d).log
```

---

## 🔧 Sorun Giderme

### Backend Başlamıyor

```bash
# Log kontrol
pm2 logs catering-backend --lines 50

# .env kontrol
cat /root/catering-pro/backend/.env | head -5

# Manuel başlat
cd /root/catering-pro/backend
node src/server.js
```

### Frontend Build Hatası

```bash
# Cache temizle
cd /root/catering-pro/frontend
rm -rf .next node_modules/.cache
npm run build
```

### Nginx 502 Bad Gateway

```bash
# PM2 çalışıyor mu?
pm2 list

# Port dinleniyor mu?
netstat -tlnp | grep 3000
netstat -tlnp | grep 3001
```

### Database Bağlantı Hatası

```bash
# .env'de DATABASE_URL doğru mu?
grep DATABASE_URL /root/catering-pro/backend/.env

# Bağlantı testi
curl http://localhost:3001/health
```

---

## 🔄 Yedekleme

### Uploads Klasörü

```bash
# Sunucudan lokale
scp -i ~/.ssh/procheff_deploy -r root@46.101.172.210:/root/catering-pro/uploads ./backup/

# Lokadan sunucuya
scp -i ~/.ssh/procheff_deploy -r ./uploads root@46.101.172.210:/root/catering-pro/
```

### Database (Supabase)

- Supabase Dashboard → Settings → Backups
- Otomatik günlük yedekleme aktif (Supabase Pro)

---

## 🔐 SSL/TLS - Cloudflare Yapılandırması

Domain **catering-tr.com** için Cloudflare kullanılıyor.

### Cloudflare Ayarları

| Ayar | Değer | Açıklama |
|------|-------|----------|
| **SSL/TLS Mode** | Flexible | Cloudflare → Server HTTP, Client → Cloudflare HTTPS |
| **Always Use HTTPS** | ON | HTTP'yi HTTPS'e yönlendir |
| **Automatic HTTPS Rewrites** | ON | Mixed content'i otomatik düzelt |

### DNS Kayıtları (Cloudflare)

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | 46.101.172.210 | ✅ Proxied |
| A | www | 46.101.172.210 | ✅ Proxied |

### Neden Flexible Mode?

- Sunucuda SSL sertifikası kurulumu gerektirmez
- Cloudflare client ile HTTPS üzerinden iletişim kurar
- Cloudflare ile sunucu arasında HTTP kullanılır
- Basit ve yönetimi kolay

### Full (Strict) Mode'a Geçiş (İsteğe Bağlı)

Daha güvenli bir yapılandırma için:

```bash
# Certbot kur
apt install certbot python3-certbot-nginx

# SSL al
certbot --nginx -d catering-tr.com -d www.catering-tr.com

# Otomatik yenileme test
certbot renew --dry-run
```

Sonra Cloudflare'da SSL mode'u **Full (Strict)** yapın.

### Mixed Content Hatası Alırsanız

Frontend build sırasında doğru URL kullanıldığından emin olun:

```bash
# Sunucuda kontrol
cat /root/catering-pro/frontend/.env.production
# Çıktı: NEXT_PUBLIC_API_URL=https://catering-tr.com

# .env.local dosyası OLMAMALI!
ls -la /root/catering-pro/frontend/.env*

# Eğer .env.local varsa silin
rm -f /root/catering-pro/frontend/.env.local

# Yeniden build
rm -rf /root/catering-pro/frontend/.next
cd /root/catering-pro/frontend && npm run build
pm2 restart catering-frontend
```

---

## 📝 Güncel Tutma

```bash
# Sistem güncellemeleri
apt update && apt upgrade -y

# Node.js güncelleme
npm install -g n
n lts

# PM2 güncelleme
npm install -g pm2@latest
pm2 update
```

---

## 🕷️ Scraper (Chromium) Kurulumu

Scraper sistemi Puppeteer kullanarak ihalebul.com'dan veri çeker. Production'da Chromium kurulması gerekir.

### Chromium Kurulumu

```bash
# Snap ile Chromium kur (Önerilen)
apt install snapd -y
snap install chromium

# Veya APT ile
apt install chromium-browser -y
```

### Environment Variable

`.env` dosyasına ekle:

```bash
# Snap kurulumu için
PUPPETEER_EXECUTABLE_PATH=/snap/bin/chromium

# APT kurulumu için
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### Test

```bash
# Chromium çalışıyor mu?
/snap/bin/chromium --version

# Scraper test
cd /root/catering-pro/backend
node -e "import('./src/scraper/shared/browser.js').then(m => m.default.getBrowser().then(() => console.log('OK')))"
```

### Session Dosyası

Scraper login session'ı `backend/storage/session.json` dosyasında saklanır. Bu dosya sunucuda kalmalı, git'e push edilmemeli.

```bash
# Session kontrolü
ls -la /root/catering-pro/backend/storage/session.json
```

---

## 📞 Acil Durum

Sunucu yanıt vermiyorsa:

1. DigitalOcean Console'dan erişim dene
2. `pm2 resurrect` ile servisleri kurtarmayı dene
3. Droplet'ı Power Cycle yap (son çare)

```bash
# DigitalOcean CLI ile
doctl compute droplet-action power-cycle <droplet-id>
```
