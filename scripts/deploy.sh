#!/bin/bash
# =============================================================================
# CATERING PRO - TEK TUŞLA DEPLOY SCRİPTİ
# 
# Kullanım:
#   ./scripts/deploy.sh              # Frontend + Backend deploy
#   ./scripts/deploy.sh frontend     # Sadece frontend
#   ./scripts/deploy.sh backend      # Sadece backend
#   ./scripts/deploy.sh quick        # Sadece git pull (build yok)
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
NC='\033[0m'

# Parametre
DEPLOY_TYPE="${1:-all}"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           🚀 CATERING PRO DEPLOY SCRİPTİ                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Lokal kontroller
echo -e "${YELLOW}📋 Lokal kontroller...${NC}"

# Uncommitted changes var mı?
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}❌ Commit edilmemiş değişiklikler var!${NC}"
    git status --short
    echo ""
    read -p "Yine de devam etmek istiyor musun? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Deploy iptal edildi.${NC}"
        exit 1
    fi
fi

# API URL kontrolü
if [ -f "scripts/check-api-urls.sh" ]; then
    echo "   API URL kontrolü..."
    if ! ./scripts/check-api-urls.sh > /dev/null 2>&1; then
        echo -e "${RED}❌ Hardcoded API URL tespit edildi!${NC}"
        ./scripts/check-api-urls.sh
        exit 1
    fi
    echo -e "${GREEN}   ✅ API URL'leri doğru${NC}"
fi

# 2. Git push
echo ""
echo -e "${YELLOW}📤 GitHub'a push ediliyor...${NC}"
git push origin main
echo -e "${GREEN}✅ Push tamamlandı${NC}"

# 3. Sunucuya bağlan ve deploy
echo ""
echo -e "${YELLOW}🖥️  Sunucuya bağlanılıyor... (${SERVER_IP})${NC}"

case $DEPLOY_TYPE in
    "frontend")
        echo -e "${BLUE}📱 Sadece Frontend deploy ediliyor...${NC}"
        ssh -i $SSH_KEY ${SERVER_USER}@${SERVER_IP} "
            cd ${PROJECT_PATH}
            echo '📥 Git pull...'
            git stash 2>/dev/null || true
            git pull origin main
            
            echo '📦 Paketler kontrol ediliyor...'
            cd frontend
            npm install --silent
            
            echo '🔨 Frontend build...'
            rm -rf .next
            npm run build
            
            echo '🔄 PM2 restart...'
            pm2 restart catering-frontend || pm2 start ecosystem.config.js --only catering-frontend
            
            echo ''
            echo '✅ Frontend deploy tamamlandı!'
        "
        ;;
        
    "backend")
        echo -e "${BLUE}⚙️  Sadece Backend deploy ediliyor...${NC}"
        ssh -i $SSH_KEY ${SERVER_USER}@${SERVER_IP} "
            cd ${PROJECT_PATH}
            echo '📥 Git pull...'
            git stash 2>/dev/null || true
            git pull origin main
            
            echo '📦 Paketler kontrol ediliyor...'
            cd backend
            npm install --silent
            
            echo '🗄️  Migration kontrol ediliyor...'
            npm run migrate
            
            echo '🔄 PM2 restart...'
            pm2 restart catering-backend || pm2 start ecosystem.config.js --only catering-backend
            
            echo ''
            echo '✅ Backend deploy tamamlandı!'
        "
        ;;
        
    "quick")
        echo -e "${BLUE}⚡ Hızlı deploy (sadece git pull)...${NC}"
        ssh -i $SSH_KEY ${SERVER_USER}@${SERVER_IP} "
            cd ${PROJECT_PATH}
            echo '📥 Git pull...'
            git stash 2>/dev/null || true
            git pull origin main
            
            echo ''
            echo '✅ Hızlı deploy tamamlandı!'
            echo '⚠️  Not: Build yapılmadı, PM2 restart edilmedi'
        "
        ;;
        
    "all"|*)
        echo -e "${BLUE}🚀 Tam deploy (Frontend + Backend)...${NC}"
        ssh -i $SSH_KEY ${SERVER_USER}@${SERVER_IP} "
            cd ${PROJECT_PATH}
            echo '📥 Git pull...'
            git stash 2>/dev/null || true
            git pull origin main
            
            echo ''
            echo '📦 Backend paketleri kontrol ediliyor...'
            cd backend
            npm install --silent
            
            echo '🗄️  Migration kontrol ediliyor...'
            npm run migrate
            
            echo ''
            echo '📦 Frontend paketleri kontrol ediliyor...'
            cd ../frontend
            npm install --silent
            
            echo '🔨 Frontend build (tam temizlik)...'
            # Tüm cache'leri temizle
            rm -rf .next
            rm -rf node_modules/.cache
            # Environment variables'ı temizle (eski build cache'i için)
            unset NEXT_PUBLIC_API_URL
            npm run build
            
            echo ''
            echo '🔄 PM2 tam restart (stop/start)...'
            cd ..
            # PM2'yi tamamen durdur ve yeniden başlat (env cache'i temizlemek için)
            pm2 stop all || true
            pm2 delete all || true
            pm2 start ecosystem.config.js
            
            echo ''
            pm2 list
        "
        ;;
esac

# 4. Health check
echo ""
echo -e "${YELLOW}🏥 Health check...${NC}"
sleep 5

HEALTH=$(curl -s --connect-timeout 10 http://${SERVER_IP}/health 2>/dev/null || echo '{"status":"error"}')
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✅ Backend sağlıklı${NC}"
    # Memory ve uptime bilgilerini göster
    MEMORY=$(echo "$HEALTH" | grep -o '"heapUsed":[0-9]*' | cut -d':' -f2 || echo "N/A")
    UPTIME=$(echo "$HEALTH" | grep -o '"uptime":[0-9]*' | cut -d':' -f2 || echo "N/A")
    if [ "$MEMORY" != "N/A" ]; then
        echo -e "   ${BLUE}Memory: ${MEMORY}MB, Uptime: ${UPTIME}s${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Backend yanıt vermiyor, bekleyin...${NC}"
    sleep 5
    HEALTH=$(curl -s --connect-timeout 10 http://${SERVER_IP}/health 2>/dev/null || echo '{"status":"error"}')
    if echo "$HEALTH" | grep -q '"status":"ok"'; then
        echo -e "${GREEN}✅ Backend sağlıklı (2. deneme)${NC}"
    else
        echo -e "${RED}❌ Backend hala yanıt vermiyor!${NC}"
        echo -e "${YELLOW}💡 PM2 loglarını kontrol edin: pm2 logs${NC}"
    fi
fi

FRONTEND=$(curl -s --connect-timeout 10 -o /dev/null -w "%{http_code}" http://${SERVER_IP} 2>/dev/null || echo "000")
if [ "$FRONTEND" = "200" ]; then
    echo -e "${GREEN}✅ Frontend sağlıklı${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend yanıt vermiyor (HTTP: $FRONTEND)${NC}"
fi

# 5. Sonuç
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✅ DEPLOY TAMAMLANDI!                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "🌐 URL: ${BLUE}http://${SERVER_IP}${NC}"
echo ""
