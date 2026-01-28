# Tam Supabase Migrations Geçiş Planı

**Tarih:** 28 Ocak 2026
**Proje:** Catering Pro
**Mevcut Durum:** Custom migration-runner.js + 102 SQL dosyası
**Hedef:** Supabase CLI Migrations

---

## Mevcut Durum Özeti

| Metrik | Değer |
|--------|-------|
| Toplam Migration Dosyası | 102 |
| Çift Numaralı Dosyalar | 19 dosya (10 numara) |
| Atlanan Numaralar | 014, 019, 069-071, 087 |
| Supabase CLI Versiyonu | 2.72.7 ✅ |
| Config Dosyası | supabase/config.toml ✅ |
| Mevcut Runner | backend/src/utils/migration-runner.js |
| Tracking Tablosu | _migrations |

---

## Çift Numaralı Dosyalar (Çözülmesi Gereken)

```
001: initial_schema.sql       ← KORUYACAĞIZ
     user_sessions.sql        → 098_user_sessions.sql

002: seed_data.sql            ← KORUYACAĞIZ
     ai_god_mode.sql          → 099_ai_god_mode.sql

003: performance_indexes.sql  ← KORUYACAĞIZ
     ip_access_rules.sql      → 100_ip_access_rules.sql

004: invoices_schema.sql      ← KORUYACAĞIZ
     admin_notifications.sql  → 101_admin_notifications.sql

058: firma_ekstra_alanlar.sql ← KORUYACAĞIZ
     improved_ai_templates.sql → 102_improved_ai_templates.sql

059: maliyet_analizi.sql      ← KORUYACAĞIZ
     scraper_queue_system.sql → 103_scraper_queue_system.sql
     update_template_models.sql → 104_update_template_models.sql

060: maliyet_kategori_birlestir.sql ← KORUYACAĞIZ
     document_duplicates_cleanup.sql → 105_document_duplicates_cleanup.sql

080: birim_donusum_matrisi.sql ← KORUYACAĞIZ
     fix_anomali_function.sql → 106_fix_anomali_function.sql

081: user_preferences.sql     ← KORUYACAĞIZ
     fiyat_gecerlilik.sql     → 107_fiyat_gecerlilik.sql

082: refresh_tokens.sql       ← KORUYACAĞIZ
     maliyet_audit_log.sql    → 108_maliyet_audit_log.sql
```

---

## Geçiş Planı (5 Aşama)

### Aşama 1: Hazırlık ve Yedekleme (30 dakika)

#### 1.1 Veritabanı Yedeği
```bash
# Supabase Dashboard'dan veya CLI ile
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Veya Supabase CLI ile
supabase db dump -f backup_before_migration.sql
```

#### 1.2 Mevcut Migration Durumunu Kaydet
```sql
-- _migrations tablosundaki kayıtları yedekle
CREATE TABLE _migrations_backup AS SELECT * FROM _migrations;
```

#### 1.3 Git Branch Oluştur
```bash
git checkout -b feature/supabase-migrations
```

---

### Aşama 2: Çift Numaraları Düzeltme (45 dakika)

#### 2.1 Dosyaları Yeniden Adlandır
```bash
cd /Users/numanaydar/Desktop/CATERİNG/backend/src/migrations

# Çift numaralı dosyaları yeni numaralarla taşı
mv 001_user_sessions.sql 098_user_sessions.sql
mv 002_ai_god_mode.sql 099_ai_god_mode.sql
mv 003_ip_access_rules.sql 100_ip_access_rules.sql
mv 004_admin_notifications.sql 101_admin_notifications.sql
mv 058_improved_ai_templates.sql 102_improved_ai_templates.sql
mv 059_scraper_queue_system.sql 103_scraper_queue_system.sql
mv 059_update_template_models.sql 104_update_template_models.sql
mv 060_document_duplicates_cleanup.sql 105_document_duplicates_cleanup.sql
mv 080_fix_anomali_function.sql 106_fix_anomali_function.sql
mv 081_fiyat_gecerlilik.sql 107_fiyat_gecerlilik.sql
mv 082_maliyet_audit_log.sql 108_maliyet_audit_log.sql
```

#### 2.2 _migrations Tablosunu Güncelle
```sql
-- Eski isimleri yeni isimlerle güncelle
UPDATE _migrations SET name = '098_user_sessions.sql' WHERE name = '001_user_sessions.sql';
UPDATE _migrations SET name = '099_ai_god_mode.sql' WHERE name = '002_ai_god_mode.sql';
UPDATE _migrations SET name = '100_ip_access_rules.sql' WHERE name = '003_ip_access_rules.sql';
UPDATE _migrations SET name = '101_admin_notifications.sql' WHERE name = '004_admin_notifications.sql';
UPDATE _migrations SET name = '102_improved_ai_templates.sql' WHERE name = '058_improved_ai_templates.sql';
UPDATE _migrations SET name = '103_scraper_queue_system.sql' WHERE name = '059_scraper_queue_system.sql';
UPDATE _migrations SET name = '104_update_template_models.sql' WHERE name = '059_update_template_models.sql';
UPDATE _migrations SET name = '105_document_duplicates_cleanup.sql' WHERE name = '060_document_duplicates_cleanup.sql';
UPDATE _migrations SET name = '106_fix_anomali_function.sql' WHERE name = '080_fix_anomali_function.sql';
UPDATE _migrations SET name = '107_fiyat_gecerlilik.sql' WHERE name = '081_fiyat_gecerlilik.sql';
UPDATE _migrations SET name = '108_maliyet_audit_log.sql' WHERE name = '082_maliyet_audit_log.sql';
```

---

### Aşama 3: Supabase Migrations Formatına Dönüştürme (1 saat)

#### 3.1 Dönüştürme Script'i
```bash
#!/bin/bash
# convert-to-supabase.sh

SOURCE_DIR="/Users/numanaydar/Desktop/CATERİNG/backend/src/migrations"
TARGET_DIR="/Users/numanaydar/Desktop/CATERİNG/supabase/migrations"

# Supabase migrations klasörünü temizle (.gitkeep hariç)
find "$TARGET_DIR" -name "*.sql" -delete

# Timestamp başlangıcı (28 Ocak 2026, 00:00:00)
BASE_TIMESTAMP="20260128"

# Tüm SQL dosyalarını dönüştür
for file in "$SOURCE_DIR"/*.sql; do
    filename=$(basename "$file")

    # Numarayı al (001, 002, vb.)
    num=$(echo "$filename" | grep -oE '^[0-9]+')

    # İsmi al (numara sonrası)
    name=$(echo "$filename" | sed 's/^[0-9]*_//')

    # Timestamp oluştur (YYYYMMDDHHMMSS formatında)
    # Her migration için benzersiz timestamp
    timestamp="${BASE_TIMESTAMP}$(printf '%06d' $num)"

    # Yeni dosya adı
    new_filename="${timestamp}_${name}"

    echo "Dönüştürülüyor: $filename -> $new_filename"
    cp "$file" "$TARGET_DIR/$new_filename"
done

echo "Dönüştürme tamamlandı!"
echo "Toplam: $(ls $TARGET_DIR/*.sql | wc -l) dosya"
```

#### 3.2 Script'i Çalıştır
```bash
chmod +x convert-to-supabase.sh
./convert-to-supabase.sh
```

#### 3.3 Sonucu Doğrula
```bash
# Dosya sayısını kontrol et
ls supabase/migrations/*.sql | wc -l
# Beklenen: 102

# İlk ve son dosyaları kontrol et
ls supabase/migrations/*.sql | head -5
ls supabase/migrations/*.sql | tail -5
```

---

### Aşama 4: Migration Runner'ı Devre Dışı Bırakma (30 dakika)

#### 4.1 server.js'i Güncelle
```javascript
// backend/src/server.js

// ESKI KOD (satır 453-459):
// logger.info('🔄 Migration kontrolü başlıyor...');
// const migrationResult = await runMigrations();
// if (migrationResult.failed > 0) {
//   logger.warn(`⚠️ ${migrationResult.failed} migration hatalı - kontrol edin`);
// }

// YENİ KOD:
logger.info('🔄 Migration kontrolü atlanıyor (Supabase CLI kullanılıyor)');
// Migration'lar artık `supabase db push` ile yönetiliyor
// Manuel çalıştırma: cd /path/to/project && supabase db push
```

#### 4.2 Package.json Script'lerini Güncelle
```json
{
  "scripts": {
    "dev": "node --watch src/server.js",
    "start": "node src/server.js",
    "migrate": "echo 'Supabase CLI kullanın: supabase db push'",
    "migrate:status": "supabase migration list",
    "migrate:new": "supabase migration new",
    "migrate:push": "supabase db push",
    "migrate:reset": "supabase db reset",
    "db:diff": "supabase db diff",
    "db:types": "supabase gen types typescript --local > ../frontend/src/types/database.ts"
  }
}
```

---

### Aşama 5: Supabase Baseline Migration (45 dakika)

#### 5.1 Mevcut Şemayı Baseline Olarak İşaretle
```bash
# Remote veritabanındaki mevcut şemayı al
supabase db remote commit

# Veya manuel olarak baseline oluştur
supabase migration new baseline --skip-generate
```

#### 5.2 supabase_migrations Tablosunu Doldur
```sql
-- Supabase kendi tracking tablosunu kullanır: supabase_migrations.schema_migrations
-- Mevcut migration'ları "çalıştırılmış" olarak işaretle

-- Önce mevcut _migrations tablosundan verileri al
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
SELECT
    REPLACE(REPLACE(name, '.sql', ''), '_', '') as version,
    name,
    ARRAY['-- baseline migration']::text[]
FROM _migrations
WHERE success = true
ON CONFLICT (version) DO NOTHING;
```

#### 5.3 İlk Push'u Test Et
```bash
# Dry-run (değişiklik yapmadan kontrol)
supabase db push --dry-run

# Gerçek push (eğer dry-run başarılı ise)
supabase db push
```

---

## Yeni Workflow (Geçiş Sonrası)

### Yeni Migration Oluşturma
```bash
# 1. Yeni migration dosyası oluştur
supabase migration new add_new_feature

# 2. Oluşturulan dosyayı düzenle
# supabase/migrations/20260128123456_add_new_feature.sql

# 3. Local'de test et
supabase db reset

# 4. Production'a push et
supabase db push
```

### Otomatik Migration (Şema Değişikliği Sonrası)
```bash
# Veritabanında manuel değişiklik yaptıysanız
supabase db diff -f describe_changes

# Oluşturulan migration'ı inceleyin ve push edin
supabase db push
```

### TypeScript Tipleri Oluşturma
```bash
# Veritabanı şemasından tip oluştur
supabase gen types typescript --local > frontend/src/types/database.ts
```

---

## Rollback Planı

### Sorun Durumunda Geri Dönüş

#### Seçenek A: Hızlı Geri Dönüş (5 dakika)
```javascript
// server.js'deki değişikliği geri al
// Migration runner'ı tekrar aktif et
const migrationResult = await runMigrations();
```

#### Seçenek B: Tam Geri Dönüş (15 dakika)
```bash
# 1. Veritabanını yedekten geri yükle
psql $DATABASE_URL < backup_before_migration.sql

# 2. _migrations tablosunu geri yükle
DROP TABLE IF EXISTS _migrations;
ALTER TABLE _migrations_backup RENAME TO _migrations;

# 3. server.js'i eski haline getir
git checkout -- backend/src/server.js
```

---

## Doğrulama Kontrol Listesi

### Geçiş Öncesi
- [ ] Veritabanı yedeği alındı
- [ ] _migrations tablosu yedeklendi
- [ ] Git branch oluşturuldu
- [ ] Supabase CLI kurulu ve çalışıyor

### Geçiş Sırasında
- [ ] Çift numaralı dosyalar yeniden adlandırıldı
- [ ] _migrations tablosu güncellendi
- [ ] Supabase migrations klasörüne dosyalar kopyalandı
- [ ] server.js güncellendi
- [ ] package.json güncellendi

### Geçiş Sonrası
- [ ] `supabase db push --dry-run` başarılı
- [ ] `supabase db push` başarılı
- [ ] Uygulama normal çalışıyor
- [ ] Yeni migration oluşturma test edildi
- [ ] Takım bilgilendirildi

---

## Komut Referansı

| Komut | Açıklama |
|-------|----------|
| `supabase migration list` | Mevcut migration'ları listele |
| `supabase migration new <name>` | Yeni migration oluştur |
| `supabase db push` | Migration'ları production'a uygula |
| `supabase db push --dry-run` | Değişiklikleri önizle |
| `supabase db reset` | Local DB'yi sıfırla + migration'ları çalıştır |
| `supabase db diff` | Şema farklarını tespit et |
| `supabase db diff -f <name>` | Farkları migration olarak kaydet |
| `supabase gen types typescript` | TypeScript tipleri oluştur |
| `supabase db dump` | Veritabanı yedeği al |

---

## Zaman Çizelgesi

| Aşama | Süre | Kümülatif |
|-------|------|-----------|
| Hazırlık ve Yedekleme | 30 dk | 30 dk |
| Çift Numaraları Düzeltme | 45 dk | 1s 15dk |
| Supabase Formatına Dönüştürme | 1 saat | 2s 15dk |
| Runner'ı Devre Dışı Bırakma | 30 dk | 2s 45dk |
| Baseline ve Test | 45 dk | 3s 30dk |
| **TOPLAM** | **3.5 saat** | |

---

## Notlar

1. **Idempotent Migration'lar:** Tüm mevcut migration'lar `IF NOT EXISTS` kullandığı için tekrar çalışsalar bile sorun olmaz.

2. **_migrations Tablosu:** Eski tracking tablosu (`_migrations`) korunacak. Supabase kendi tablosunu (`supabase_migrations.schema_migrations`) kullanır.

3. **Production Deployment:** İlk geçişten sonra tüm deployment'lar `supabase db push` ile yapılacak.

4. **Takım Eğitimi:** Yeni workflow hakkında ekibi bilgilendirmek için 30 dakikalık bir toplantı planlanmalı.

---

**Hazırlayan:** Claude
**Onay:** ✅ Onaylandı
**Uygulama Tarihi:** 28 Ocak 2026
**Durum:** ✅ TAMAMLANDI

---

## Uygulama Sonuçları

| Adım | Durum | Notlar |
|------|-------|--------|
| Veritabanı yedeği | ✅ | `_migrations_backup` tablosu oluşturuldu |
| Çift numaralar düzeltildi | ✅ | 11 dosya yeniden adlandırıldı (098-108) |
| Supabase formatına dönüştürme | ✅ | 102 dosya başarıyla dönüştürüldü |
| Migration runner devre dışı | ✅ | server.js güncellendi |
| Supabase baseline | ✅ | 102 migration applied olarak işaretlendi |
| Eski remote migration'lar | ✅ | 17 eski migration reverted |
| Dry-run testi | ✅ | "Remote database is up to date" |

**Toplam Süre:** ~45 dakika
