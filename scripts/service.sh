#!/bin/bash
# =============================================================================
# CATERING PRO - SERVİS YÖNETİM ARACI v2.0
# =============================================================================
#
# Kullanım:
#   ./service.sh               - Yardım mesajı
#   ./service.sh all           - Her şeyi başlat (orchestrator)
#   ./service.sh start         - Tüm servisleri başlat
#   ./service.sh stop          - Tüm servisleri durdur
#   ./service.sh restart       - Tüm servisleri yeniden başlat
#   ./service.sh status        - Servis durumlarını göster
#   ./service.sh health        - Detaylı health dashboard
#   ./service.sh logs          - Canlı log takibi
#   ./service.sh clean         - Cache ve eski logları temizle
#   ./service.sh backend       - Sadece backend'i yeniden başlat
#   ./service.sh frontend      - Sadece frontend'i yeniden başlat
#   ./service.sh check         - Environment kontrolü
#   ./service.sh scheduler     - Scheduler durumu
#   ./service.sh realtime      - Realtime durumu
#   ./service.sh docker        - Docker yönetimi
#
# =============================================================================

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# Proje dizini (symlink'i resolve ederek gerçek script konumunu bul)
SCRIPT_PATH="$0"
if [ -L "$SCRIPT_PATH" ]; then
    LINK_TARGET="$(readlink "$SCRIPT_PATH")"
    if [[ "$LINK_TARGET" != /* ]]; then
        LINK_TARGET="$(dirname "$SCRIPT_PATH")/$LINK_TARGET"
    fi
    SCRIPT_PATH="$LINK_TARGET"
fi
PROJECT_DIR="$(cd "$(dirname "$SCRIPT_PATH")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
WHATSAPP_DIR="$PROJECT_DIR/services/whatsapp"
LOG_DIR="$BACKEND_DIR/logs"
SCRIPTS_DIR="$PROJECT_DIR/scripts"

# Port tanımları
PORT_FRONTEND=3000
PORT_BACKEND=3001
PORT_WHATSAPP=3002
PORT_POSTGRES=5432

# =============================================================================
# YARDIMCI FONKSİYONLAR
# =============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}${BOLD}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}${BOLD}║           🍽️  CATERING PRO - SERVİS YÖNETİMİ v2.0          ║${NC}"
    echo -e "${CYAN}${BOLD}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_usage() {
    echo -e "${YELLOW}${BOLD}Kullanım:${NC}"
    echo "  ./service.sh <komut> [seçenekler]"
    echo ""
    echo -e "${YELLOW}${BOLD}Temel Komutlar:${NC}"
    echo -e "  ${GREEN}all${NC}         🚀 Her şeyi başlat (pre-flight + sıralı başlatma)"
    echo -e "  ${GREEN}start${NC}       ▶️  Tüm servisleri başlat"
    echo -e "  ${GREEN}stop${NC}        ⏹️  Tüm servisleri durdur"
    echo -e "  ${GREEN}restart${NC}     🔄 Tüm servisleri yeniden başlat"
    echo -e "  ${GREEN}status${NC}      📊 Servis durumlarını göster"
    echo ""
    echo -e "${YELLOW}${BOLD}Gelişmiş Komutlar:${NC}"
    echo -e "  ${CYAN}health${NC}      🏥 Detaylı health dashboard"
    echo -e "  ${CYAN}check${NC}       🔍 Environment kontrolü"
    echo -e "  ${CYAN}scheduler${NC}   ⏱️  Scheduler durumu"
    echo -e "  ${CYAN}realtime${NC}    📡 Realtime durumu"
    echo -e "  ${CYAN}docker${NC}      🐳 Docker yönetimi (alt komutlar mevcut)"
    echo ""
    echo -e "${YELLOW}${BOLD}Servis Komutları:${NC}"
    echo -e "  ${BLUE}backend${NC}     🔧 Sadece backend'i yeniden başlat"
    echo -e "  ${BLUE}frontend${NC}    🎨 Sadece frontend'i yeniden başlat"
    echo -e "  ${BLUE}logs${NC}        📋 Canlı log takibi (Ctrl+C ile çık)"
    echo -e "  ${BLUE}clean${NC}       🧹 Cache ve eski logları temizle"
    echo ""
    echo -e "${YELLOW}${BOLD}Docker Alt Komutları:${NC}"
    echo -e "  ${DIM}./service.sh docker status${NC}   Container durumu"
    echo -e "  ${DIM}./service.sh docker up${NC}       Compose up"
    echo -e "  ${DIM}./service.sh docker down${NC}     Compose down"
    echo -e "  ${DIM}./service.sh docker logs <name>${NC}  Container logları"
    echo ""
    echo -e "${YELLOW}${BOLD}Örnekler:${NC}"
    echo -e "  ${DIM}./service.sh all${NC}             # Her şeyi kontrol edip başlat"
    echo -e "  ${DIM}./service.sh health${NC}          # Detaylı health raporu"
    echo -e "  ${DIM}./service.sh docker logs postgres${NC}  # PostgreSQL logları"
    echo ""
}

kill_port() {
    local port=$1
    lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null
}

check_port() {
    local port=$1
    local name=$2
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo -e "  ${GREEN}●${NC} $name (port $port): ${GREEN}Aktif${NC} ${DIM}[PID: $pid]${NC}"
        return 0
    else
        echo -e "  ${RED}○${NC} $name (port $port): ${RED}Kapalı${NC}"
        return 1
    fi
}

health_check() {
    local url=$1
    local name=$2
    local response=$(curl -s --connect-timeout 3 "$url" 2>/dev/null)
    if [ -n "$response" ]; then
        echo -e "  ${GREEN}✅${NC} $name: ${GREEN}Yanıt veriyor${NC}"
        return 0
    else
        echo -e "  ${RED}❌${NC} $name: ${RED}Yanıt yok${NC}"
        return 1
    fi
}

check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js bulunamadı!${NC}"
        return 1
    fi
    return 0
}

check_docker_available() {
    if command -v docker &> /dev/null && docker info &> /dev/null 2>&1; then
        return 0
    fi
    return 1
}

# =============================================================================
# ANA FONKSİYONLAR
# =============================================================================

do_stop() {
    echo -e "${YELLOW}⏹️  Servisler durduruluyor...${NC}"

    # Node processlerini durdur
    pkill -f "node.*server.js" 2>/dev/null
    pkill -f "next dev" 2>/dev/null
    pkill -f "next-server" 2>/dev/null
    pkill -f "npm.*start" 2>/dev/null

    # Portları temizle
    kill_port $PORT_FRONTEND
    kill_port $PORT_BACKEND
    kill_port $PORT_WHATSAPP

    sleep 2
    echo -e "${GREEN}✅ Tüm servisler durduruldu${NC}"
}

do_start() {
    echo -e "${YELLOW}🚀 Servisler başlatılıyor...${NC}"
    echo ""

    # Önce mevcut processleri temizle
    kill_port $PORT_FRONTEND
    kill_port $PORT_BACKEND
    kill_port $PORT_WHATSAPP
    sleep 1

    # Backend başlat
    echo -e "  ${BLUE}⚙️  Backend başlatılıyor (port $PORT_BACKEND)...${NC}"
    cd "$BACKEND_DIR" && npm start > /dev/null 2>&1 &
    sleep 3

    # Frontend başlat
    echo -e "  ${BLUE}🎨 Frontend başlatılıyor (port $PORT_FRONTEND)...${NC}"
    cd "$FRONTEND_DIR" && npm run dev > /dev/null 2>&1 &
    sleep 3

    # WhatsApp servisi (varsa)
    if [ -d "$WHATSAPP_DIR" ]; then
        echo -e "  ${BLUE}📱 WhatsApp servisi başlatılıyor (port $PORT_WHATSAPP)...${NC}"
        cd "$WHATSAPP_DIR" && npm start > /dev/null 2>&1 &
        sleep 2
    fi

    echo ""
    echo -e "${GREEN}✅ Servisler başlatıldı!${NC}"
    echo ""
    echo -e "  🌐 Frontend: ${CYAN}http://localhost:$PORT_FRONTEND${NC}"
    echo -e "  🔧 Backend:  ${CYAN}http://localhost:$PORT_BACKEND${NC}"
    if [ -d "$WHATSAPP_DIR" ]; then
        echo -e "  📱 WhatsApp: ${CYAN}http://localhost:$PORT_WHATSAPP${NC}"
    fi
    echo ""
}

do_restart() {
    echo -e "${YELLOW}🔄 Servisler yeniden başlatılıyor...${NC}"
    do_stop
    sleep 2
    do_start
}

do_status() {
    echo -e "${YELLOW}${BOLD}📊 Servis Durumları${NC}"
    echo "────────────────────────────────────────"
    echo ""

    echo -e "${BLUE}${BOLD}Port Kontrolleri:${NC}"
    check_port $PORT_FRONTEND "Frontend"
    check_port $PORT_BACKEND "Backend"
    check_port $PORT_WHATSAPP "WhatsApp"
    check_port $PORT_POSTGRES "PostgreSQL"

    echo ""
    echo -e "${BLUE}${BOLD}Health Check:${NC}"
    health_check "http://localhost:$PORT_BACKEND/health" "Backend API"
    health_check "http://localhost:$PORT_FRONTEND" "Frontend"

    echo ""
    echo "────────────────────────────────────────"
}

do_logs() {
    local today=$(date +%Y-%m-%d)
    local log_file="$LOG_DIR/app-$today.log"

    if [ -f "$log_file" ]; then
        echo -e "${YELLOW}📋 Canlı log takibi (Ctrl+C ile çık)${NC}"
        echo "────────────────────────────────────────"
        tail -f "$log_file"
    else
        echo -e "${RED}❌ Log dosyası bulunamadı: $log_file${NC}"
        echo -e "${YELLOW}Mevcut log dosyaları:${NC}"
        ls -la "$LOG_DIR"/*.log 2>/dev/null | head -10
    fi
}

do_clean() {
    echo -e "${YELLOW}🧹 Temizlik başlıyor...${NC}"
    echo ""

    # 1. Next.js cache temizle
    echo -e "  ${BLUE}📦 Next.js cache temizleniyor...${NC}"
    rm -rf "$FRONTEND_DIR/.next/cache" 2>/dev/null
    echo -e "  ${GREEN}✅ Cache temizlendi${NC}"

    # 2. Eski logları temizle (7 günden eski)
    echo ""
    echo -e "  ${BLUE}📋 7 günden eski loglar temizleniyor...${NC}"
    local deleted=$(find "$LOG_DIR" -name "*.log" -mtime +7 -delete -print 2>/dev/null | wc -l)
    echo -e "  ${GREEN}✅ $deleted log dosyası silindi${NC}"

    # 3. Audit dosyalarını temizle
    echo ""
    echo -e "  ${BLUE}🔍 Audit cache temizleniyor...${NC}"
    rm -f "$LOG_DIR"/.*-audit.json 2>/dev/null
    echo -e "  ${GREEN}✅ Audit cache temizlendi${NC}"

    echo ""
    echo -e "${GREEN}✅ Temizlik tamamlandı!${NC}"
}

do_backend() {
    echo -e "${YELLOW}🔄 Backend yeniden başlatılıyor...${NC}"

    pkill -f "node.*server.js" 2>/dev/null
    kill_port $PORT_BACKEND
    sleep 2

    cd "$BACKEND_DIR" && npm start > /dev/null 2>&1 &
    sleep 3

    check_port $PORT_BACKEND "Backend"
}

do_frontend() {
    echo -e "${YELLOW}🔄 Frontend yeniden başlatılıyor...${NC}"

    pkill -f "next dev" 2>/dev/null
    pkill -f "next-server" 2>/dev/null
    kill_port $PORT_FRONTEND
    sleep 2

    cd "$FRONTEND_DIR" && npm run dev > /dev/null 2>&1 &
    sleep 3

    check_port $PORT_FRONTEND "Frontend"
}

# =============================================================================
# YENİ GELİŞMİŞ FONKSİYONLAR
# =============================================================================

do_all() {
    echo -e "${CYAN}${BOLD}🚀 HER ŞEYİ BAŞLAT - Orchestrator${NC}"
    echo "════════════════════════════════════════════════════════════"
    echo ""

    if ! check_node; then
        exit 1
    fi

    # Node.js orchestrator'ı çalıştır
    cd "$PROJECT_DIR" && node scripts/start-all.js --dev
}

do_check() {
    echo -e "${CYAN}${BOLD}🔍 Environment Kontrolü${NC}"
    echo "════════════════════════════════════════════════════════════"
    echo ""

    if ! check_node; then
        exit 1
    fi

    # Environment validator'ı çalıştır
    cd "$PROJECT_DIR" && node scripts/services/env-validator.js
}

do_health() {
    echo -e "${CYAN}${BOLD}🏥 Detaylı Health Dashboard${NC}"
    echo "════════════════════════════════════════════════════════════"
    echo ""

    if ! check_node; then
        exit 1
    fi

    # Health checker'ı çalıştır
    cd "$PROJECT_DIR" && node scripts/services/health-checker.js
}

do_scheduler() {
    echo -e "${CYAN}${BOLD}⏱️  Scheduler Durumu${NC}"
    echo "════════════════════════════════════════════════════════════"
    echo ""

    # Backend API'den scheduler durumunu al
    local response=$(curl -s --connect-timeout 5 "http://localhost:$PORT_BACKEND/api/system/schedulers" 2>/dev/null)

    if [ -z "$response" ]; then
        echo -e "${RED}❌ Backend'e bağlanılamadı${NC}"
        echo -e "${DIM}Backend'in çalıştığından emin olun: ./service.sh status${NC}"
        return 1
    fi

    # JSON'u güzel formatla (jq varsa)
    if command -v jq &> /dev/null; then
        echo "$response" | jq '.'
    else
        echo "$response"
    fi

    echo ""
    echo -e "${DIM}Detaylı bilgi için: curl http://localhost:$PORT_BACKEND/api/system/schedulers${NC}"
}

do_realtime() {
    echo -e "${CYAN}${BOLD}📡 Realtime Durumu${NC}"
    echo "════════════════════════════════════════════════════════════"
    echo ""

    if ! check_node; then
        exit 1
    fi

    # Realtime manager'ı çalıştır
    cd "$PROJECT_DIR" && node scripts/services/realtime-manager.js status

    echo ""

    # Backend API'den realtime durumunu al
    local response=$(curl -s --connect-timeout 5 "http://localhost:$PORT_BACKEND/api/system/realtime/status" 2>/dev/null)

    if [ -n "$response" ]; then
        echo -e "${BLUE}${BOLD}Backend Realtime Status:${NC}"
        if command -v jq &> /dev/null; then
            echo "$response" | jq '.'
        else
            echo "$response"
        fi
    fi
}

# =============================================================================
# DOCKER FONKSİYONLARI
# =============================================================================

do_docker() {
    local subcommand=$1
    shift

    if ! check_docker_available; then
        echo -e "${RED}❌ Docker kullanılamıyor${NC}"
        echo -e "${DIM}Docker Desktop'ın kurulu ve çalışır durumda olduğundan emin olun${NC}"
        return 1
    fi

    case "$subcommand" in
        status|"")
            do_docker_status
            ;;
        up)
            do_docker_up "$@"
            ;;
        down)
            do_docker_down "$@"
            ;;
        restart)
            do_docker_restart "$@"
            ;;
        logs)
            do_docker_logs "$@"
            ;;
        *)
            echo -e "${YELLOW}${BOLD}Docker Alt Komutları:${NC}"
            echo "  status    Container durumu"
            echo "  up        Compose up"
            echo "  down      Compose down"
            echo "  restart   Compose restart"
            echo "  logs      Container logları"
            echo ""
            echo -e "${DIM}Örnek: ./service.sh docker logs postgres${NC}"
            ;;
    esac
}

do_docker_status() {
    echo -e "${CYAN}${BOLD}🐳 Docker Container Durumu${NC}"
    echo "════════════════════════════════════════════════════════════"
    echo ""

    # Docker version
    echo -e "${BLUE}Docker Version:${NC}"
    docker --version
    echo ""

    # Catering containers
    echo -e "${BLUE}Catering Containers:${NC}"
    docker ps -a --filter "name=catering_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

    if [ $(docker ps -a --filter "name=catering_" -q | wc -l) -eq 0 ]; then
        echo -e "${DIM}  Hiç container bulunamadı${NC}"
        echo -e "${DIM}  Başlatmak için: ./service.sh docker up${NC}"
    fi
}

do_docker_up() {
    echo -e "${YELLOW}🐳 Docker Compose başlatılıyor...${NC}"
    cd "$PROJECT_DIR" && docker-compose up -d "$@"
    echo ""
    do_docker_status
}

do_docker_down() {
    echo -e "${YELLOW}🐳 Docker Compose durduruluyor...${NC}"
    cd "$PROJECT_DIR" && docker-compose down "$@"
}

do_docker_restart() {
    echo -e "${YELLOW}🐳 Docker Compose yeniden başlatılıyor...${NC}"
    cd "$PROJECT_DIR" && docker-compose restart "$@"
    echo ""
    do_docker_status
}

do_docker_logs() {
    local container=$1
    local lines=${2:-100}

    if [ -z "$container" ]; then
        echo -e "${RED}❌ Container adı belirtilmedi${NC}"
        echo -e "${DIM}Kullanım: ./service.sh docker logs <container-name>${NC}"
        echo ""
        echo -e "${BLUE}Mevcut containerlar:${NC}"
        docker ps -a --filter "name=catering_" --format "  {{.Names}}"
        return 1
    fi

    # catering_ prefix ekle (yoksa)
    if [[ ! "$container" == catering_* ]]; then
        container="catering_$container"
    fi

    echo -e "${YELLOW}📋 $container logları (son $lines satır):${NC}"
    echo "────────────────────────────────────────"
    docker logs --tail "$lines" "$container" 2>&1
}

# =============================================================================
# ANA PROGRAM
# =============================================================================

print_header

case "$1" in
    all)
        do_all
        ;;
    start)
        do_start
        ;;
    stop)
        do_stop
        ;;
    restart)
        do_restart
        ;;
    status)
        do_status
        ;;
    health)
        do_health
        ;;
    logs)
        do_logs
        ;;
    clean)
        do_clean
        ;;
    backend)
        do_backend
        ;;
    frontend)
        do_frontend
        ;;
    check)
        do_check
        ;;
    scheduler)
        do_scheduler
        ;;
    realtime)
        do_realtime
        ;;
    docker)
        shift
        do_docker "$@"
        ;;
    help|--help|-h)
        print_usage
        ;;
    *)
        print_usage
        ;;
esac
