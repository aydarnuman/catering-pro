# CLAUDE.md - Catering Pro AI Asistanı Rehberi

Bu dosya Claude Code'un projeyi anlaması için referans belgesidir.

## Proje Yapısı

> Detaylı keşif rehberi: `.cursor/rules/project-discovery.mdc`

```
/frontend     - Next.js 15 + Mantine UI
/backend      - Express.js API
/docs         - Genel dokümantasyon (deploy, API, modül rehberleri)
/backend/docs - Backend-spesifik dokümantasyon (mimari, pipeline, scraper)
/scripts      - Deploy ve yardımcı scriptler
/supabase     - Migration dosyaları
```

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
- Database: PostgreSQL (Supabase hosted)

## Auth Sistemi (Custom JWT + PostgreSQL)

Supabase Auth **kullanılmıyor**. Kimlik doğrulama tamamen custom:

- **Backend**: `backend/src/middleware/auth.js` - JWT doğrulama middleware
- **Backend**: `backend/src/routes/auth.js` - Login, register, refresh, session endpoint'leri
- **Yöntem**: bcrypt şifreleme + JWT access token (24 saat) + refresh token (30 gün)
- **Token taşıma**: HttpOnly cookie (access_token, refresh_token)
- **Session**: `user_sessions` tablosu, max 3 eşzamanlı oturum
- **Roller**: super_admin, admin, user
- **Yetki**: Modül bazlı RBAC (`modules` + `user_permissions` tabloları)
- **Güvenlik**: Rate limiting, IP whitelist/blacklist, hesap kilitleme (5 başarısız deneme)
- **Frontend**: `AuthContext.tsx` (state), `middleware.ts` (route koruma), `AuthGuard.tsx` / `AdminGuard.tsx`
- **Permission**: `usePermissions` hook + `requirePermission()` backend middleware

### Önemli Auth Dosyaları
```
backend/src/middleware/auth.js          # JWT doğrulama, requireAdmin, requirePermission
backend/src/routes/auth.js              # Login/logout/refresh/session yönetimi
backend/src/services/session-service.js # Oturum yönetimi (3 session limiti)
backend/src/services/login-attempt-service.js # Brute-force koruması
backend/src/services/permission-service.js    # RBAC motoru
frontend/src/context/AuthContext.tsx     # Auth state yönetimi
frontend/src/middleware.ts              # Route koruması (cookie kontrolü)
frontend/src/hooks/usePermissions.ts    # Modül bazlı yetki kontrolü
```

## MUTLAK KURAL: Test Etmeden Degisiklik Yapma

> Tam detaylar: `.cursor/rules/test-before-change.mdc` (alwaysApply)

Kod degistirmeden ONCE mevcut sistemin calisip calismadigini test et. Canli test yap, sonuclari raporla, SONRA plan olustur.

## Local Değişiklikleri AI'ya Gösterme

GitHub'a push etmeden, localdeki değişikliklerinizi AI'ya gösterebilirsiniz:

### Yöntem 1: AI'ya Direkt Söyle (Önerilen)
Sadece şunu söyleyin:
- "Değişikliklerimi gör"
- "Local değişiklikleri incele"
- "Ne değiştirdim?"

AI otomatik olarak `git status` ve `git diff` çalıştırır.

### Yöntem 2: Helper Script Kullan
```bash
# Tüm değişiklikleri göster
./scripts/show-local-changes.sh

# Sadece özet
./scripts/show-local-changes.sh --summary

# Tek dosya
./scripts/show-local-changes.sh frontend/src/app/page.tsx
```

### Yöntem 3: Manuel Git Komutları
```bash
# Hangi dosyalar değişti?
git status

# Tam farklar (tüm dosyalar)
git diff

# Belirli bir dosya
git diff src/components/MyComponent.tsx

# Staged + unstaged tüm değişiklikler
git diff HEAD
```

### Kullanım Örnekleri
```bash
# Örnek 1: Tüm değişiklikleri göster
"Localdeki tüm değişikliklerimi incele"

# Örnek 2: Sadece bir dosya
"frontend/src/app/page.tsx dosyasındaki değişikliklerimi kontrol et"

# Örnek 3: Hata kontrolü
"Bu değişikliklerde hata var mı?"

# Örnek 4: Review iste
"Bu kodu review edebilir misin?"
```

## Commit Kuralları

- UI değişiklikleri: `fix:` veya `feat:` prefix
- Co-Author ekle: `Co-Authored-By: Claude <noreply@anthropic.com>`
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
