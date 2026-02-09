#!/bin/bash
# ============================================
# CATERING PRO - TAM KAPSAMLI BACKUP SCRIPT
# ============================================
# Tarih: 2026-02-09
# Kullanım: bash scripts/full-backup.sh
# ============================================

set -e

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
PROJECT_DIR="/Users/numanaydar/Desktop/CATERİNG"
BACKUP_BASE="/Users/numanaydar/Desktop/Diğer/Catering Pro yedek"
BACKUP_DIR="${BACKUP_BASE}/BACKUP_${TIMESTAMP}"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  CATERING PRO - TAM KAPSAMLI BACKUP${NC}"
echo -e "${BLUE}  Tarih: ${TIMESTAMP}${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Backup klasörü oluştur
mkdir -p "${BACKUP_DIR}"
mkdir -p "${BACKUP_DIR}/database"
mkdir -p "${BACKUP_DIR}/env-configs"
mkdir -p "${BACKUP_DIR}/git-bundle"

# ============================================
# 1. GIT BUNDLE (tüm branch ve tag'ler)
# ============================================
echo -e "${YELLOW}[1/7] Git bundle oluşturuluyor...${NC}"
cd "${PROJECT_DIR}"
if [ -d ".git" ]; then
    git bundle create "${BACKUP_DIR}/git-bundle/catering-pro-full.bundle" --all 2>/dev/null
    echo -e "${GREEN}  ✓ Git bundle oluşturuldu${NC}"
    
    # Son commit bilgisi
    git log --oneline -5 > "${BACKUP_DIR}/git-bundle/son-5-commit.txt"
    git branch -a > "${BACKUP_DIR}/git-bundle/branch-listesi.txt"
    git remote -v > "${BACKUP_DIR}/git-bundle/remote-bilgisi.txt" 2>/dev/null || true
    echo -e "${GREEN}  ✓ Git meta bilgileri kaydedildi${NC}"
else
    echo -e "${RED}  ✗ Git repo bulunamadı!${NC}"
fi

# ============================================
# 2. VERITABANI DUMP (Supabase)
# ============================================
echo -e "${YELLOW}[2/7] Veritabanı yedekleniyor...${NC}"

# pg_dump yolunu belirle (v17 öncelikli)
PG_DUMP=""
if [ -x "/opt/homebrew/opt/postgresql@17/bin/pg_dump" ]; then
    PG_DUMP="/opt/homebrew/opt/postgresql@17/bin/pg_dump"
elif command -v pg_dump &> /dev/null; then
    PG_DUMP="pg_dump"
fi

if [ -n "$PG_DUMP" ]; then
    PG_VERSION=$($PG_DUMP --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
    echo -e "${GREEN}  pg_dump versiyonu: ${PG_VERSION}${NC}"
    
    # .env'den DATABASE_URL'i çek (= içeren URL'leri de destekler)
    DB_URL=$(grep "^DATABASE_URL=" "${PROJECT_DIR}/.env" | sed 's/^DATABASE_URL=//')
    
    # Root .env'de yoksa backend/.env'den dene
    if [ -z "$DB_URL" ]; then
        DB_URL=$(grep "^DATABASE_URL=" "${PROJECT_DIR}/backend/.env" | sed 's/^DATABASE_URL=//')
    fi
    
    if [ -n "$DB_URL" ]; then
        echo -e "${YELLOW}  Veritabanına bağlanılıyor...${NC}"
        
        # Schema dump (yapı)
        if $PG_DUMP "$DB_URL" --schema-only --no-owner --no-privileges \
            -f "${BACKUP_DIR}/database/schema.sql" 2>"${BACKUP_DIR}/database/schema-errors.log"; then
            SCHEMA_SIZE=$(du -sh "${BACKUP_DIR}/database/schema.sql" | cut -f1)
            echo -e "${GREEN}  ✓ Schema dump alındı (${SCHEMA_SIZE})${NC}"
            rm -f "${BACKUP_DIR}/database/schema-errors.log"
        else
            echo -e "${RED}  ✗ Schema dump başarısız. Hata:${NC}"
            cat "${BACKUP_DIR}/database/schema-errors.log" 2>/dev/null
        fi
        
        # Full dump (veri dahil)
        if $PG_DUMP "$DB_URL" --no-owner --no-privileges \
            -f "${BACKUP_DIR}/database/full-dump.sql" 2>"${BACKUP_DIR}/database/dump-errors.log"; then
            DUMP_SIZE=$(du -sh "${BACKUP_DIR}/database/full-dump.sql" | cut -f1)
            echo -e "${GREEN}  ✓ Full data dump alındı (${DUMP_SIZE})${NC}"
            rm -f "${BACKUP_DIR}/database/dump-errors.log"
        else
            echo -e "${RED}  ✗ Full dump başarısız. Hata:${NC}"
            cat "${BACKUP_DIR}/database/dump-errors.log" 2>/dev/null
        fi
        
        # Custom format (sıkıştırılmış, restore edilebilir)
        if $PG_DUMP "$DB_URL" -F c --no-owner --no-privileges \
            -f "${BACKUP_DIR}/database/backup.dump" 2>"${BACKUP_DIR}/database/custom-errors.log"; then
            CUSTOM_SIZE=$(du -sh "${BACKUP_DIR}/database/backup.dump" | cut -f1)
            echo -e "${GREEN}  ✓ Custom format dump alındı (${CUSTOM_SIZE})${NC}"
            rm -f "${BACKUP_DIR}/database/custom-errors.log"
        else
            echo -e "${RED}  ✗ Custom format dump başarısız. Hata:${NC}"
            cat "${BACKUP_DIR}/database/custom-errors.log" 2>/dev/null
        fi
    else
        echo -e "${RED}  ✗ DATABASE_URL bulunamadı (.env ve backend/.env kontrol edildi)${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠ pg_dump bulunamadı. Kurulum:${NC}"
    echo -e "${YELLOW}    brew install postgresql@17${NC}"
    echo -e "${YELLOW}    Sonra bu script'i tekrar çalıştırın.${NC}"
fi

# Her durumda migration dosyalarını da kopyala (ekstra güvenlik)
echo -e "${YELLOW}  → Migration dosyaları da kopyalanıyor...${NC}"
if [ -d "${PROJECT_DIR}/supabase/migrations" ]; then
    cp -r "${PROJECT_DIR}/supabase/migrations" "${BACKUP_DIR}/database/migrations"
    MIG_COUNT=$(ls "${BACKUP_DIR}/database/migrations/"*.sql 2>/dev/null | wc -l | tr -d ' ')
    echo -e "${GREEN}  ✓ Migration dosyaları kopyalandı (${MIG_COUNT} dosya)${NC}"
fi

# ============================================
# 3. ENV & CONFIG DOSYALARI
# ============================================
echo -e "${YELLOW}[3/7] Konfigürasyon dosyaları yedekleniyor...${NC}"

# Root env dosyaları
for f in .env .env.example .env.local .env.production; do
    if [ -f "${PROJECT_DIR}/${f}" ]; then
        cp "${PROJECT_DIR}/${f}" "${BACKUP_DIR}/env-configs/root-${f}"
        echo -e "${GREEN}  ✓ ${f}${NC}"
    fi
done

# Backend env
if [ -f "${PROJECT_DIR}/backend/.env" ]; then
    cp "${PROJECT_DIR}/backend/.env" "${BACKUP_DIR}/env-configs/backend-.env"
    echo -e "${GREEN}  ✓ backend/.env${NC}"
fi

# Frontend env
for f in .env .env.local .env.production; do
    if [ -f "${PROJECT_DIR}/frontend/${f}" ]; then
        cp "${PROJECT_DIR}/frontend/${f}" "${BACKUP_DIR}/env-configs/frontend-${f}"
        echo -e "${GREEN}  ✓ frontend/${f}${NC}"
    fi
done

# Diğer config dosyaları
for f in google-credentials.json docker-compose.yml ecosystem.config.cjs .cursorrules CLAUDE.md; do
    if [ -f "${PROJECT_DIR}/${f}" ]; then
        cp "${PROJECT_DIR}/${f}" "${BACKUP_DIR}/env-configs/${f}"
        echo -e "${GREEN}  ✓ ${f}${NC}"
    fi
done

# ============================================
# 4. KOD (node_modules hariç)
# ============================================
echo -e "${YELLOW}[4/7] Kaynak kod yedekleniyor...${NC}"
mkdir -p "${BACKUP_DIR}/source"

# rsync ile node_modules, .git, .next, dist hariç kopyala
rsync -a --progress \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='.next' \
    --exclude='dist' \
    --exclude='build' \
    --exclude='.cache' \
    --exclude='coverage' \
    --exclude='.DS_Store' \
    --exclude='temp-analysis' \
    "${PROJECT_DIR}/" "${BACKUP_DIR}/source/" 2>/dev/null

echo -e "${GREEN}  ✓ Kaynak kod kopyalandı${NC}"

# ============================================
# 5. UPLOADS & DOSYALAR
# ============================================
echo -e "${YELLOW}[5/7] Upload dosyaları yedekleniyor...${NC}"
if [ -d "${PROJECT_DIR}/uploads" ] && [ "$(ls -A ${PROJECT_DIR}/uploads 2>/dev/null)" ]; then
    mkdir -p "${BACKUP_DIR}/uploads"
    cp -r "${PROJECT_DIR}/uploads/"* "${BACKUP_DIR}/uploads/" 2>/dev/null
    UPLOAD_COUNT=$(find "${BACKUP_DIR}/uploads" -type f 2>/dev/null | wc -l | tr -d ' ')
    echo -e "${GREEN}  ✓ ${UPLOAD_COUNT} dosya kopyalandı${NC}"
else
    echo -e "${YELLOW}  ⚠ Upload klasörü boş veya yok${NC}"
fi

# ============================================
# 6. PM2 & SERVICE CONFIG
# ============================================
echo -e "${YELLOW}[6/7] Servis konfigürasyonu yedekleniyor...${NC}"
mkdir -p "${BACKUP_DIR}/service-config"

# PM2 config
if [ -f "${PROJECT_DIR}/ecosystem.config.cjs" ]; then
    cp "${PROJECT_DIR}/ecosystem.config.cjs" "${BACKUP_DIR}/service-config/"
fi

# PM2 process list
if command -v pm2 &> /dev/null; then
    pm2 jlist > "${BACKUP_DIR}/service-config/pm2-processes.json" 2>/dev/null || true
    echo -e "${GREEN}  ✓ PM2 süreç listesi kaydedildi${NC}"
fi

# SSH keys (sadece public key)
if [ -f "/Users/numanaydar/.ssh/catering_pro.pub" ]; then
    cp "/Users/numanaydar/.ssh/catering_pro.pub" "${BACKUP_DIR}/service-config/"
    echo -e "${GREEN}  ✓ SSH public key kopyalandı${NC}"
fi

# ============================================
# 7. BACKUP META & SIKIŞTIRMA
# ============================================
echo -e "${YELLOW}[7/7] Backup tamamlanıyor...${NC}"

# Meta bilgi dosyası
cat > "${BACKUP_DIR}/BACKUP-INFO.md" << EOF
# Catering Pro Backup
- **Tarih:** ${TIMESTAMP}
- **Kaynak:** ${PROJECT_DIR}
- **Tip:** Tam Kapsamlı (Full Backup)

## İçerik
1. **git-bundle/** - Tüm git geçmişi (branch + tag)
2. **database/** - Veritabanı dump (schema + data) veya migration dosyaları
3. **env-configs/** - Tüm .env ve config dosyaları
4. **source/** - Kaynak kod (node_modules hariç)
5. **uploads/** - Yüklenen dosyalar
6. **service-config/** - PM2 ve servis ayarları

## Restore
\`\`\`bash
# Git restore
git clone catering-pro-full.bundle catering-pro-restored

# DB restore (pg_dump varsa)
psql \$DATABASE_URL < database/full-dump.sql
# veya
pg_restore -d \$DATABASE_URL database/backup.dump

# Env dosyalarını yerine koy
cp env-configs/root-.env .env
cp env-configs/backend-.env backend/.env

# Dependencies
npm install
cd frontend && npm install
\`\`\`

## Node/NPM Versiyonları
$(node -v 2>/dev/null || echo "Node: bilinmiyor")
$(npm -v 2>/dev/null || echo "NPM: bilinmiyor")
EOF

echo -e "${GREEN}  ✓ Backup meta dosyası oluşturuldu${NC}"

# Sıkıştır
echo -e "${YELLOW}  Sıkıştırılıyor...${NC}"
cd "${BACKUP_BASE}"
tar -czf "BACKUP_${TIMESTAMP}.tar.gz" "BACKUP_${TIMESTAMP}/" 2>/dev/null
ARCHIVE_SIZE=$(du -sh "BACKUP_${TIMESTAMP}.tar.gz" | cut -f1)
echo -e "${GREEN}  ✓ Arşiv oluşturuldu: ${ARCHIVE_SIZE}${NC}"

# ============================================
# ÖZET
# ============================================
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}  ✅ BACKUP TAMAMLANDI${NC}"
echo -e "${BLUE}================================================${NC}"
echo -e "  Klasör:  ${BACKUP_DIR}"
echo -e "  Arşiv:   ${BACKUP_BASE}/BACKUP_${TIMESTAMP}.tar.gz"
echo -e "  Boyut:   Klasör: ${TOTAL_SIZE} | Arşiv: ${ARCHIVE_SIZE}"
echo -e ""
echo -e "${YELLOW}  💡 İpucu: Arşivi harici diske veya buluta da kopyalayın${NC}"
echo -e "${BLUE}================================================${NC}"
