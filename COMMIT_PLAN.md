# Commit Planı

## 1. Dokümantasyon Reorganizasyonu
```bash
# Dokümantasyon dosyalarını docs/ klasörüne taşıma
git add docs/
git rm CURSOR-PROMPTS.md README-DEV.md REALTIME_SETUP.md SAYFA_AYRISTIRMA_PLANI.md SCRAPER_ADMIN_PANEL_TALIMATI.md SCRAPER_ENTEGRASYON_TALIMATI.md supabase-setup.md
git commit -m "docs: reorganize documentation into docs/ folder"
```

## 2. Database Migrations
```bash
# Unified notes ve notifications migration'ları
git add supabase/migrations/
git add backend/src/migrations/
git commit -m "feat(database): add unified notes and notifications migrations"
```

## 3. Backend: Unified Notes System
```bash
# Notes route'ları ve servisleri
git add backend/src/routes/notes/
git add backend/src/routes/notlar.js
git commit -m "feat(backend): implement unified notes system"
```

## 4. Backend: Unified Notifications System
```bash
# Notification servisleri
git add backend/src/services/unified-notification-service.js
git add backend/src/services/reminder-notification-scheduler.js
git add backend/src/routes/notifications.js
git add backend/src/services/admin-notification-service.js
git commit -m "feat(backend): implement unified notifications system"
```

## 5. Backend: Middleware ve Route Refactoring
```bash
# Middleware iyileştirmeleri
git add backend/src/middleware/
git add backend/src/routes/auth.js
git add backend/src/routes/prompt-builder.js
git add backend/src/routes/tender-tracking.js
git add backend/src/routes/kasa-banka.js
git add backend/src/server.js
git commit -m "refactor(backend): improve middleware and route handling"
```

## 6. Frontend: Notes ve Notifications UI
```bash
# Notes component'leri
git add frontend/src/components/NotesModal.tsx
git add frontend/src/components/notes/
git add frontend/src/hooks/useNotes.ts
git add frontend/src/lib/api/services/notes.ts
git add frontend/src/types/notes.ts
git add frontend/src/components/NotesSection/
git add frontend/src/components/NotificationDropdown.tsx
git commit -m "feat(frontend): add unified notes and notifications UI"
```

## 7. Frontend: Genel UI/UX İyileştirmeleri
```bash
# Component refactoring'leri
git add frontend/src/components/
git add frontend/src/app/
git add frontend/src/context/AuthContext.tsx
git add frontend/src/hooks/usePermissions.ts
git add frontend/src/lib/api.ts
git add frontend/src/lib/api/services/
git add frontend/src/lib/supabase/
git add frontend/src/middleware.ts
git add frontend/src/app/globals.css
git add frontend/src/app/layout.tsx
git commit -m "refactor(frontend): improve UI/UX and component structure"
```

## 8. Finans Modülü Güncellemeleri
```bash
# Finans component'leri ve sayfaları
git add frontend/src/components/finans/
git add frontend/src/app/muhasebe/
git commit -m "feat(frontend): update finans module components"
```

## 9. Script Reorganizasyonu ve Temizlik
```bash
# Script dosyalarını scripts/ klasörüne taşıma
git add scripts/
git rm activate-realtime.sh setup-new-project.sh start-all.sh
git rm backend/add-demo-notifications.js backend/add-faaliyet-kodu.js backend/inspect-detail.js
git rm backend/test-ihale.txt backend/test-uyumsoft-login.js
git rm database/migrate.js database/migrations/
git rm test-document.txt test-ihale.txt supabase-sql-tedarikci-urun-mapping.sql
git add backend/sql/
git add backend/archive/
git commit -m "chore: reorganize scripts and clean up test files"
```

## 10. Config ve Dependency Güncellemeleri
```bash
# Config dosyaları
git add backend/package.json
git add package-lock.json
git add frontend/biome.json
git add .devmenu.json
git commit -m "chore: update dependencies and config files"
```

## 11. Script Dosyası Taşıma (service.sh)
```bash
# service.sh dosyası scripts/ klasörüne taşınmış
git add scripts/service.sh
git rm service.sh
git commit -m "chore: move service.sh to scripts/ folder"
```

## Notlar
- `backend/logs/.*-audit.json` dosyaları .gitignore'da olduğu için commit edilmeyecek
- `frontend/tsconfig.tsbuildinfo` dosyası .gitignore'da olduğu için commit edilmeyecek
- Yeni eklenen `frontend/src/app/artlist-demo/` klasörü ayrı bir commit olabilir (eğer önemli bir özellikse)
