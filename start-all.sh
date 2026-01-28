#!/bin/bash
# =============================================================================
# CATERING PRO - UNIFIED START SCRIPT
# =============================================================================
#
# Tüm servisleri tek komutla başlatır
#
# Kullanım:
#   ./start-all.sh          # Development modu
#   ./start-all.sh --dev    # Development modu (açık)
#   ./start-all.sh --prod   # Production modu (PM2)
#   ./start-all.sh --docker # Docker modu
#
# =============================================================================

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Proje dizini
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Banner
echo ""
echo -e "${CYAN}${BOLD}"
echo "   ____      _            _               ____"
echo "  / ___|__ _| |_ ___ _ __(_)_ __   __ _  |  _ \\ _ __ ___"
echo " | |   / _\` | __/ _ \\ '__| | '_ \\ / _\` | | |_) | '__/ _ \\"
echo " | |__| (_| | ||  __/ |  | | | | | (_| | |  __/| | | (_) |"
echo "  \\____\\__,_|\\__\\___|_|  |_|_| |_|\\__, | |_|   |_|  \\___/"
echo "                                  |___/"
echo -e "${NC}"
echo -e "  ${BLUE}Kapsamlı Catering Yönetim Sistemi${NC}"
echo ""

# Node.js kontrolü
check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js bulunamadı!${NC}"
        echo "Node.js kurulumu gerekli: https://nodejs.org"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'.' -f1 | tr -d 'v')
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${RED}❌ Node.js 18+ gerekli. Mevcut: $(node -v)${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Node.js $(node -v)${NC}"
}

# Mode belirleme
MODE="dev"
EXTRA_ARGS=""

for arg in "$@"; do
    case $arg in
        --dev)
            MODE="dev"
            ;;
        --prod)
            MODE="prod"
            ;;
        --docker)
            MODE="docker"
            ;;
        --verbose|-v)
            EXTRA_ARGS="$EXTRA_ARGS --verbose"
            ;;
        --skip-env)
            EXTRA_ARGS="$EXTRA_ARGS --skip-env"
            ;;
        --skip-docker)
            EXTRA_ARGS="$EXTRA_ARGS --skip-docker"
            ;;
        --help|-h)
            echo -e "${BOLD}Kullanım:${NC}"
            echo "  ./start-all.sh [mod] [seçenekler]"
            echo ""
            echo -e "${BOLD}Modlar:${NC}"
            echo "  --dev      Development modu (varsayılan)"
            echo "  --prod     Production modu (PM2)"
            echo "  --docker   Docker modu"
            echo ""
            echo -e "${BOLD}Seçenekler:${NC}"
            echo "  --verbose, -v    Detaylı çıktı"
            echo "  --skip-env       Environment kontrolünü atla"
            echo "  --skip-docker    Docker'ı atla"
            echo "  --help, -h       Bu yardım mesajı"
            exit 0
            ;;
    esac
done

# Node.js kontrolü
check_node

echo -e "${CYAN}Mode: ${BOLD}${MODE^^}${NC}"
echo ""

# Mode'a göre çalıştır
case $MODE in
    dev)
        echo -e "${YELLOW}🔧 Development modu başlatılıyor...${NC}"
        cd "$PROJECT_DIR" && node scripts/start-all.js --dev $EXTRA_ARGS
        ;;
    prod)
        echo -e "${YELLOW}🚀 Production modu başlatılıyor (PM2)...${NC}"

        # PM2 kontrolü
        if ! command -v pm2 &> /dev/null; then
            echo -e "${RED}❌ PM2 bulunamadı!${NC}"
            echo "Kurmak için: npm install -g pm2"
            exit 1
        fi

        # Pre-flight check
        cd "$PROJECT_DIR" && node scripts/services/orchestrator.js preflight $EXTRA_ARGS

        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Pre-flight kontrolleri başarısız!${NC}"
            exit 1
        fi

        # PM2 ile başlat
        pm2 start ecosystem.config.js

        echo ""
        echo -e "${GREEN}✅ Production servisleri başlatıldı!${NC}"
        echo ""
        echo -e "  🌐 Frontend: ${CYAN}http://localhost:3000${NC}"
        echo -e "  🔧 Backend:  ${CYAN}http://localhost:3001${NC}"
        echo ""
        echo -e "  PM2 durumu: ${BLUE}pm2 status${NC}"
        echo -e "  PM2 loglar: ${BLUE}pm2 logs${NC}"
        ;;
    docker)
        echo -e "${YELLOW}🐳 Docker modu başlatılıyor...${NC}"

        # Docker kontrolü
        if ! command -v docker &> /dev/null; then
            echo -e "${RED}❌ Docker bulunamadı!${NC}"
            echo "Docker Desktop kurulumu gerekli"
            exit 1
        fi

        # Docker daemon kontrolü
        if ! docker info &> /dev/null; then
            echo -e "${RED}❌ Docker daemon çalışmıyor!${NC}"
            echo "Docker Desktop'ı başlatın"
            exit 1
        fi

        echo -e "${BLUE}📦 Docker container'ları başlatılıyor...${NC}"
        cd "$PROJECT_DIR" && docker-compose up -d

        # Node servisleri başlat
        echo ""
        echo -e "${BLUE}📦 Node servisleri başlatılıyor...${NC}"
        cd "$PROJECT_DIR" && node scripts/start-all.js --docker $EXTRA_ARGS
        ;;
esac
