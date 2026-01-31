#!/bin/bash
# =============================================================================
# CATERING PRO - SUNUCUDAN LOCAL'E PULL SCRİPTİ
# 
# Kullanım:
#   ./scripts/pull-from-server.sh              # Tüm değişiklikleri çek
#   ./scripts/pull-from-server.sh --git-only   # Sadece git değişiklikleri
#   ./scripts/pull-from-server.sh --check      # Sadece kontrol et (pull yapma)
# 
# Bu script sunucuda yapılmış değişiklikleri lokal ortama getirir.
# =============================================================================

set -e

# Yapılandırma
SERVER_IP="46.101.172.210"
SERVER_USER="root"
SSH_KEY="~/.ssh/procheff_deploy"
PROJECT_PATH="/root/catering-pro"

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parametreler
MODE="full"
if [ "$1" = "--git-only" ]; then
    MODE="git-only"
elif [ "$1" = "--check" ]; then
    MODE="check"
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        📥 SUNUCUDAN LOCAL'E PULL SCRİPTİ                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Lokal durum kontrolü
echo -e "${YELLOW}📋 Lokal durum kontrol ediliyor...${NC}"

if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}❌ Lokal değişiklikler var! Önce commit veya stash yapın.${NC}"
    git status --short
    echo ""
    if [ "$MODE" != "check" ]; then
        read -p "Lokal değişiklikleri stash yapıp devam etmek istiyor musun? (y/N) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}📦 Lokal değişiklikler stash'leniyor...${NC}"
            git stash push -m "Auto stash before pull from server - $(date '+%Y-%m-%d %H:%M:%S')"
            echo -e "${GREEN}✅ Stash tamamlandı${NC}"
        else
            echo -e "${RED}Pull iptal edildi.${NC}"
            exit 1
        fi
    else
        exit 1
    fi
fi

CURRENT_BRANCH=$(git branch --show-current)
echo -e "${CYAN}   📍 Mevcut branch: ${CURRENT_BRANCH}${NC}"

# 2. Sunucu durumunu kontrol et
echo ""
echo -e "${YELLOW}🔍 Sunucu durumu kontrol ediliyor...${NC}"

SERVER_STATUS=$(ssh -i $SSH_KEY ${SERVER_USER}@${SERVER_IP} "
    cd ${PROJECT_PATH}
    
    echo '=== GIT STATUS ==='
    git status --porcelain
    echo '=== GIT BRANCH ==='
    git branch --show-current
    echo '=== GIT LOG ==='
    git log -3 --oneline
    echo '=== ENV CHECK ==='
    ls -la backend/.env 2>/dev/null || echo 'NO_ENV_FILE'
    echo '=== DONE ==='
" 2>/dev/null)

if [ -z "$SERVER_STATUS" ]; then
    echo -e "${RED}❌ Sunucuya bağlanılamadı!${NC}"
    echo -e "${YELLOW}💡 SSH key kontrolü: ~/.ssh/procheff_deploy${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Sunucuya bağlanıldı${NC}"

# Parse server info
SERVER_BRANCH=$(echo "$SERVER_STATUS" | sed -n '/=== GIT BRANCH ===/,/=== GIT LOG ===/p' | grep -v "===" | head -1)
echo -e "${CYAN}   📍 Sunucu branch: ${SERVER_BRANCH}${NC}"

# Check for uncommitted changes on server
UNCOMMITTED=$(echo "$SERVER_STATUS" | sed -n '/=== GIT STATUS ===/,/=== GIT BRANCH ===/p' | grep -v "===")
if [ -n "$UNCOMMITTED" ]; then
    echo -e "${YELLOW}⚠️  Sunucuda commit edilmemiş değişiklikler var:${NC}"
    echo "$UNCOMMITTED" | head -10
    echo ""
fi

# Show recent commits
echo -e "${CYAN}📜 Sunucudaki son commitler:${NC}"
echo "$SERVER_STATUS" | sed -n '/=== GIT LOG ===/,/=== ENV CHECK ===/p' | grep -v "===" | sed 's/^/   /'

# 3. Check mode - sadece kontrol
if [ "$MODE" = "check" ]; then
    echo ""
    echo -e "${BLUE}✅ Kontrol tamamlandı (--check modu)${NC}"
    echo -e "${CYAN}💡 Pull yapmak için: ./scripts/pull-from-server.sh${NC}"
    exit 0
fi

# 4. Branch kontrolü
echo ""
if [ "$CURRENT_BRANCH" != "$SERVER_BRANCH" ]; then
    echo -e "${YELLOW}⚠️  Branch farkı tespit edildi!${NC}"
    echo -e "   Lokal: ${CURRENT_BRANCH}"
    echo -e "   Sunucu: ${SERVER_BRANCH}"
    echo ""
    read -p "Sunucu branch'ine (${SERVER_BRANCH}) geçmek istiyor musun? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git checkout "$SERVER_BRANCH" 2>/dev/null || git checkout -b "$SERVER_BRANCH"
    fi
fi

# 5. Git pull
echo ""
echo -e "${YELLOW}📥 GitHub'dan son değişiklikler çekiliyor...${NC}"

# Önce remote'u güncelle
git fetch origin

# Sunucu branch'ini pull et
if git show-ref --verify --quiet "refs/remotes/origin/${SERVER_BRANCH}"; then
    echo -e "${CYAN}   Pulling origin/${SERVER_BRANCH}...${NC}"
    git pull origin "$SERVER_BRANCH"
    echo -e "${GREEN}✅ Git pull tamamlandı${NC}"
else
    echo -e "${YELLOW}⚠️  origin/${SERVER_BRANCH} bulunamadı, main branch pull ediliyor...${NC}"
    git pull origin main
fi

# 6. Full mode - env dosyalarını karşılaştır
if [ "$MODE" = "full" ]; then
    echo ""
    echo -e "${YELLOW}🔐 Environment dosyaları kontrol ediliyor...${NC}"
    
    # Backend .env
    echo -e "${CYAN}   Backend .env karşılaştırması...${NC}"
    SERVER_ENV=$(ssh -i $SSH_KEY ${SERVER_USER}@${SERVER_IP} "cat ${PROJECT_PATH}/backend/.env 2>/dev/null" | grep -v -E '^(DATABASE_URL|JWT_SECRET|CLAUDE_API_KEY|GEMINI_API_KEY|IHALEBUL_|UYUMSOFT_|SUPABASE_SERVICE_KEY)=' || true)
    
    if [ -n "$SERVER_ENV" ]; then
        if [ -f "backend/.env" ]; then
            echo "$SERVER_ENV" > /tmp/server_env_safe.txt
            LOCAL_ENV=$(cat backend/.env | grep -v -E '^(DATABASE_URL|JWT_SECRET|CLAUDE_API_KEY|GEMINI_API_KEY|IHALEBUL_|UYUMSOFT_|SUPABASE_SERVICE_KEY)=' || true)
            echo "$LOCAL_ENV" > /tmp/local_env_safe.txt
            
            if ! diff -q /tmp/server_env_safe.txt /tmp/local_env_safe.txt > /dev/null 2>&1; then
                echo -e "${YELLOW}   ⚠️  .env farkları var (hassas bilgiler hariç)${NC}"
                echo ""
                diff -u /tmp/local_env_safe.txt /tmp/server_env_safe.txt | tail -n +3 | head -20 || true
                echo ""
                echo -e "${CYAN}   💡 Manuel kontrol edin: backend/.env${NC}"
            else
                echo -e "${GREEN}   ✅ .env dosyaları uyumlu${NC}"
            fi
            
            rm -f /tmp/server_env_safe.txt /tmp/local_env_safe.txt
        else
            echo -e "${YELLOW}   ⚠️  Lokal .env dosyası yok${NC}"
            echo -e "${CYAN}   💡 .env.example'dan oluşturun${NC}"
        fi
    fi
    
    # Frontend .env.local
    echo -e "${CYAN}   Frontend .env.local karşılaştırması...${NC}"
    if [ -f "frontend/.env.local" ]; then
        echo -e "${GREEN}   ✅ .env.local mevcut${NC}"
    else
        echo -e "${YELLOW}   ⚠️  frontend/.env.local yok${NC}"
        echo -e "${CYAN}   💡 .env.example'dan oluşturun${NC}"
    fi
fi

# 7. Paket güncellemeleri
if [ "$MODE" = "full" ]; then
    echo ""
    echo -e "${YELLOW}📦 Paket güncellemeleri kontrol ediliyor...${NC}"
    
    # Backend
    if [ -f "backend/package.json" ]; then
        echo -e "${CYAN}   Backend npm install...${NC}"
        cd backend && npm install --silent && cd ..
        echo -e "${GREEN}   ✅ Backend paketleri güncellendi${NC}"
    fi
    
    # Frontend
    if [ -f "frontend/package.json" ]; then
        echo -e "${CYAN}   Frontend npm install...${NC}"
        cd frontend && npm install --silent && cd ..
        echo -e "${GREEN}   ✅ Frontend paketleri güncellendi${NC}"
    fi
fi

# 8. Özet
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✅ PULL TAMAMLANDI!                              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$MODE" = "git-only" ]; then
    echo -e "${CYAN}💡 Sadece git değişiklikleri çekildi${NC}"
    echo -e "${CYAN}   Paket güncellemeleri için: ./scripts/pull-from-server.sh${NC}"
else
    echo -e "${CYAN}📋 Sonraki adımlar:${NC}"
    echo -e "   1. Backend'i başlat: ${BLUE}cd backend && npm run dev${NC}"
    echo -e "   2. Frontend'i başlat: ${BLUE}cd frontend && npm run dev${NC}"
    echo -e "   3. Test et: ${BLUE}http://localhost:3000${NC}"
fi

# Stash var mı kontrol et
if git stash list | grep -q "Auto stash before pull from server"; then
    echo ""
    echo -e "${YELLOW}⚠️  Auto-stash değişiklikleri var${NC}"
    echo -e "${CYAN}   Geri almak için: ${BLUE}git stash pop${NC}"
fi

echo ""
