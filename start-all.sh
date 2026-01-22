#!/bin/bash

echo "🚀 Catering Pro Servisleri Başlatılıyor..."

# Eski processleri temizle
echo "⏳ Eski processler temizleniyor..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:3002 | xargs kill -9 2>/dev/null
sleep 2

# WhatsApp Servisi
echo "📱 WhatsApp servisi başlatılıyor (port 3002)..."
cd /Users/numanaydar/Desktop/CATERİNG/services/whatsapp && npm start > /dev/null 2>&1 &
sleep 3

# Backend
echo "⚙️  Backend başlatılıyor (port 3001)..."
cd /Users/numanaydar/Desktop/CATERİNG/backend && npm start > /dev/null 2>&1 &
sleep 3

# Frontend
echo "🎨 Frontend başlatılıyor (port 3000)..."
cd /Users/numanaydar/Desktop/CATERİNG/frontend && npm run dev > /dev/null 2>&1 &
sleep 5

# Durum kontrolü
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Servis Durumları:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# WhatsApp
WA_STATUS=$(curl -s http://localhost:3002/status 2>/dev/null)
if [ -n "$WA_STATUS" ]; then
    echo "✅ WhatsApp (3002): Çalışıyor"
else
    echo "❌ WhatsApp (3002): Başlatılamadı"
fi

# Backend
BE_STATUS=$(curl -s http://localhost:3001/api/social/whatsapp/status 2>/dev/null)
if [ -n "$BE_STATUS" ]; then
    echo "✅ Backend  (3001): Çalışıyor"
else
    echo "❌ Backend  (3001): Başlatılamadı"
fi

# Frontend
FE_STATUS=$(curl -s http://localhost:3000 2>/dev/null)
if [ -n "$FE_STATUS" ]; then
    echo "✅ Frontend (3000): Çalışıyor"
else
    echo "⏳ Frontend (3000): Başlatılıyor..."
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Uygulama: http://localhost:3000"
echo ""
