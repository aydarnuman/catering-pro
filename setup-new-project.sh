#!/bin/bash

# ============================================
# Catering Pro - Yeni Proje Kurulum Scripti
# ============================================
# Bu script, yeni bir projeye tüm dosyaları kopyalar ve temel kurulumu yapar.

set -e  # Hata durumunda dur

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Mesaj fonksiyonları
info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

success() {
    echo -e "${GREEN}✅${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}❌${NC} $1"
}

# Mevcut proje dizini
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
info "Mevcut proje dizini: $CURRENT_DIR"

# Yeni proje dizini
read -p "Yeni proje dizini yolunu girin: " NEW_PROJECT_DIR

if [ -z "$NEW_PROJECT_DIR" ]; then
    error "Yeni proje dizini belirtilmedi!"
    exit 1
fi

# Dizin var mı kontrol et
if [ -d "$NEW_PROJECT_DIR" ]; then
    warning "Dizin zaten mevcut: $NEW_PROJECT_DIR"
    read -p "Devam etmek istiyor musunuz? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    info "Yeni dizin oluşturuluyor: $NEW_PROJECT_DIR"
    mkdir -p "$NEW_PROJECT_DIR"
fi

cd "$NEW_PROJECT_DIR"
NEW_PROJECT_DIR="$(pwd)"

info "Yeni proje dizini: $NEW_PROJECT_DIR"

# ============================================
# 1. Dizin Yapısını Oluştur
# ============================================
info "Dizin yapısı oluşturuluyor..."

mkdir -p apps/admin
mkdir -p services/api-server
mkdir -p services/ihale-scraper
mkdir -p services/normalizer
mkdir -p shared/src/{database,types,utils}
mkdir -p scripts

success "Dizin yapısı oluşturuldu"

# ============================================
# 2. Root Dosyalarını Kopyala
# ============================================
info "Root dosyaları kopyalanıyor..."

ROOT_FILES=(
    "package.json"
    "docker-compose.yml"
    "env.example"
    "biome.json"
    "jest.config.js"
    "playwright.config.ts"
    "README.md"
    "MIGRATION_REHBERI.md"
    "OZELLIKLER_OZETI.md"
)

for file in "${ROOT_FILES[@]}"; do
    if [ -f "$CURRENT_DIR/$file" ]; then
        cp "$CURRENT_DIR/$file" "$NEW_PROJECT_DIR/$file"
        success "Kopyalandı: $file"
    else
        warning "Dosya bulunamadı: $file"
    fi
done

# ============================================
# 3. Shared Package'i Kopyala
# ============================================
info "Shared package kopyalanıyor..."

if [ -d "$CURRENT_DIR/shared" ]; then
    cp -r "$CURRENT_DIR/shared"/* "$NEW_PROJECT_DIR/shared/"
    success "Shared package kopyalandı"
else
    error "Shared package bulunamadı!"
    exit 1
fi

# ============================================
# 4. API Server'ı Kopyala
# ============================================
info "API Server kopyalanıyor..."

if [ -d "$CURRENT_DIR/services/api-server" ]; then
    cp -r "$CURRENT_DIR/services/api-server"/* "$NEW_PROJECT_DIR/services/api-server/"
    success "API Server kopyalandı"
else
    error "API Server bulunamadı!"
    exit 1
fi

# ============================================
# 5. İhale Scraper'ı Kopyala
# ============================================
info "İhale Scraper kopyalanıyor..."

if [ -d "$CURRENT_DIR/services/ihale-scraper" ]; then
    cp -r "$CURRENT_DIR/services/ihale-scraper"/* "$NEW_PROJECT_DIR/services/ihale-scraper/"
    success "İhale Scraper kopyalandı"
else
    error "İhale Scraper bulunamadı!"
    exit 1
fi

# ============================================
# 6. Normalizer'ı Kopyala (opsiyonel)
# ============================================
info "Normalizer kopyalanıyor..."

if [ -d "$CURRENT_DIR/services/normalizer" ]; then
    cp -r "$CURRENT_DIR/services/normalizer"/* "$NEW_PROJECT_DIR/services/normalizer/"
    success "Normalizer kopyalandı"
else
    warning "Normalizer bulunamadı (opsiyonel)"
fi

# ============================================
# 7. Admin Panel'i Kopyala
# ============================================
info "Admin Panel kopyalanıyor..."

if [ -d "$CURRENT_DIR/apps/admin" ]; then
    cp -r "$CURRENT_DIR/apps/admin"/* "$NEW_PROJECT_DIR/apps/admin/"
    success "Admin Panel kopyalandı"
else
    error "Admin Panel bulunamadı!"
    exit 1
fi

# ============================================
# 8. Scripts'i Kopyala
# ============================================
info "Scripts kopyalanıyor..."

if [ -d "$CURRENT_DIR/scripts" ]; then
    cp -r "$CURRENT_DIR/scripts"/* "$NEW_PROJECT_DIR/scripts/"
    chmod +x "$NEW_PROJECT_DIR/scripts"/*.sh
    success "Scripts kopyalandı"
fi

# ============================================
# 9. .gitignore Oluştur
# ============================================
info ".gitignore oluşturuluyor..."

cat > "$NEW_PROJECT_DIR/.gitignore" << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
.nyc_output

# Production
build/
dist/
.next/
out/

# Environment
.env
.env.local
.env*.local

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Docker
.docker/

# Storage
storage/
*.json
!package.json
!package-lock.json
!tsconfig.json

# Temporary
tmp/
temp/
*.tmp
EOF

success ".gitignore oluşturuldu"

# ============================================
# 10. Özet
# ============================================
echo ""
echo "============================================"
success "Kurulum tamamlandı!"
echo "============================================"
echo ""
info "Yeni proje dizini: $NEW_PROJECT_DIR"
echo ""
info "Sonraki adımlar:"
echo "  1. cd $NEW_PROJECT_DIR"
echo "  2. cp env.example .env"
echo "  3. .env dosyasını düzenle"
echo "  4. npm install"
echo "  5. npm run migrate -w @catering-pro/ihale-scraper"
echo "  6. npm run dev"
echo ""
info "Detaylı rehber için: MIGRATION_REHBERI.md"
echo ""

