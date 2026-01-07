# 🚀 SUPABASE KURULUM REHBERİ

## 1. Supabase Hesabı Oluşturma

1. [supabase.com](https://supabase.com) adresine gidin
2. "Start your project" butonuna tıklayın
3. GitHub ile giriş yapın
4. Yeni proje oluşturun:
   - Project Name: `catering-app`
   - Database Password: Güçlü bir şifre belirleyin (KAYDEDIN!)
   - Region: `Frankfurt (eu-central-1)` seçin (Türkiye'ye en yakın)

## 2. Gerekli Bilgileri Alma

Proje oluştuktan sonra:
1. Settings → API bölümüne gidin
2. Şu bilgileri kopyalayın:
   - Project URL: `https://xxxxx.supabase.co`
   - Anon/Public Key: `eyJhbG...`
   - Service Role Key: `eyJhbG...` (GİZLİ - Backend için)

## 3. Environment Variables (.env)

Root dizinde `.env` dosyası oluşturun ve şu bilgileri ekleyin:

```env
# DATABASE - Supabase Connection
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# SUPABASE KEYS
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
SUPABASE_SERVICE_KEY=[YOUR-SERVICE-KEY]

# UYUMSOFT API (Mevcut)
UYUMSOFT_API_URL=https://efatura.uyumsoft.com.tr/api
UYUMSOFT_USERNAME=your_username
UYUMSOFT_PASSWORD=your_password

# APP CONFIG
NODE_ENV=development
PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 4. Database Migration

### A. Supabase Dashboard'dan (Kolay Yol):
1. Supabase Dashboard → SQL Editor
2. `backend/src/migrations/` klasöründeki SQL dosyalarını sırayla çalıştırın:
   - `001_initial_schema.sql`
   - `002_seed_data.sql`
   - `003_performance_indexes.sql`
   - `004_invoices_schema.sql`
   - `005_sync_logs.sql`
   - `006_muhasebe_tables.sql` ✨ (Yeni)

### B. Terminal'den (Profesyonel):
```bash
# Supabase CLI kurulum
npm install -g supabase

# Login
supabase login

# Projeyi bağla
supabase link --project-ref [YOUR-PROJECT-REF]

# Migration'ları çalıştır
supabase db push
```

## 5. NPM Paketlerini Kurma

### Frontend (Next.js):
```bash
cd frontend
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install @tanstack/react-query zustand
```

### Backend (Express):
```bash
cd backend
npm install @supabase/supabase-js
```

## 6. Test Etme

Migration'lar tamamlandıktan sonra:
1. Supabase Dashboard → Table Editor
2. Tabloların oluştuğunu kontrol edin:
   - ✅ tenders
   - ✅ invoices
   - ✅ cariler (Yeni)
   - ✅ stok_kartlari (Yeni)
   - ✅ personeller (Yeni)
   - ✅ gelir_giderler (Yeni)
   - ✅ kasa_banka_hesaplari (Yeni)
   - ✅ satin_alma_talepleri (Yeni)

## 7. Güvenlik Ayarları

1. Authentication → Settings:
   - Email Auth'u aktif edin
   - Magic Link'i aktif edin
   
2. Authentication → URL Configuration:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/*`

## 8. Realtime Özellikleri (Opsiyonel)

Dashboard → Database → Replication:
- `cariler` tablosunu aktif edin
- `stok_kartlari` tablosunu aktif edin
- `gelir_giderler` tablosunu aktif edin

## 🎉 Kurulum Tamamlandı!

Artık Supabase hazır. Sonraki adım: Backend ve Frontend bağlantılarını yapmak.
