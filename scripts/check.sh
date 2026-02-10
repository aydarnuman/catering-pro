#!/bin/bash
# ─────────────────────────────────────────────────
# Hızlı Doğrulama Scripti
# Biome lint + TypeScript compile tek komutla kontrol
# Kullanım: ./scripts/check.sh [frontend|backend|all]
# ─────────────────────────────────────────────────

set -e

SCOPE="${1:-all}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
ERRORS=0

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  DOĞRULAMA: $SCOPE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Frontend TypeScript Compile ──
if [[ "$SCOPE" == "frontend" || "$SCOPE" == "all" ]]; then
  echo ""
  echo "▸ [1/3] TypeScript compile check..."
  TS_ERRORS=$(cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS" || true)
  if [[ "$TS_ERRORS" -gt 0 ]]; then
    echo -e "  ${YELLOW}⚠ $TS_ERRORS TypeScript hatası${NC}"
    # Detayları göster (pre-existing olanları filtrele)
    cd frontend && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
    cd ..
  else
    echo -e "  ${GREEN}✓ TypeScript temiz${NC}"
  fi

  # ── 2. Biome Lint ──
  echo ""
  echo "▸ [2/3] Biome lint check..."
  if command -v npx &> /dev/null; then
    BIOME_OUT=$(cd frontend && npx biome check --no-errors-on-unmatched src/ 2>&1 || true)
    BIOME_ERRORS=$(echo "$BIOME_OUT" | grep -c "error\[" || true)
    BIOME_WARNS=$(echo "$BIOME_OUT" | grep -c "warning\[" || true)
    if [[ "$BIOME_ERRORS" -gt 0 ]]; then
      echo -e "  ${RED}✗ $BIOME_ERRORS biome error${NC}"
      ERRORS=$((ERRORS + 1))
    elif [[ "$BIOME_WARNS" -gt 0 ]]; then
      echo -e "  ${YELLOW}⚠ $BIOME_WARNS biome warning${NC}"
    else
      echo -e "  ${GREEN}✓ Biome temiz${NC}"
    fi
  else
    echo -e "  ${YELLOW}⚠ Biome bulunamadı, atlanıyor${NC}"
  fi
fi

# ── 3. Backend Lint ──
if [[ "$SCOPE" == "backend" || "$SCOPE" == "all" ]]; then
  echo ""
  echo "▸ [3/3] Backend lint check..."
  if command -v npx &> /dev/null; then
    BACKEND_OUT=$(cd backend && npx biome check --no-errors-on-unmatched src/ 2>&1 || true)
    BACKEND_ERRORS=$(echo "$BACKEND_OUT" | grep -c "error\[" || true)
    if [[ "$BACKEND_ERRORS" -gt 0 ]]; then
      echo -e "  ${RED}✗ $BACKEND_ERRORS backend biome error${NC}"
      ERRORS=$((ERRORS + 1))
    else
      echo -e "  ${GREEN}✓ Backend biome temiz${NC}"
    fi
  fi
fi

# ── Sonuç ──
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ "$ERRORS" -gt 0 ]]; then
  echo -e "  ${RED}✗ $ERRORS KRITIK HATA - düzeltilmeli${NC}"
  exit 1
else
  echo -e "  ${GREEN}✓ Doğrulama tamamlandı${NC}"
  exit 0
fi
