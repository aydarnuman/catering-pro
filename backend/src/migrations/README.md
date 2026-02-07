# Database Migrations Dokümantasyonu

## 🎯 Genel Bakış

Bu klasör veritabanı şema değişikliklerini versiyonlu SQL dosyaları olarak içerir. PostgreSQL (Supabase) kullanılır.

**Toplam Migration:** 102
**Son Güncelleme:** 28 Ocak 2026
**Migration Sistemi:** Supabase CLI (v2.72.7+)

> ⚠️ **ÖNEMLİ:** Migration'lar artık Supabase CLI ile yönetiliyor!
> - Eski `npm run migrate` komutu devre dışı
> - Yeni komutlar: `supabase migration new`, `supabase db push`

> **Eski tablolar (deprecated):** `invoice_items` ve `uyumsoft_invoice_items` artık uygulama kodunda kullanılmıyor. Yeni sistem tek kaynak: **fatura_kalemleri** tablosu ve `/api/fatura-kalemleri` API'si. 004_invoices_schema.sql ve 011_duplicate_detection.sql referans için duruyor; yeni geliştirme fatura_kalemleri kullanmalıdır.

---

## 📋 Migration Listesi

| No | Dosya | Açıklama |
|----|-------|----------|
| 001 | initial_schema.sql | Temel tablolar (tenders, documents, users) |
| 002 | seed_data.sql | Başlangıç verileri |
| 003 | performance_indexes.sql | Performans indexleri |
| 004 | invoices_schema.sql | Fatura tabloları |
| 005 | sync_logs.sql | Senkronizasyon logları |
| 006 | muhasebe_tables.sql | **Ana muhasebe şeması** (cariler, stok, personel, kasa-banka) |
| 007 | cari_hareketler.sql | Cari hareket detayları |
| 008 | etiketler.sql | Etiket sistemi |
| 009 | satin_alma.sql | Satın alma modülü |
| 010 | ai_memory.sql | AI konuşma hafızası |
| 011 | duplicate_detection.sql | Duplikat tespit sistemi |
| 012 | fix_database_issues.sql | Hata düzeltmeleri |
| 013 | fix_bakiye_trigger.sql | Bakiye trigger düzeltmesi |
| 015 | upgrade_stok_system.sql | Stok sistemi güncellemesi |
| 016 | add_kyk_depolar.sql | KYK depo ekleme |
| 017 | fix_stok_trigger.sql | Stok trigger düzeltmesi |
| 018 | depo_lokasyonlar.sql | Depo lokasyon sistemi |
| 020 | fatura_stok_islem.sql | Fatura-stok entegrasyonu |
| 021 | personel_projeler.sql | Personel-proje ilişkisi |
| 022 | bordro_sistemi.sql | Bordro temel yapısı |
| 023 | izin_ve_kidem.sql | İzin ve kıdem sistemi |
| 024 | demirbas_sistemi.sql | Demirbaş takibi |
| 025 | lokasyon_update.sql | Lokasyon güncellemesi |
| 026 | cek_senet_sistemi.sql | Çek/senet yönetimi |
| 027 | fatura_odeme_eslestirme.sql | Fatura-ödeme eşleştirme |
| 028 | bordro_proje.sql | Bordro-proje bağlantısı |
| 029 | gorevler.sql | Görev yönetimi |
| 030 | bordro_templates.sql | Bordro şablonları |
| 031 | fix_bordro_constraint.sql | Bordro constraint düzeltmesi |
| 032 | bordro_tahakkuk.sql | Tahakkuk sistemi |
| 033 | tazminat_sistemi.sql | Kıdem/ihbar tazminatı |
| 034 | bordro_maas.sql | Bordro maaş detayları |
| 035 | maas_odeme_sistemi.sql | Maaş ödeme takibi |
| 036 | proje_hareketler.sql | Proje hareket logları |
| 037 | proje_entegrasyonu.sql | Proje modül entegrasyonu |
| 038 | piyasa_fiyat.sql | Piyasa fiyat takibi |
| 039 | recete_menu_sistemi.sql | Reçete ve menü yapısı |
| 040 | sartname_gramaj_sistemi.sql | Gramaj şartname sistemi |
| 041 | sartname_basitlestirilmis.sql | Basitleştirilmiş şartname |
| 042 | kyk_receteler.sql | KYK özel reçeteleri |
| 043 | recete_proje_bazli.sql | Proje bazlı reçeteler |
| 044 | teklifler.sql | **Teklif hazırlama sistemi** |
| 045 | ai_prompt_templates.sql | AI prompt şablonları |
| 046 | ai_settings_improvements.sql | AI ayarları geliştirmeleri |
| 047 | notlar_sistemi.sql | Dashboard not sistemi |
| 048 | firmalar.sql | Firma yönetimi |
| 049 | ihale_sonuclari.sql | İhale sonuç kayıtları |
| 050 | notifications.sql | **Bildirim sistemi** |
| 051 | tender_content_documents.sql | İhale içerik dökümanları |
| 052 | add_documents_updated_at.sql | Döküman updated_at kolonu |
| 053 | add_zeyilname_correction_columns.sql | Zeyilname düzeltme kolonları |
| 054 | tender_tracking.sql | **İhale takip listesi** |

> Not: 014 ve 019 numaralar atlanmış (geliştirme sırasında silinmiş migration'lar)

---

## 🗃️ Ana Tablolar

### İhale Modülü
```sql
tenders                  -- İhale kayıtları
documents                -- İhale dökümanları
scraper_logs             -- Scraper logları
tender_content_documents -- İçerik dökümanları
tender_tracking          -- Takip listesi
teklifler                -- Teklif hazırlık
ihale_sonuclari          -- Sonuç kayıtları
```

### Muhasebe Modülü
```sql
cariler              -- Müşteri/Tedarikçi
cari_hareketleri     -- Cari hesap hareketleri
invoices             -- Faturalar (manuel)
fatura_kalemleri     -- Fatura kalemleri (tek kaynak; Uyumsoft e-fatura kalemleri)
uyumsoft_invoices    -- Uyumsoft e-faturalar
gelir_giderler       -- Gelir/gider kayıtları
firmalar             -- Firma tanımları
```
*(Eski: invoice_items, uyumsoft_invoice_items → deprecated, fatura_kalemleri kullanın.)*

### Stok Modülü
```sql
stok_kartlari        -- Ürün/malzeme kartları (legacy, urun_kartlari aktif)
stok_hareketleri     -- Stok giriş/çıkış
depolar              -- Depo tanımları
depo_lokasyonlar     -- Depo içi lokasyonlar
stok_depo_durumlari  -- Depo bazlı stok durumu
demirbas             -- Demirbaş takibi
```

### Personel/Bordro Modülü
```sql
personeller          -- Çalışan kayıtları
personel_odemeleri   -- Ödeme kayıtları
bordro               -- Aylık bordro
bordro_detay         -- Bordro kalemleri
izin_talepleri       -- İzin talepleri
tazminatlar          -- Kıdem/ihbar hesapları
```

### Finans Modülü
```sql
kasa_banka_hesaplari    -- Nakit hesaplar
kasa_banka_hareketleri  -- Para hareketleri
cek_senetler            -- Çek/senet takibi
```

### Planlama Modülü
```sql
receteler            -- Yemek reçeteleri
recete_malzemeleri   -- Reçete içerikleri
menuler              -- Günlük/haftalık menüler
menu_yemekler        -- Menü içerikleri
sartnameler          -- Gramaj şartnameleri
projeler             -- Müşteri projeleri
proje_personelleri   -- Proje atamaları
```

### Sistem Modülü
```sql
users                -- Kullanıcılar
notifications        -- Bildirimler
notlar               -- Dashboard notları
ai_memory            -- AI konuşma hafızası
ai_prompt_templates  -- AI prompt şablonları
ai_settings          -- AI ayarları
etiketler            -- Etiket sistemi
sync_logs            -- Senkronizasyon logları
```

---

## 🔧 Migration Çalıştırma (Supabase CLI)

```bash
# Migration durumunu kontrol et
supabase migration list

# Yeni migration oluştur
supabase migration new <isim>

# Migration'ları production'a uygula
supabase db push

# Değişiklikleri önizle (dry-run)
supabase db push --dry-run

# Veritabanı şemasından otomatik migration oluştur
supabase db diff -f <isim>

# TypeScript tipleri oluştur
supabase gen types typescript --local > ../frontend/src/types/database.ts
```

> **Not:** Eski `npm run migrate` komutu devre dışı bırakıldı. Yukarıdaki Supabase CLI komutlarını kullanın.

---

## 📝 Yeni Migration Oluşturma

### 1. Dosya Adı Formatı (Supabase CLI)
```
YYYYMMDDHHMMSS_aciklama.sql
```
- Supabase CLI otomatik timestamp ekler
- Örnek: `20260128143025_yeni_tablo.sql`

**Yeni migration oluşturmak için:**
```bash
supabase migration new yeni_tablo
# Oluşturur: supabase/migrations/20260128143025_yeni_tablo.sql
```

### 2. Dosya Template
```sql
-- ====================================================
-- MIGRATION: [Açıklama]
-- Tarih: [YYYY-MM-DD]
-- ====================================================

-- Yeni tablo
CREATE TABLE IF NOT EXISTS yeni_tablo (
    id SERIAL PRIMARY KEY,
    -- kolonlar...
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_yeni_tablo_kolon ON yeni_tablo(kolon);

-- Trigger (varsa)
CREATE TRIGGER update_yeni_tablo_updated_at 
    BEFORE UPDATE ON yeni_tablo
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ====================================================
-- Migration tamamlandı
-- ====================================================
```

### 3. Kurallar

1. **IF NOT EXISTS** kullan (idempotent olsun)
2. **Foreign key** tanımla: `ON DELETE CASCADE` veya `SET NULL`
3. **Index** ekle: Sık sorgulanan kolonlar
4. **Trigger** ekle: `updated_at` otomatik güncelleme
5. **Comment** ekle: Karmaşık yapılar için

---

## 🔗 Trigger'lar

### update_updated_at()
Tüm tablolarda `updated_at` kolonunu otomatik günceller.

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### update_stok_miktar()
Stok hareketi sonrası miktarı günceller.

### update_kasa_banka_bakiye()
Nakit hareketi sonrası bakiyeyi günceller.

### update_cari_bakiye()
Cari hareket sonrası bakiyeyi günceller.

---

## ⚠️ Dikkat Edilecekler

1. **Production'da dikkatli ol** - Geri alınamaz değişiklikler
2. **Backup al** - Büyük değişikliklerden önce
3. **Transaction kullan** - Birden fazla işlem varsa
4. **Test et** - Local'de test edip production'a al
5. **Drop kullanma** - Mümkünse `ALTER` tercih et

---

## 🧪 Test Migration

```bash
# Local test
docker-compose up -d
psql postgresql://postgres:postgres@localhost:5432/postgres -f src/migrations/XXX_test.sql

# Verify
psql postgresql://postgres:postgres@localhost:5432/postgres -c "\dt"
```
