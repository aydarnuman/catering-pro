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
2. `backend/src/migrations/` klasöründeki SQL dosyalarını sırayla çalıştırın

**Migration Listesi (54 dosya):**
- `001_initial_schema.sql` - Temel tablolar
- `002_seed_data.sql` - Başlangıç verileri
- `003_performance_indexes.sql` - Performans indexleri
- `004_invoices_schema.sql` - Fatura tabloları
- `005_sync_logs.sql` - Senkronizasyon logları
- `006_muhasebe_tables.sql` - Ana muhasebe şeması
- `007` - `043` - Modül tabloları ve güncellemeler
- `044_teklifler.sql` - Teklif hazırlama
- `045_ai_prompt_templates.sql` - AI prompt şablonları
- `046_ai_settings_improvements.sql` - AI ayarları
- `047_notlar_sistemi.sql` - Dashboard notları
- `048_firmalar.sql` - Firma yönetimi
- `049_ihale_sonuclari.sql` - İhale sonuçları
- `050_notifications.sql` - Bildirim sistemi
- `051_tender_content_documents.sql` - İçerik dökümanları
- `052_add_documents_updated_at.sql` - Döküman güncelleme
- `053_add_zeyilname_correction_columns.sql` - Zeyilname
- `054_tender_tracking.sql` - İhale takip listesi

**Detaylı liste:** `backend/src/migrations/README.md`

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
2. Ana tabloların oluştuğunu kontrol edin:

**İhale Modülü:**
- ✅ tenders - İhale kayıtları
- ✅ documents - Dökümanlar
- ✅ tender_tracking - Takip listesi
- ✅ teklifler - Teklif hazırlık

**Muhasebe Modülü:**
- ✅ cariler - Cari hesaplar
- ✅ invoices - Faturalar
- ✅ kasa_banka_hesaplari - Nakit hesaplar
- ✅ gelir_giderler - Gelir-gider

**Stok Modülü:**
- ✅ stok_kartlari - Stok kartları
- ✅ depolar - Depolar
- ✅ stok_hareketleri - Stok hareketleri

**HR Modülü:**
- ✅ personeller - Personel kayıtları
- ✅ bordro - Bordro kayıtları
- ✅ izin_talepleri - İzin talepleri

**Planlama Modülü:**
- ✅ receteler - Reçeteler
- ✅ menuler - Menüler
- ✅ projeler - Projeler

**Sistem:**
- ✅ users - Kullanıcılar
- ✅ notifications - Bildirimler
- ✅ ai_memory - AI hafızası

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
