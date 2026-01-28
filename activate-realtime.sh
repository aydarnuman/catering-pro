#!/bin/bash

# =====================================================
# REALTIME AKTİVASYON SCRIPT
# =====================================================

echo "🔄 Realtime aktivasyonu başlıyor..."
echo ""

# 1. Environment kontrol
echo "1️⃣ Environment variables kontrol ediliyor..."
if grep -q "NEXT_PUBLIC_ENABLE_REALTIME=true" frontend/.env.local; then
    echo "   ✅ NEXT_PUBLIC_ENABLE_REALTIME=true"
else
    echo "   ❌ NEXT_PUBLIC_ENABLE_REALTIME bulunamadı"
    exit 1
fi

if grep -q "NEXT_PUBLIC_SUPABASE_URL" frontend/.env.local; then
    echo "   ✅ NEXT_PUBLIC_SUPABASE_URL var"
else
    echo "   ❌ NEXT_PUBLIC_SUPABASE_URL bulunamadı"
    exit 1
fi

if grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY" frontend/.env.local; then
    echo "   ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY var"
else
    echo "   ❌ NEXT_PUBLIC_SUPABASE_ANON_KEY bulunamadı"
    exit 1
fi

echo ""
echo "2️⃣ Supabase SQL setup gerekli!"
echo ""
echo "   📋 YAPILACAKLAR:"
echo "   1. https://vpobejfxqihvgsjwnyku.supabase.co adresine git"
echo "   2. SQL Editor'ü aç"
echo "   3. backend/supabase-realtime-setup.sql dosyasını çalıştır"
echo ""
read -p "   SQL script'i çalıştırdın mı? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "   ⚠️  SQL script'i çalıştırmadan devam edilemez"
    echo "   📖 Detaylı bilgi: REALTIME_SETUP.md"
    exit 1
fi

echo ""
echo "3️⃣ Frontend yeniden başlatılıyor..."
cd frontend

# Kill existing process
pkill -f "next dev" 2>/dev/null

# Start dev server
npm run dev &

echo ""
echo "✅ Realtime aktivasyonu tamamlandı!"
echo ""
echo "🎯 TEST ETİN:"
echo "   1. http://localhost:3000 adresine git"
echo "   2. Navbar'da yeşil 'Live' badge'i gör"
echo "   3. Console'da '[Realtime] ✅ Bağlantı kuruldu' mesajını gör"
echo ""
echo "📖 Detaylı dokümantasyon: REALTIME_SETUP.md"
echo ""
