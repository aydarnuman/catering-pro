# CLAUDE.md - Catering Pro AI Asistanı Rehberi

Bu dosya Claude Code'un projeyi anlaması için referans belgesidir.

## Proje Yapısı

```
/frontend     - Next.js 15 + Mantine UI
/backend      - Express.js API
/docs         - Tüm dokümantasyon
/scripts      - Deploy ve yardımcı scriptler
/supabase     - Migration dosyaları
```

## Önemli Dosyalar

- `docs/DEPLOYMENT.md` - Deploy rehberi
- `docs/DIGITALOCEAN.md` - Sunucu yönetimi
- `docs/00_INDEX.md` - Tüm dökümantasyon indeksi
- `frontend/src/lib/config.ts` - API URL yapılandırması

## Deploy Komutları

### Hızlı Deploy (Önerilen)
```bash
# Sadece frontend deploy
ssh -i ~/.ssh/procheff_deploy root@46.101.172.210 "cd /root/catering-pro && git pull origin main && cd frontend && npm run build && pm2 restart catering-frontend"

# Sadece backend deploy
ssh -i ~/.ssh/procheff_deploy root@46.101.172.210 "cd /root/catering-pro && git pull origin main && pm2 restart catering-backend"

# Full deploy
ssh -i ~/.ssh/procheff_deploy root@46.101.172.210 "cd /root/catering-pro && git pull origin main && cd frontend && npm run build && pm2 restart all"
```

### Deploy Script (Interactive)
```bash
./scripts/deploy.sh              # Full deploy
./scripts/deploy.sh frontend     # Sadece frontend
./scripts/deploy.sh backend      # Sadece backend
./scripts/deploy.sh quick        # Sadece git pull
```

## Sunucu Bilgileri

| Özellik | Değer |
|---------|-------|
| Domain | https://catering-tr.com |
| IP | 46.101.172.210 |
| SSH Key | ~/.ssh/procheff_deploy |
| User | root |
| Project Path | /root/catering-pro |
| Process Manager | PM2 |

## Geliştirme

```bash
# Backend başlat
cd backend && npm run dev

# Frontend başlat
cd frontend && npm run dev
```

## Portlar

- Frontend: 3000
- Backend: 3001
- Database: Supabase (cloud)

## Commit Kuralları

- UI değişiklikleri: `fix:` veya `feat:` prefix
- Co-Author ekle: `Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>`
- Pre-commit hook var, API URL ve hassas veri kontrolü yapar

## Sık Kullanılan Komutlar

```bash
# Health check
curl https://catering-tr.com/health

# PM2 logları (SSH ile)
ssh -i ~/.ssh/procheff_deploy root@46.101.172.210 "pm2 logs --lines 50"

# PM2 status
ssh -i ~/.ssh/procheff_deploy root@46.101.172.210 "pm2 status"
```
