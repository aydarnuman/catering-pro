# 🚀 STOK GÜVENLİK SİSTEMİ - SONRAKI ADIMLAR

## ✅ TAMAMLANAN İŞLER

- ✅ Mevcut sistem analizi tamamlandı
- ✅ Transaction helper utility hazırlandı
- ✅ Güvenli endpoint'ler kodlandı
- ✅ Database migration script'i hazırlandı
- ✅ Test senaryoları yazıldı
- ✅ Detaylı dökümantasyon oluşturuldu

---

## 📋 ŞİMDİ YAPILACAKLAR

### ADIM 1: VERİ KONTROLÜ (10 dakika)

Production veritabanınızda mevcut durumu kontrol edin.

#### 1.1. Supabase'e Bağlanın

```bash
# Terminal'de (Mac/Linux)
psql "postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"
```

**Bilgileri nereden bulacaksınız:**
1. Supabase Dashboard'a gidin: https://supabase.com/dashboard
2. Projenizi seçin
3. Sol menüden **"Database"** > **"Connection String"**
4. **"URI"** formatını kopyalayın
5. Şifreyi ekleyin

#### 1.2. Kontrol Scriptini Çalıştırın

```sql
-- Supabase SQL Editor'da VEYA Terminal'de
\i /Users/numanaydar/Desktop/CATERİNG/backend/src/scripts/check-stock-integrity.sql
```

**VEYA Web UI'dan:**
1. Supabase Dashboard > **SQL Editor**
2. **"New query"** butonuna tıklayın
3. `backend/src/scripts/check-stock-integrity.sql` dosyasının içeriğini kopyalayın
4. **"Run"** butonuna basın

#### 1.3. Sonuçları Kaydedin

Script çalıştıktan sonra şu bilgileri not edin:

```
□ Negatif stok sayısı: _____ adet
□ Orphan hareket sayısı: _____ adet
□ Yarım kalan fatura sayısı: _____ adet
□ Stok-hareket uyumsuzluğu: _____ adet
```

---

## 🔍 SONUÇLARA GÖRE KARAR

### Senaryo A: Hiç Sorun Yok ✅

**Sonuç:**
```
Negatif stok: 0
Orphan hareket: 0
Yarım fatura: 0
Uyumsuzluk: 0
```

**Aksiyon:**
✅ Harika! Verileriniz temiz, direkt migration'a geçebiliriz.

**Sonraki Adım:** [ADIM 2: Test Ortamında Deneme](#adim-2-test-ortamında-deneme)

---

### Senaryo B: Küçük Sorunlar Var ⚠️

**Sonuç:**
```
Negatif stok: 1-5 adet
Orphan hareket: 0-10 adet
Yarım fatura: 0
Uyumsuzluk: 1-5 adet
```

**Aksiyon:**
⚠️ Tolere edilebilir seviye. Migration çalıştırıldığında otomatik düzeltilecek.

**Detay:**
- Negatif stoklar → 0'a çekilecek, log'lanacak
- Orphan kayıtlar → Önemli değil (eski kayıtlar)
- Uyumsuzluklar → Manuel inceleme gerekebilir

**Sonraki Adım:** [ADIM 2: Test Ortamında Deneme](#adim-2-test-ortamında-deneme)

---

### Senaryo C: Ciddi Sorunlar Var 🔴

**Sonuç:**
```
Negatif stok: 10+ adet
Orphan hareket: 50+ adet
Yarım fatura: 5+ adet
Uyumsuzluk: 20+ adet
```

**Aksiyon:**
🔴 Veri tutarsızlığı var. Önce manuel temizlik gerekli.

**Detayları Görüntüleyin:**

```sql
-- Negatif stokları görüntüle
SELECT uk.kod, uk.ad, d.ad as depo, udd.miktar
FROM urun_depo_durumlari udd
JOIN urun_kartlari uk ON uk.id = udd.urun_kart_id
JOIN depolar d ON d.id = udd.depo_id
WHERE udd.miktar < 0
ORDER BY udd.miktar ASC;

-- Yarım kalan faturaları görüntüle
SELECT fsi.ettn, fsi.toplam_kalem, COUNT(uh.id) as kayitli_hareket
FROM fatura_stok_islem fsi
LEFT JOIN urun_hareketleri uh ON uh.fatura_ettn = fsi.ettn
GROUP BY fsi.id, fsi.ettn, fsi.toplam_kalem
HAVING fsi.toplam_kalem != COUNT(uh.id);
```

**Manuel Temizlik:**

```sql
-- 1. Negatif stokları 0'a çek (geçici)
UPDATE urun_depo_durumlari SET miktar = 0 WHERE miktar < 0;

-- 2. Orphan hareketleri kontrol et (silme, sadece bak)
SELECT * FROM urun_hareketleri
WHERE fatura_ettn IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM fatura_stok_islem WHERE ettn = urun_hareketleri.fatura_ettn
  )
LIMIT 10;
```

**Sonraki Adım:** Temizlik sonrası tekrar kontrol edin, sonra [ADIM 2](#adim-2-test-ortamında-deneme)

---

## ADIM 2: Test Ortamında Deneme (1-2 gün)

### 2.1. Test Ortamı Kurulumu

**Seçenek A: Supabase'de Yeni Proje**

1. Supabase'de yeni bir test projesi oluşturun
2. Production backup'ını test projesine yükleyin:

```bash
# Production'dan dump al
pg_dump "postgresql://production..." > prod_backup.sql

# Test ortamına yükle
psql "postgresql://test..." < prod_backup.sql
```

**Seçenek B: Local PostgreSQL**

```bash
# Docker ile PostgreSQL
docker run -d \
  --name test-catering-db \
  -e POSTGRES_PASSWORD=test123 \
  -e POSTGRES_DB=catering_test \
  -p 5433:5432 \
  postgres:15

# Backup'ı yükle
psql -h localhost -p 5433 -U postgres catering_test < prod_backup.sql
```

### 2.2. Migration Çalıştır

```bash
# Test DB'ye bağlan
psql "postgresql://test-db-url..."

# Migration çalıştır
\i /Users/numanaydar/Desktop/CATERİNG/backend/src/migrations/095_stock_safety_constraints.sql

# Sonuçları kontrol et
SELECT * FROM kontrol_stok_tutarliligi();
```

**Beklenen Sonuç:**
```
Migration 095 başlatılıyor
Negatif stok düzeltildi: X adet
Constraint eklendi: check_positive_miktar
Trigger eklendi: urun_depo_version_trigger
✅ MİGRATION 095 TAMAMLANDI
```

### 2.3. Backend'i Test Et

```bash
cd /Users/numanaydar/Desktop/CATERİNG/backend

# .env.test dosyası oluştur
cat > .env.test << EOF
DATABASE_URL=postgresql://test-db-url...
NODE_ENV=test
EOF

# Test ortamı için backend başlat
NODE_ENV=test npm run dev
```

### 2.4. Manuel Test Senaryoları

**Test 1: Transaction Rollback**

```bash
# Terminal'de
curl -X POST http://localhost:3001/api/stok/faturadan-giris-safe \
  -H "Content-Type: application/json" \
  -d '{
    "ettn": "TEST-FAIL-123",
    "depo_id": 1,
    "kalemler": [
      {"stok_kart_id": 1, "miktar": 10, "birim_fiyat": 5},
      {"stok_kart_id": 999999, "miktar": 5, "birim_fiyat": 3}
    ]
  }'
```

**Beklenen:** Hata mesajı, hiçbir kayıt eklenmemeli

**Test 2: Concurrency**

```bash
# İki terminal açın, aynı anda çalıştırın

# Terminal 1
curl -X POST http://localhost:3001/api/stok/hareketler/cikis-safe \
  -H "Content-Type: application/json" \
  -d '{"urun_kart_id": 1, "depo_id": 1, "miktar": 100}'

# Terminal 2 (aynı anda)
curl -X POST http://localhost:3001/api/stok/hareketler/cikis-safe \
  -H "Content-Type: application/json" \
  -d '{"urun_kart_id": 1, "depo_id": 1, "miktar": 100}'
```

**Beklenen:** Biri başarılı, biri "Yetersiz stok!" hatası

**Test 3: Negatif Stok Denemesi**

```bash
# SQL'de
UPDATE urun_depo_durumlari SET miktar = -100 WHERE id = 1;
```

**Beklenen:** `ERROR: check_positive_miktar constraint violated`

### 2.5. Otomatik Test

```bash
cd /Users/numanaydar/Desktop/CATERİNG/backend

# Test suite'i çalıştır
npm test -- stock-transaction.test.js

# Tüm testler geçmeli:
# ✅ Transaction rollback
# ✅ Concurrency protection
# ✅ Constraint validation
# ✅ Atomicity
# ✅ Version increment
```

---

## ADIM 3: Production Deployment (1 saat)

### 3.1. Hazırlık Checklist

```
□ Test ortamında tüm testler başarılı
□ Production backup alındı (SQL dump)
□ Deployment zamanı belirlendi (Cumartesi 03:00 önerilidir)
□ Rollback planı hazır
□ Monitoring kuruldu (pm2 logs)
□ Takım bilgilendirildi
```

### 3.2. Production Backup

```bash
# Supabase Dashboard'dan manuel backup
# VEYA SQL dump:

pg_dump "postgresql://production..." > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup'ı kontrol et
ls -lh backup_*.sql

# Backup'ı güvenli yere kopyala
cp backup_*.sql ~/Desktop/CATERING_BACKUPS/
```

### 3.3. Deployment Zamanlaması

**Önerilen Zaman:** Cumartesi 03:00-05:00

**Neden?**
- En düşük kullanıcı trafiği
- Sorun olursa sabaha kadar çözülebilir
- Hafta sonu, iş akışını etkilemez

### 3.4. Deployment Adımları

```bash
# 1. Sunucuya bağlan
ssh -i ~/.ssh/procheff_deploy root@46.101.172.210

# 2. Git pull
cd /root/catering-pro
git pull origin main

# 3. Database migration çalıştır
psql "$DATABASE_URL" < backend/src/migrations/095_stock_safety_constraints.sql

# 4. Backend restart
cd backend
npm install
pm2 restart catering-backend

# 5. Logları izle
pm2 logs catering-backend --lines 100
```

### 3.5. Smoke Test

```bash
# Health check
curl https://catering-tr.com/health

# Güvenli endpoint testi
curl -X POST https://catering-tr.com/api/stok/faturadan-giris-safe \
  -H "Content-Type: application/json" \
  -d '{"ettn":"","depo_id":1,"kalemler":[]}'

# Beklenen: 400 hata (validasyon) - bu normal!
```

### 3.6. İlk 24 Saat Monitoring

```sql
-- Her 2 saatte bir çalıştır
SELECT * FROM kontrol_stok_tutarliligi();

-- Hata loglarını kontrol et
SELECT * FROM sistem_log
WHERE seviye = 'ERROR'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

---

## 🆘 SORUN ÇÖZME

### Sorun 1: Migration Hatası

**Hata:** `ERROR: constraint "check_positive_miktar" already exists`

**Çözüm:**
```sql
-- Constraint'i kontrol et
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'urun_depo_durumlari';

-- Varsa devam et, yoksa tekrar ekle
```

### Sorun 2: Backend Başlamıyor

**Hata:** `Cannot find module '../utils/transaction.js'`

**Çözüm:**
```bash
# Dosyaların varlığını kontrol et
ls -la backend/src/utils/transaction.js

# Git pull yaptınız mı?
git status
git pull origin main

# npm install yaptınız mı?
npm install
```

### Sorun 3: Performans Düşüşü

**Belirti:** API yanıt süreleri 2x arttı

**Çözüm:**
```sql
-- Connection pool kontrolü
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Eğer 15+ ise pool size'ı artır
-- database.js: max: 20 → max: 30

-- Slow query'leri bul
SELECT query, mean_exec_time
FROM pg_stat_statements
WHERE query LIKE '%urun_depo%'
ORDER BY mean_exec_time DESC;
```

---

## 📞 İLETİŞİM

### Sorularınız için:

1. **Dökümantasyon:** `backend/STOCK_SAFETY_IMPLEMENTATION.md`
2. **Test sonuçları:** Terminal output'u paylaşın
3. **Hata logları:** `pm2 logs catering-backend`

### Acil Rollback Gerekirse:

```bash
# 1. Backend'i durdur
pm2 stop catering-backend

# 2. Backup'tan geri yükle
psql "$DATABASE_URL" < backup_YYYYMMDD_HHMMSS.sql

# 3. Git'te eski versiyona dön
git log --oneline | head -10
git checkout [ÖNCEKİ-COMMIT]

# 4. Backend başlat
pm2 start catering-backend
```

---

## ✅ ÖZET

**Şu an neredesiniz:**
✅ Tüm kodlar hazır
⏳ Veri kontrolü bekleniyor
⏳ Test ortamında deneme bekleniyor
⏳ Production deployment bekleniyor

**Hemen yapılacak:**
1️⃣ Veri kontrol scriptini çalıştırın (10 dk)
2️⃣ Sonuçları not edin
3️⃣ Bu dosyaya dönün ve senaryonuza göre ilerleyin

**İletişim:**
- Her adımda sonuçları paylaşın
- Sorun varsa hemen sorun
- Başarılı olunca bildirin! 🎉

---

Hazır mısınız? Veri kontrol scriptini çalıştırın! 🚀
