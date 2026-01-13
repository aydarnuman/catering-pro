#!/bin/bash

# Catering Pro - Development Starter Script
# Bu script backend ve frontend'i ayrı terminallerde başlatır

echo "🚀 Catering Pro - Geliştirme Ortamı Başlatılıyor..."
echo ""

# Backend'i yeni terminal'de başlat
osascript -e 'tell application "Terminal"
    do script "cd '"$(pwd)"'/backend && echo \"🔧 Backend başlatılıyor (Port 3001)...\" && npm start"
end tell'

# 2 saniye bekle
sleep 2

# Frontend'i yeni terminal'de başlat
osascript -e 'tell application "Terminal"
    do script "cd '"$(pwd)"'/frontend && echo \"🎨 Frontend başlatılıyor (Port 3000)...\" && npm run dev"
end tell'

echo "✅ Backend ve Frontend ayrı terminallerde başlatıldı!"
echo ""
echo "📱 Uygulamaya erişim:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:3001"
echo ""
echo "💡 Dudurmak için her terminal penceresinde Ctrl+C yapın"
