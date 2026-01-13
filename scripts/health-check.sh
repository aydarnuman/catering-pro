#!/bin/bash
# =============================================================================
# CATERING PRO - SUNUCU SAĞLIK KONTROLÜ
# 
# Kullanım:
#   ./scripts/health-check.sh         # Uzak sunucu kontrolü
#   ./scripts/health-check.sh local   # Lokal kontrol
# =============================================================================

# Yapılandırma
SERVER_IP="46.101.172.210"
LOCAL_BACKEND="http://localhost:3001"
LOCAL_FRONTEND="http://localhost:3000"

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MODE="${1:-remote}"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           🏥 CATERING PRO SAĞLIK KONTROLÜ                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$MODE" = "local" ]; then
    BACKEND_URL="$LOCAL_BACKEND"
    FRONTEND_URL="$LOCAL_FRONTEND"
    echo -e "${YELLOW}📍 Lokal kontrol modu${NC}"
else
    BACKEND_URL="http://${SERVER_IP}"
    FRONTEND_URL="http://${SERVER_IP}"
    echo -e "${YELLOW}📍 Uzak sunucu: ${SERVER_IP}${NC}"
fi

echo ""

# 1. Backend Health
echo "1️⃣  Backend API Kontrolü..."
HEALTH=$(curl -s --connect-timeout 5 "${BACKEND_URL}/health" 2>/dev/null)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    DB_STATUS=$(echo "$HEALTH" | grep -o '"database":"[^"]*"' | cut -d'"' -f4)
    echo -e "   ${GREEN}✅ Backend: Çalışıyor${NC}"
    echo -e "   ${GREEN}✅ Database: ${DB_STATUS}${NC}"
else
    echo -e "   ${RED}❌ Backend: Yanıt vermiyor${NC}"
fi

# 2. Frontend
echo ""
echo "2️⃣  Frontend Kontrolü..."
FRONTEND_STATUS=$(curl -s --connect-timeout 5 -o /dev/null -w "%{http_code}" "${FRONTEND_URL}" 2>/dev/null || echo "000")
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "   ${GREEN}✅ Frontend: Çalışıyor (HTTP 200)${NC}"
else
    echo -e "   ${RED}❌ Frontend: HTTP ${FRONTEND_STATUS}${NC}"
fi

# 3. API Endpoints Test
echo ""
echo "3️⃣  API Endpoint Testleri..."

# Auth endpoint
AUTH=$(curl -s --connect-timeout 3 "${BACKEND_URL}/api/auth/me" 2>/dev/null)
if [ -n "$AUTH" ]; then
    echo -e "   ${GREEN}✅ /api/auth/me: Yanıt veriyor${NC}"
else
    echo -e "   ${YELLOW}⚠️  /api/auth/me: Yanıt yok${NC}"
fi

# Stats endpoint
STATS=$(curl -s --connect-timeout 3 "${BACKEND_URL}/api/stats" 2>/dev/null)
if echo "$STATS" | grep -q "success"; then
    echo -e "   ${GREEN}✅ /api/stats: Yanıt veriyor${NC}"
else
    echo -e "   ${YELLOW}⚠️  /api/stats: Yanıt yok${NC}"
fi

# Uzak sunucu ise PM2 ve sistem bilgisi
if [ "$MODE" != "local" ]; then
    echo ""
    echo "4️⃣  Sunucu Durumu..."
    
    ssh -i ~/.ssh/procheff_deploy -o ConnectTimeout=5 root@${SERVER_IP} "
        echo '   PM2 Durumu:'
        pm2 jlist 2>/dev/null | python3 -c \"
import sys, json
try:
    data = json.load(sys.stdin)
    for p in data:
        status = '✅' if p.get('pm2_env', {}).get('status') == 'online' else '❌'
        name = p.get('name', 'unknown')
        mem = p.get('monit', {}).get('memory', 0) / 1024 / 1024
        cpu = p.get('monit', {}).get('cpu', 0)
        print(f'      {status} {name}: {mem:.1f}MB RAM, {cpu}% CPU')
except:
    print('      Bilgi alınamadı')
\"
        
        echo ''
        echo '   Disk Kullanımı:'
        df -h / | tail -1 | awk '{print \"      \" \$3 \" / \" \$2 \" (\" \$5 \" kullanımda)\"}'
        
        echo ''
        echo '   RAM Kullanımı:'
        free -h | grep Mem | awk '{print \"      \" \$3 \" / \" \$2 \" kullanımda\"}'
    " 2>/dev/null || echo -e "   ${YELLOW}⚠️  SSH bağlantısı kurulamadı${NC}"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   Kontrol tamamlandı!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
