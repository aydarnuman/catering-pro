#!/bin/bash
# =============================================================================
# HARDCODED URL TEMİZLEME SCRİPTİ
# 
# Bu script sunucuda çalıştırılmalı ve:
# 1. Tüm env dosyalarını kontrol eder
# 2. .next klasörünü tamamen temizler
# 3. PM2'yi tamamen restart eder
# 4. Yeni build yapar
# =============================================================================

set -e

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        🔧 HARDCODED URL TEMİZLEME SCRİPTİ                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

PROJECT_PATH="${1:-/root/catering-pro}"

cd "$PROJECT_PATH" || exit 1

# 1. Tüm env dosyalarını kontrol et
echo -e "${YELLOW}📋 Environment dosyalarını kontrol ediliyor...${NC}"
echo ""

ENV_FILES=(
    ".env"
    ".env.local"
    ".env.production"
    ".env.production.local"
    "frontend/.env"
    "frontend/.env.local"
    "frontend/.env.production"
    "frontend/.env.production.local"
)

FOUND_NEXT_PUBLIC_API_URL=false

for env_file in "${ENV_FILES[@]}"; do
    if [ -f "$env_file" ]; then
        echo -e "${BLUE}📄 $env_file:${NC}"
        if grep -q "NEXT_PUBLIC_API_URL" "$env_file"; then
            echo -e "${RED}   ⚠️  NEXT_PUBLIC_API_URL bulundu!${NC}"
            grep "NEXT_PUBLIC_API_URL" "$env_file" | sed 's/^/      /'
            FOUND_NEXT_PUBLIC_API_URL=true
        else
            echo -e "${GREEN}   ✅ NEXT_PUBLIC_API_URL yok${NC}"
        fi
    fi
done

echo ""

# 2. PM2 environment variables kontrolü
echo -e "${YELLOW}📋 PM2 environment variables kontrol ediliyor...${NC}"
PM2_ENV=$(pm2 env 2>/dev/null | grep -i "NEXT_PUBLIC_API_URL" || true)
if [ -n "$PM2_ENV" ]; then
    echo -e "${RED}   ⚠️  PM2'de NEXT_PUBLIC_API_URL bulundu:${NC}"
    echo "$PM2_ENV" | sed 's/^/      /'
    FOUND_NEXT_PUBLIC_API_URL=true
else
    echo -e "${GREEN}   ✅ PM2'de NEXT_PUBLIC_API_URL yok${NC}"
fi

echo ""

# 3. Shell environment variables kontrolü
echo -e "${YELLOW}📋 Shell environment variables kontrol ediliyor...${NC}"
if [ -n "$NEXT_PUBLIC_API_URL" ]; then
    echo -e "${RED}   ⚠️  Shell'de NEXT_PUBLIC_API_URL var: $NEXT_PUBLIC_API_URL${NC}"
    FOUND_NEXT_PUBLIC_API_URL=true
else
    echo -e "${GREEN}   ✅ Shell'de NEXT_PUBLIC_API_URL yok${NC}"
fi

echo ""

# 4. .next klasörünü tamamen temizle
echo -e "${YELLOW}🧹 .next klasörü temizleniyor...${NC}"
cd frontend || exit 1
rm -rf .next
rm -rf node_modules/.cache
echo -e "${GREEN}✅ Temizlik tamamlandı${NC}"
echo ""

# 5. Environment variable'ı unset et (build sırasında kullanılmasın)
echo -e "${YELLOW}🔧 Environment variables temizleniyor...${NC}"
unset NEXT_PUBLIC_API_URL
export NEXT_PUBLIC_API_URL=""
echo -e "${GREEN}✅ Environment variables temizlendi${NC}"
echo ""

# 6. Yeni build yap
echo -e "${YELLOW}🔨 Yeni build yapılıyor...${NC}"
npm run build
echo -e "${GREEN}✅ Build tamamlandı${NC}"
echo ""

# 7. Build içinde hardcoded URL kontrolü
echo -e "${YELLOW}🔍 Build içinde hardcoded URL kontrol ediliyor...${NC}"
if [ -d ".next" ]; then
    # Chunk dosyalarında api.catering-tr.com ara
    FOUND_HARDCODED=$(grep -r "api.catering-tr.com" .next/static/chunks/ 2>/dev/null | head -5 || true)
    if [ -n "$FOUND_HARDCODED" ]; then
        echo -e "${RED}   ⚠️  Hala hardcoded URL bulundu:${NC}"
        echo "$FOUND_HARDCODED" | sed 's/^/      /'
    else
        echo -e "${GREEN}   ✅ Hardcoded URL bulunamadı${NC}"
    fi
    
    # required-server-files.json kontrolü
    if [ -f ".next/required-server-files.json" ]; then
        if grep -q "api.catering-tr.com" .next/required-server-files.json 2>/dev/null; then
            echo -e "${RED}   ⚠️  required-server-files.json'da hala var:${NC}"
            grep "api.catering-tr.com" .next/required-server-files.json | sed 's/^/      /'
        else
            echo -e "${GREEN}   ✅ required-server-files.json temiz${NC}"
        fi
    fi
else
    echo -e "${RED}   ❌ .next klasörü bulunamadı!${NC}"
fi

echo ""

# 8. PM2'yi tamamen restart et
echo -e "${YELLOW}🔄 PM2 tam restart (stop/delete/start)...${NC}"
cd "$PROJECT_PATH" || exit 1
pm2 stop all || true
pm2 delete all || true
pm2 start ecosystem.config.js
echo -e "${GREEN}✅ PM2 restart tamamlandı${NC}"
echo ""

# 9. Özet
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✅ TEMİZLEME TAMAMLANDI!                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$FOUND_NEXT_PUBLIC_API_URL" = true ]; then
    echo -e "${YELLOW}⚠️  UYARI: Bazı dosyalarda NEXT_PUBLIC_API_URL bulundu!${NC}"
    echo -e "${YELLOW}   Bu dosyaları manuel olarak kontrol edin ve gerekiyorsa düzenleyin.${NC}"
    echo ""
fi

echo -e "${BLUE}📋 Sonraki adımlar:${NC}"
echo "   1. PM2 loglarını kontrol edin: pm2 logs"
echo "   2. Frontend'i test edin: curl http://localhost:3000"
echo "   3. Browser'da hardcoded URL olup olmadığını kontrol edin"
echo ""
