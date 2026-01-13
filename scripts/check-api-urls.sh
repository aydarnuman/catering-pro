#!/bin/bash
# =============================================================================
# API URL Kontrol Script'i
# Frontend'de hardcoded localhost:3001 URL'lerini tespit eder
# 
# Kullanım: ./scripts/check-api-urls.sh
# =============================================================================

set -e

FRONTEND_SRC="frontend/src"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "🔍 API URL Kontrol Script'i"
echo "=========================================="
echo ""

cd "$(dirname "$0")/.."

# 1. Hardcoded localhost:3001 kontrolü
echo "1️⃣  Hardcoded localhost:3001 kontrolü..."
HARDCODED=$(grep -rn "localhost:3001" "$FRONTEND_SRC" --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "config.ts" | grep -v ".bak" | grep -v "page-new" || true)

if [ -n "$HARDCODED" ]; then
    echo -e "${RED}❌ HATA: Hardcoded URL tespit edildi!${NC}"
    echo ""
    echo "$HARDCODED"
    echo ""
    echo -e "${YELLOW}Çözüm: Bu dosyalarda şu değişiklikleri yap:${NC}"
    echo "  1. import { API_BASE_URL } from '@/lib/config';"
    echo "  2. 'http://localhost:3001' yerine \`\${API_BASE_URL}\` kullan"
    echo ""
    ERRORS=1
else
    echo -e "${GREEN}✅ Hardcoded URL yok${NC}"
    ERRORS=0
fi

echo ""

# 2. process.env.NEXT_PUBLIC_API_URL direkt kullanımı
echo "2️⃣  process.env.NEXT_PUBLIC_API_URL direkt kullanım kontrolü..."
DIRECT_ENV=$(grep -rn "process.env.NEXT_PUBLIC_API_URL" "$FRONTEND_SRC" --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "config.ts" | grep -v ".bak" || true)

if [ -n "$DIRECT_ENV" ]; then
    echo -e "${YELLOW}⚠️  UYARI: Direkt env kullanımı tespit edildi${NC}"
    echo ""
    echo "$DIRECT_ENV"
    echo ""
    echo -e "${YELLOW}Öneri: config.ts üzerinden API_BASE_URL kullanımı daha güvenli${NC}"
else
    echo -e "${GREEN}✅ Direkt env kullanımı yok${NC}"
fi

echo ""

# 3. API_BASE_URL import kontrolü
echo "3️⃣  API_BASE_URL import kullanım sayısı..."
IMPORT_COUNT=$(grep -rn "import { API_BASE_URL }" "$FRONTEND_SRC" --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
echo -e "${GREEN}📊 ${IMPORT_COUNT} dosyada API_BASE_URL import ediliyor${NC}"

echo ""

# 4. config.ts kontrolü
echo "4️⃣  config.ts dosyası kontrolü..."
if [ -f "$FRONTEND_SRC/lib/config.ts" ]; then
    echo -e "${GREEN}✅ config.ts mevcut${NC}"
    
    # getApiBaseUrl fonksiyonu var mı?
    if grep -q "getApiBaseUrl" "$FRONTEND_SRC/lib/config.ts"; then
        echo -e "${GREEN}✅ Dinamik URL çözümü aktif${NC}"
    else
        echo -e "${YELLOW}⚠️  Statik URL kullanılıyor${NC}"
    fi
else
    echo -e "${RED}❌ config.ts bulunamadı!${NC}"
    ERRORS=1
fi

echo ""
echo "=========================================="

if [ "$ERRORS" -eq 0 ]; then
    echo -e "${GREEN}✅ TÜM KONTROLLER BAŞARILI${NC}"
    exit 0
else
    echo -e "${RED}❌ HATALAR TESPİT EDİLDİ${NC}"
    exit 1
fi
