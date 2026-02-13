# CLAUDE.md - Catering Pro

> Detayli kurallar: `.cursor/rules/` altindaki `.mdc` dosyalarinda.

## Proje Ozeti

Hazir yemek sektoru icin kurumsal is yonetim sistemi. ~10 aktif kullanici.
Domain: https://catering-tr.com | IP: 46.101.172.210

## Yapi

```
/frontend  - Next.js 15 App Router + Mantine v7 + TanStack Query
/backend   - Express.js (ES Modules) + Supabase PostgreSQL + Custom JWT Auth
/supabase  - Migration dosyalari
/scripts   - DevOps scriptleri (shell + JS orchestrator + audit)
/services  - Ayri mikroservisler (WhatsApp, Instagram)
/docs      - Proje dokumantasyonu (24 dosya)
```

## Teknoloji Kararlari (Degismez)

- **Auth**: Custom JWT + bcrypt + HttpOnly cookie (Supabase Auth KULLANILMIYOR)
- **DB**: Supabase PostgreSQL (sadece DB + Storage; Supabase Auth KULLANILMIYOR)
- **UI**: Mantine v7 + Tabler Icons (Tailwind KULLANILMIYOR)
- **State**: TanStack React Query (server) + React Context (client)
- **API**: REST, Axios (frontend), fetch degil
- **Module**: Backend ES Modules (`import/export`), Frontend TypeScript
- **Linter**: Biome ^2.3.10 (ESLint/Prettier KULLANILMIYOR)
- **Test**: Vitest ^4.0.18 (backend + frontend)
- **API URL**: Her zaman `import { API_BASE_URL } from '@/lib/config'` kullan, hardcoded URL YASAK
- **Node**: >=18.0.0 (`.nvmrc` -> 22)

## Hizli Referans

- **Frontend dev**: `cd frontend && npm run dev` (port 3000)
- **Backend dev**: `cd backend && npm run dev` (port 3001)
- **Frontend check**: `cd frontend && npm run check` (biome + tsc --noEmit)
- **Backend check**: `cd backend && npm run check` (biome check)
- **Deploy**: `./scripts/deploy.sh frontend` veya `./scripts/deploy.sh backend`
- **Tam deploy**: `./scripts/deploy.sh all`
- **SSH**: `ssh -i ~/.ssh/procheff_deploy root@46.101.172.210`
- **PM2 logs**: `ssh -i ~/.ssh/procheff_deploy root@46.101.172.210 "pm2 logs --lines 50"`
- **Health check**: `./scripts/health-check.sh`
- **Audit menu**: `npm run check` (interaktif audit menu)
- **Env dogrulama**: `npm run check:env`

## Kullanilabilir Scriptler

### Shell Scriptleri (`scripts/`)

| Script | Kullanim | Aciklama |
|--------|----------|----------|
| `deploy.sh` | `./scripts/deploy.sh [frontend\|backend\|quick\|all]` | Production deploy (SSH + git pull + build + PM2 restart) |
| `health-check.sh` | `./scripts/health-check.sh` | Sunucu saglik kontrolu (API, HTTP, PM2, disk, RAM) |
| `check.sh` | `./scripts/check.sh` | Hizli Biome lint + TypeScript kontrolu |
| `pre-build-check.sh` | Otomatik (prebuild hook) | Build oncesi TS + lint + git conflict kontrolu |
| `check-api-urls.sh` | `./scripts/check-api-urls.sh` | Hardcoded localhost URL tespiti |
| `full-backup.sh` | `./scripts/full-backup.sh` | Tam proje yedegi (git bundle + DB dump + config) |
| `start-all.sh` | `./scripts/start-all.sh [--dev\|--prod\|--docker]` | Tum servisleri baslatma wrapper |
| `service.sh` | `./scripts/service.sh [start\|stop\|status\|health\|logs]` | Servis yonetimi (start/stop/restart/status) |

### npm Scriptleri (Root `package.json`)

| Komut | Aciklama |
|-------|----------|
| `npm run dev` | Frontend + Backend paralel dev modu |
| `npm run check` | Interaktif audit menu (scripts/audit/menu.js) |
| `npm run check:env` | Env degisken dogrulama |
| `npm run check:health` | Servis saglik kontrolu |
| `npm run start:all` | Orchestrator ile tum servisleri baslat |
| `npm run audit` | Kod kalitesi + guvenlik audit |
| `npm run audit:security` | Sadece guvenlik kontrolleri |
| `npm run audit:fix` | Otomatik duzeltme |
| `npm run test` | Backend + Frontend testleri (Vitest) |
| `npm run lint` | Backend + Frontend lint |

### JS Orchestrator (`scripts/services/`)

| Modul | Aciklama |
|-------|----------|
| `orchestrator.js` | Ana servis koordinatoru (baslangic sirasi, pre-flight, health) |
| `health-checker.js` | Port + HTTP endpoint saglik kontrolu |
| `env-validator.js` | Zorunlu env degiskeni dogrulama |
| `config.js` | Merkezi servis yapilandirmasi (portlar, bagimliliklar) |
| `pm2-manager.js` | PM2 process yonetimi |
| `docker-manager.js` | Docker Compose yonetimi |
| `realtime-manager.js` | Supabase realtime + scheduler durumu |

## MCP Sunuculari

Cursor IDE'de 9 MCP sunucusu yapilandirilmis (`~/.cursor/mcp.json`):

| Sunucu | Kullanim | Ne Zaman |
|--------|----------|----------|
| **supabase** | DB sorgulama, migration, edge function, tablo listeleme | DB sema degisiklikleri, veri sorgulama |
| **github** | Repo, PR, issue, code search | Git islemleri, PR olusturma |
| **digitalocean** | App Platform, sunucu yonetimi | Deploy, sunucu durumu kontrolu |
| **Notion** | Workspace erisimi, sayfa okuma/yazma | Dokumantasyon, proje yonetimi |
| **tavily** | Web arama, arastirma, URL extract | Guncel bilgi arama, dokumantasyon kontrolu |
| **cloudflare** | DNS, Workers yonetimi | Domain ayarlari |
| **Figma Desktop** | UI tasarim erisimi | Tasarim dosyalari |
| **MCP_DOCKER** | Docker container yonetimi | Container islemleri |
| **postgres** | Dogrudan PostgreSQL sorgusu (lokal dev DB) | Kompleks SQL sorgulari |

## Env Yapisi

| Dosya | Konum | Aciklama |
|-------|-------|----------|
| `.env` | root (backend icin) | Ana env dosyasi (backend/.env'den okunur) |
| `backend/.env` | backend/ | Backend env (DATABASE_URL, JWT_SECRET, API keyleri) |
| `frontend/.env.local` | frontend/ | Frontend lokal env (NEXT_PUBLIC_*) |
| `frontend/.env.production` | frontend/ | Production frontend env (Supabase URL + anon key) |
| `services/whatsapp/.env` | services/whatsapp/ | WhatsApp servisi env |
| `.env.example` | root | Tum degiskenlerin sablonu (zorunlu + opsiyonel) |

### Zorunlu Env Degiskenleri

- `DATABASE_URL` - Supabase PostgreSQL connection string
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase proje URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `JWT_SECRET` - JWT imzalama anahtari (min 32 karakter)

### Onemli Opsiyonel Degiskenler

- `ANTHROPIC_API_KEY` - Claude AI (AI ozellikleri icin)
- `AZURE_DOCUMENT_AI_*` - Azure Document Intelligence (dokuman pipeline)
- `IHALEBUL_USERNAME/PASSWORD` - Ihale scraping
- `SMTP_*` veya `RESEND_API_KEY` - Email gonderimi

> Tum degiskenlerin tam listesi: `.env.example`

## Deploy Akisi

### Hizli Deploy (tek servis)
```bash
./scripts/deploy.sh frontend   # Sadece frontend build + restart
./scripts/deploy.sh backend    # Sadece backend restart
```

### Tam Deploy
```bash
./scripts/deploy.sh all        # Git pull + npm install + build + PM2 restart
```

### Manuel Deploy Adimlari
```bash
ssh -i ~/.ssh/procheff_deploy root@46.101.172.210
cd /root/catering-pro
git fetch origin main && git reset --hard origin/main
cd backend && npm install
cd ../frontend && npm install && npm run build
cd .. && pm2 stop all && pm2 delete all && pm2 start ecosystem.config.cjs
```

### Production Altyapisi
- **PM2**: `ecosystem.config.cjs` (backend port 3001, frontend port 3000)
- **Nginx**: Reverse proxy (`/` -> :3000, `/api` -> :3001) - config sunucuda, repo'da degil
- **Sunucu**: DigitalOcean Droplet 46.101.172.210
- **SSH Key**: `~/.ssh/procheff_deploy` (ed25519)
- **Uzak Dizin**: `/root/catering-pro`

## Zamanlanmis Gorevler (Cron)

Backend'de `node-cron` ile calisan scheduler'lar:

| Servis | Zamanlama | Islem |
|--------|-----------|-------|
| `tender-scheduler.js` | 08:00, 14:00, 19:00 | Ihale listesi tarama |
| `tender-scheduler.js` | 09:00, 15:00 | Dokuman isleme |
| `tender-scheduler.js` | 03:00 | Eski veri temizligi |
| `tender-scheduler.js` | 02:00 | Auto-retrain kontrol |
| `piyasa-sync-scheduler.js` | 08:30, 13:30, 18:30 | Kredi/piyasa fiyat sync |
| `piyasa-sync-scheduler.js` | 09:00 | Hal fiyat sync |
| `piyasa-sync-scheduler.js` | 10:00 Pazartesi | Mevzuat takip |
| `reminder-notification-scheduler.js` | 07:00 | Hatirlatici bildirimler |
| `sync-scheduler.js` | Her 6 saat | Otomatik senkronizasyon |
| `sync-scheduler.js` | 00:00 | Gece tam senkronizasyon |
| `sync-scheduler.js` | 09:00 Pazartesi | Haftalik rapor |

## Docker (Lokal Gelistirme)

`docker-compose.yml` ile lokal dev ortami:

| Servis | Port | Aciklama |
|--------|------|----------|
| postgres | 5432 | PostgreSQL 16 (lokal dev DB) |
| whatsapp-service | 3002 | WhatsApp entegrasyonu |
| instagram-service | 3003 | Instagram entegrasyonu |

```bash
docker compose up -d          # Servisleri baslat
docker compose down            # Servisleri durdur
npm run docker:status          # Durum kontrolu
```

## Commit Kurallari

- Prefix: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Co-Author: `Co-Authored-By: Claude <noreply@anthropic.com>`
- Pre-commit hook: API URL ve hassas veri kontrolu yapar

## Onemli Uyarilar

- `.env` dosyalari ASLA commit edilmez
- `NEXT_PUBLIC_API_URL` artik kullanilmiyor, `config.ts` dinamik URL olusturuyor
- Backend'de TypeScript YOK, sadece `.js` dosyalari
- Frontend'de `swr` bazi eski kodlarda kullanilir, yeni kod `@tanstack/react-query` kullanmali
- `ANTHROPIC_API_KEY` kullan (`CLAUDE_API_KEY` eski, kaldirildi)
- `SUPABASE_SERVICE_KEY` kullan (standart isim)
- CI/CD pipeline yok, deploy tamamen manuel (`scripts/deploy.sh`)
- Nginx config repo'da degil, sunucuda `/etc/nginx/sites-available/catering`
