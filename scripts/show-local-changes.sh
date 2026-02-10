#!/bin/bash
# =============================================================================
# CATERING PRO - LOCAL DEĞİŞİKLİKLERİ GÖSTER
# 
# Bu script localdeki tüm değişiklikleri (commit edilmemiş) gösterir.
# AI'ya göstermek için kullanabilirsiniz.
#
# Kullanım:
#   ./scripts/show-local-changes.sh           # Tüm değişiklikler
#   ./scripts/show-local-changes.sh --summary # Sadece özet
#   ./scripts/show-local-changes.sh <dosya>   # Tek dosya
# =============================================================================

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

MODE="${1:---full}"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           📝 LOCAL DEĞİŞİKLİKLER RAPORU                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Git durumu
echo -e "${YELLOW}📋 Değişen Dosyalar:${NC}"
echo ""

STATUS=$(git status --porcelain)

if [ -z "$STATUS" ]; then
    echo -e "${GREEN}✅ Hiç değişiklik yok (working tree clean)${NC}"
    echo ""
    exit 0
fi

# Kategorilere ayır
MODIFIED=$(echo "$STATUS" | grep "^ M" | wc -l)
ADDED=$(echo "$STATUS" | grep "^A " | wc -l)
DELETED=$(echo "$STATUS" | grep "^D " | wc -l)
UNTRACKED=$(echo "$STATUS" | grep "^??" | wc -l)
STAGED=$(echo "$STATUS" | grep "^M " | wc -l)

echo -e "${CYAN}Özet:${NC}"
[ $MODIFIED -gt 0 ] && echo -e "  ${YELLOW}📝 Modified: $MODIFIED${NC}"
[ $STAGED -gt 0 ] && echo -e "  ${GREEN}✓ Staged: $STAGED${NC}"
[ $ADDED -gt 0 ] && echo -e "  ${GREEN}+ Added: $ADDED${NC}"
[ $DELETED -gt 0 ] && echo -e "  ${RED}- Deleted: $DELETED${NC}"
[ $UNTRACKED -gt 0 ] && echo -e "  ${BLUE}? Untracked: $UNTRACKED${NC}"
echo ""

# 2. Dosya listesi
echo -e "${CYAN}Değişen Dosyalar:${NC}"
git status --short | sed 's/^/  /'
echo ""

# 3. Eğer tek dosya isteniyorsa
if [ "$MODE" != "--full" ] && [ "$MODE" != "--summary" ] && [ -f "$MODE" ]; then
    echo -e "${YELLOW}📄 Dosya: ${MODE}${NC}"
    echo ""
    git diff HEAD "$MODE" || git diff "$MODE" 2>/dev/null || echo "Değişiklik yok"
    exit 0
fi

# 4. Summary mode
if [ "$MODE" = "--summary" ]; then
    echo -e "${CYAN}💡 Tam değişiklikleri görmek için:${NC}"
    echo -e "   ${BLUE}git diff${NC}"
    echo -e "   ${BLUE}./scripts/show-local-changes.sh${NC}"
    echo ""
    exit 0
fi

# 5. Full mode - tüm değişiklikler
echo -e "${YELLOW}📊 Değişiklik Detayları:${NC}"
echo ""

# İstatistikler
git diff --stat HEAD 2>/dev/null || git diff --stat

echo ""
echo -e "${YELLOW}📝 Tam Değişiklikler:${NC}"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

# Tüm değişiklikleri göster (staged + unstaged)
git diff HEAD 2>/dev/null || git diff

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# 6. Yararlı bilgiler
echo -e "${CYAN}💡 Yararlı Komutlar:${NC}"
echo -e "   ${BLUE}git status${NC}                           # Kısa özet"
echo -e "   ${BLUE}git diff${NC}                             # Unstaged değişiklikler"
echo -e "   ${BLUE}git diff HEAD${NC}                        # Tüm değişiklikler"
echo -e "   ${BLUE}git diff <dosya>${NC}                     # Tek dosya"
echo -e "   ${BLUE}git add .${NC}                            # Tümünü stage'e al"
echo -e "   ${BLUE}git restore <dosya>${NC}                  # Değişiklikleri geri al"
echo ""

echo -e "${GREEN}✅ Rapor tamamlandı${NC}"
echo ""
