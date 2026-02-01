# Migration Yönetim Rehberi

## 🎯 Genel Bakış

Bu projede iki migration sistemi bulunmaktadır:

1. **Supabase Migrations** (AKTİF) - `supabase/migrations/`
2. **Backend Migrations** (DEPRECATED) - `backend/src/migrations/`

> ⚠️ **ÖNEMLİ**: Yeni migration'lar SADECE Supabase CLI ile oluşturulmalıdır!

## 📋 Migration Durumu

| Metrik | Değer |
|--------|-------|
| Toplam Supabase Migration | 122 |
| Toplam Backend Migration | 113 |
| Son Migration | 120 (recete_maliyet_fiyat_duzeltmeleri) |
| Son Güncelleme | 2026-02-01 |

### Eksik Numaralar (Atlanmış)
- 014, 019 - Geliştirme sırasında silindi
- 069, 070, 071 - Birleştirildi
- 087 - Kullanılmadı

## 🔧 Yeni Migration Oluşturma

### 1. Supabase CLI Kullan

```bash
# Yeni migration oluştur
supabase migration new aciklayici_isim

# Örnek:
supabase migration new add_user_preferences
# Oluşturur: supabase/migrations/20260201143025_add_user_preferences.sql
```

### 2. Migration Dosyası Template

```sql
-- =====================================================
-- MIGRATION: [Açıklama]
-- Date: [YYYY-MM-DD]
-- Author: [İsim]
-- =====================================================

-- 1. YENİ TABLOLAR
CREATE TABLE IF NOT EXISTS yeni_tablo (
    id SERIAL PRIMARY KEY,
    -- kolonlar
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. İNDEKSLER
CREATE INDEX IF NOT EXISTS idx_yeni_tablo_kolon 
ON yeni_tablo(kolon);

-- 3. TRİGGER (varsa)
CREATE TRIGGER update_yeni_tablo_updated_at
BEFORE UPDATE ON yeni_tablo
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- Migration tamamlandı
-- =====================================================
```

### 3. Backend'e de Ekle (Sync için)

```bash
# Supabase'den backend'e kopyala
cp supabase/migrations/TIMESTAMP_isim.sql \
   backend/src/migrations/XXX_isim.sql
```

## 🚀 Migration Uygulama

### Production'a Deploy

```bash
# 1. Değişiklikleri önizle (DRY RUN)
supabase db push --dry-run

# 2. Production'a uygula
supabase db push

# 3. Doğrula
supabase migration list
```

### Local Test

```bash
# Local veritabanında test et
supabase db reset  # DİKKAT: Tüm veriyi siler!
```

## ⚠️ Kurallar

### YAPILMASI GEREKENLER

1. ✅ Her migration idempotent olmalı (`IF NOT EXISTS`, `IF EXISTS`)
2. ✅ Foreign key'lerde `ON DELETE CASCADE` veya `SET NULL` kullan
3. ✅ Büyük tablolarda index ekle
4. ✅ `updated_at` trigger'ı ekle
5. ✅ Migration'ı önce local'de test et

### YAPILMAMASI GEREKENLER

1. ❌ `DROP TABLE` kullanma (veri kaybı!)
2. ❌ Production'da direkt SQL çalıştırma
3. ❌ Migration dosyasını commit sonrası değiştirme
4. ❌ Aynı timestamp'i kullanma
5. ❌ Backend `migrate.js` kullanma (deprecated)

## 🔍 Troubleshooting

### Migration Çakışması

```bash
# Supabase migration history'yi kontrol et
supabase migration list

# Eğer "out of sync" hatası alırsan:
supabase migration repair --status applied TIMESTAMP
```

### Rollback

Supabase rollback desteklemez. Bunun yerine:

```sql
-- Yeni migration ile geri al
-- Örnek: drop_user_preferences.sql
DROP TABLE IF EXISTS user_preferences;
```

## 📁 Dosya Yapısı

```
supabase/migrations/
├── 20260128000001_*.sql     # Ocak 28 migrations
├── 20260129000001_*.sql     # Ocak 29 migrations
├── 20260130000001_*.sql     # Ocak 30 migrations
├── 20260131000112_*.sql     # Fiyat yönetimi migrations
└── 20260201xxxxx_*.sql      # Şubat migrations

backend/src/migrations/      # DEPRECATED - sadece referans için
├── 001_initial_schema.sql
├── ...
└── 119_daily_audit_system.sql
```

## 🔄 Sync Prosedürü

Her yeni migration için:

1. `supabase migration new isim` ile oluştur
2. SQL yaz ve test et
3. Backend'e numara ile kopyala (opsiyonel, sync için)
4. `supabase db push` ile deploy et
5. Git commit & push

---

Son Güncelleme: 2026-02-01
