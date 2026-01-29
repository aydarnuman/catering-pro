-- ====================================================
-- FİNANS MODÜLÜ - KAPSAMLI DÜZELTMELER
-- Migration: 20260130100000
-- ====================================================
-- Bu migration aşağıdaki sorunları çözer:
-- 1. Kasa/Banka ödemesi yapıldığında cari_hareketler'e kayıt ekleme
-- 2. kredi_karti hesap tipini ekleme
-- 3. Bakiye hesaplama tutarsızlıklarını düzeltme
-- 4. Çift kayıt (double-entry) muhasebe desteği
-- ====================================================

-- ====================================================
-- 1. HESAP TİPİNE KREDİ KARTI EKLE
-- ====================================================

-- Önce mevcut constraint'i kaldır
ALTER TABLE kasa_banka_hesaplari
DROP CONSTRAINT IF EXISTS kasa_banka_hesaplari_hesap_tipi_check;

-- Yeni constraint ekle (kredi_karti dahil)
ALTER TABLE kasa_banka_hesaplari
ADD CONSTRAINT kasa_banka_hesaplari_hesap_tipi_check
CHECK (hesap_tipi IN ('kasa', 'banka', 'kredi_karti'));

-- Kredi kartı için ek alanlar (nullable, mevcut kayıtları bozmaz)
ALTER TABLE kasa_banka_hesaplari
ADD COLUMN IF NOT EXISTS kart_limiti DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS hesap_kesim_gunu INTEGER CHECK (hesap_kesim_gunu BETWEEN 1 AND 31),
ADD COLUMN IF NOT EXISTS son_odeme_gunu INTEGER CHECK (son_odeme_gunu BETWEEN 1 AND 31);

COMMENT ON COLUMN kasa_banka_hesaplari.kart_limiti IS 'Kredi kartı için limit tutarı';
COMMENT ON COLUMN kasa_banka_hesaplari.hesap_kesim_gunu IS 'Kredi kartı hesap kesim günü';
COMMENT ON COLUMN kasa_banka_hesaplari.son_odeme_gunu IS 'Kredi kartı son ödeme günü';

-- ====================================================
-- 2. CARİ HAREKET TRIGGER'I - ÖDEME İÇİN
-- ====================================================

-- Fonksiyon: Kasa/Banka hareketi -> Cari hareket
CREATE OR REPLACE FUNCTION create_cari_hareket_from_kasa_banka()
RETURNS TRIGGER AS $$
DECLARE
    v_cari_tip VARCHAR(20);
    v_cari_unvan VARCHAR(255);
BEGIN
    -- Sadece cari_id varsa ve transfer değilse işle
    IF NEW.cari_id IS NULL OR NEW.hareket_tipi = 'transfer' THEN
        RETURN NEW;
    END IF;

    -- Cari bilgilerini al
    SELECT tip, unvan INTO v_cari_tip, v_cari_unvan
    FROM cariler
    WHERE id = NEW.cari_id;

    -- Cari yoksa çık
    IF v_cari_tip IS NULL THEN
        RETURN NEW;
    END IF;

    -- Cari hareket oluştur
    -- giris = tahsilat (müşteriden para geldi) -> alacak artar
    -- cikis = ödeme (tedarikçiye para gitti) -> borç artar
    INSERT INTO cari_hareketler (
        cari_id,
        hareket_tipi,
        belge_tipi,
        belge_no,
        belge_tarihi,
        borc,
        alacak,
        aciklama,
        odeme_id
    ) VALUES (
        NEW.cari_id,
        CASE
            WHEN NEW.hareket_tipi = 'giris' THEN 'tahsilat'
            ELSE 'odeme'
        END,
        'dekont',
        NEW.belge_no,
        NEW.tarih,
        -- Tedarikçiye ödeme yapıldığında (cikis) -> borcumuz azalır -> cari'de alacak yazılır
        -- Müşteriden tahsilat yapıldığında (giris) -> alacağımız azalır -> cari'de borç yazılır
        CASE WHEN NEW.hareket_tipi = 'giris' THEN NEW.tutar ELSE 0 END,  -- borç (tahsilat)
        CASE WHEN NEW.hareket_tipi = 'cikis' THEN NEW.tutar ELSE 0 END,  -- alacak (ödeme)
        COALESCE(NEW.aciklama,
            CASE
                WHEN NEW.hareket_tipi = 'giris' THEN 'Tahsilat - ' || TO_CHAR(NEW.tarih, 'DD.MM.YYYY')
                ELSE 'Ödeme - ' || TO_CHAR(NEW.tarih, 'DD.MM.YYYY')
            END
        ),
        NEW.id
    );

    -- Cari bakiyesini güncelle
    -- Tahsilat (giris): Müşteriden para aldık -> müşterinin borcu azaldı
    -- Ödeme (cikis): Tedarikçiye para verdik -> tedarikçiye olan borcumuz azaldı
    UPDATE cariler
    SET
        borc = borc + CASE WHEN NEW.hareket_tipi = 'giris' THEN NEW.tutar ELSE 0 END,
        alacak = alacak + CASE WHEN NEW.hareket_tipi = 'cikis' THEN NEW.tutar ELSE 0 END,
        -- bakiye = alacak - borc (GENERATED COLUMN - otomatik güncellenir)
        updated_at = NOW()
    WHERE id = NEW.cari_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Mevcut trigger varsa kaldır
DROP TRIGGER IF EXISTS trigger_kasa_banka_to_cari_hareket ON kasa_banka_hareketleri;

-- Yeni trigger oluştur
CREATE TRIGGER trigger_kasa_banka_to_cari_hareket
    AFTER INSERT ON kasa_banka_hareketleri
    FOR EACH ROW
    EXECUTE FUNCTION create_cari_hareket_from_kasa_banka();

-- ====================================================
-- 3. CARİ HAREKETLER TABLOSUNA ODEME_ID EKLE
-- ====================================================

-- odeme_id kolonu yoksa ekle (kasa_banka_hareketleri ile ilişki için)
ALTER TABLE cari_hareketler
ADD COLUMN IF NOT EXISTS odeme_id INTEGER REFERENCES kasa_banka_hareketleri(id) ON DELETE SET NULL;

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_cari_hareketler_odeme_id ON cari_hareketler(odeme_id);

-- ====================================================
-- 4. CARİ BAKİYE DOĞRULAMA FONKSİYONU
-- ====================================================

-- Cari bakiyesini cari_hareketler'den yeniden hesapla
CREATE OR REPLACE FUNCTION recalculate_cari_bakiye(p_cari_id INTEGER)
RETURNS TABLE(
    cari_id INTEGER,
    hesaplanan_borc DECIMAL,
    hesaplanan_alacak DECIMAL,
    hesaplanan_bakiye DECIMAL,
    mevcut_borc DECIMAL,
    mevcut_alacak DECIMAL,
    mevcut_bakiye DECIMAL,
    fark DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH hesaplanan AS (
        SELECT
            ch.cari_id,
            COALESCE(SUM(ch.borc), 0) as toplam_borc,
            COALESCE(SUM(ch.alacak), 0) as toplam_alacak
        FROM cari_hareketler ch
        WHERE ch.cari_id = p_cari_id
        GROUP BY ch.cari_id
    )
    SELECT
        c.id as cari_id,
        COALESCE(h.toplam_borc, 0) as hesaplanan_borc,
        COALESCE(h.toplam_alacak, 0) as hesaplanan_alacak,
        COALESCE(h.toplam_alacak, 0) - COALESCE(h.toplam_borc, 0) as hesaplanan_bakiye,
        c.borc as mevcut_borc,
        c.alacak as mevcut_alacak,
        c.bakiye as mevcut_bakiye,
        (COALESCE(h.toplam_alacak, 0) - COALESCE(h.toplam_borc, 0)) - c.bakiye as fark
    FROM cariler c
    LEFT JOIN hesaplanan h ON h.cari_id = c.id
    WHERE c.id = p_cari_id;
END;
$$ LANGUAGE plpgsql;

-- Tüm carilerin bakiyesini doğrula
CREATE OR REPLACE FUNCTION verify_all_cari_bakiye()
RETURNS TABLE(
    cari_id INTEGER,
    cari_unvan VARCHAR,
    hesaplanan_bakiye DECIMAL,
    mevcut_bakiye DECIMAL,
    fark DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH hesaplanan AS (
        SELECT
            ch.cari_id,
            COALESCE(SUM(ch.alacak - ch.borc), 0) as bakiye
        FROM cari_hareketler ch
        GROUP BY ch.cari_id
    )
    SELECT
        c.id,
        c.unvan,
        COALESCE(h.bakiye, 0) as hesaplanan_bakiye,
        c.bakiye as mevcut_bakiye,
        COALESCE(h.bakiye, 0) - c.bakiye as fark
    FROM cariler c
    LEFT JOIN hesaplanan h ON h.cari_id = c.id
    WHERE ABS(COALESCE(h.bakiye, 0) - c.bakiye) > 0.01
    ORDER BY ABS(COALESCE(h.bakiye, 0) - c.bakiye) DESC;
END;
$$ LANGUAGE plpgsql;

-- ====================================================
-- 5. CARİ BAKİYE SYNC FONKSİYONU
-- ====================================================

-- Tek bir carinin bakiyesini cari_hareketler'den sync et
CREATE OR REPLACE FUNCTION sync_cari_bakiye(p_cari_id INTEGER)
RETURNS VOID AS $$
DECLARE
    v_borc DECIMAL;
    v_alacak DECIMAL;
BEGIN
    SELECT
        COALESCE(SUM(borc), 0),
        COALESCE(SUM(alacak), 0)
    INTO v_borc, v_alacak
    FROM cari_hareketler
    WHERE cari_id = p_cari_id;

    UPDATE cariler
    SET
        borc = v_borc,
        alacak = v_alacak,
        -- bakiye otomatik hesaplanır (GENERATED COLUMN)
        updated_at = NOW()
    WHERE id = p_cari_id;
END;
$$ LANGUAGE plpgsql;

-- Tüm carilerin bakiyesini sync et
CREATE OR REPLACE FUNCTION sync_all_cari_bakiye()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_cari RECORD;
BEGIN
    FOR v_cari IN SELECT id FROM cariler LOOP
        PERFORM sync_cari_bakiye(v_cari.id);
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ====================================================
-- 6. MEVCUT VERİLERİ SYNC ET
-- ====================================================

-- Mevcut kasa_banka_hareketleri'nden cari_hareketler'e eksik kayıtları ekle
-- (sadece cari_id'si olan ve henüz cari_hareketler'de olmayan kayıtlar)
INSERT INTO cari_hareketler (
    cari_id,
    hareket_tipi,
    belge_tipi,
    belge_no,
    belge_tarihi,
    borc,
    alacak,
    aciklama,
    odeme_id,
    created_at
)
SELECT
    kbh.cari_id,
    CASE
        WHEN kbh.hareket_tipi = 'giris' THEN 'tahsilat'
        ELSE 'odeme'
    END as hareket_tipi,
    'dekont' as belge_tipi,
    kbh.belge_no,
    kbh.tarih,
    CASE WHEN kbh.hareket_tipi = 'giris' THEN kbh.tutar ELSE 0 END as borc,
    CASE WHEN kbh.hareket_tipi = 'cikis' THEN kbh.tutar ELSE 0 END as alacak,
    COALESCE(kbh.aciklama, 'Kasa/Banka hareketi'),
    kbh.id as odeme_id,
    kbh.created_at
FROM kasa_banka_hareketleri kbh
WHERE kbh.cari_id IS NOT NULL
AND kbh.hareket_tipi != 'transfer'
AND NOT EXISTS (
    SELECT 1 FROM cari_hareketler ch
    WHERE ch.odeme_id = kbh.id
);

-- Tüm cari bakiyelerini sync et
SELECT sync_all_cari_bakiye();

-- ====================================================
-- 7. VIEW'LARI GÜNCELLE
-- ====================================================

-- Cari Özet Görünümü (geliştirilmiş)
CREATE OR REPLACE VIEW cari_detayli_ozet AS
SELECT
    c.*,
    COALESCE(fatura_stats.fatura_sayisi, 0) as fatura_sayisi,
    COALESCE(fatura_stats.toplam_fatura_tutari, 0) as toplam_fatura_tutari,
    COALESCE(hareket_stats.hareket_sayisi, 0) as hareket_sayisi,
    COALESCE(hareket_stats.son_hareket_tarihi, c.created_at::date) as son_hareket_tarihi,
    CASE
        WHEN c.bakiye > 0 THEN 'alacakli'
        WHEN c.bakiye < 0 THEN 'borclu'
        ELSE 'dengeli'
    END as bakiye_durumu
FROM cariler c
LEFT JOIN (
    SELECT
        sender_vkn,
        COUNT(*) as fatura_sayisi,
        SUM(payable_amount) as toplam_fatura_tutari
    FROM uyumsoft_invoices
    GROUP BY sender_vkn
) fatura_stats ON fatura_stats.sender_vkn = c.vergi_no
LEFT JOIN (
    SELECT
        cari_id,
        COUNT(*) as hareket_sayisi,
        MAX(belge_tarihi) as son_hareket_tarihi
    FROM cari_hareketler
    GROUP BY cari_id
) hareket_stats ON hareket_stats.cari_id = c.id;

-- Kasa-Banka Güncel Durum (kredi kartı destekli)
CREATE OR REPLACE VIEW kasa_banka_durum_v2 AS
SELECT
    kbh.id,
    kbh.hesap_tipi,
    kbh.hesap_adi,
    kbh.banka_adi,
    kbh.iban,
    kbh.para_birimi,
    kbh.bakiye,
    kbh.aktif,
    kbh.varsayilan,
    -- Kredi kartı için ek bilgiler
    kbh.kart_limiti,
    kbh.hesap_kesim_gunu,
    kbh.son_odeme_gunu,
    CASE
        WHEN kbh.hesap_tipi = 'kredi_karti' THEN kbh.kart_limiti + kbh.bakiye
        ELSE NULL
    END as kullanilabilir_limit,
    -- Bugünkü hareketler
    COALESCE(bugun.hareket_sayisi, 0) as bugun_hareket_sayisi,
    COALESCE(bugun.giris_toplam, 0) as bugun_giris,
    COALESCE(bugun.cikis_toplam, 0) as bugun_cikis
FROM kasa_banka_hesaplari kbh
LEFT JOIN (
    SELECT
        hesap_id,
        COUNT(*) as hareket_sayisi,
        SUM(CASE WHEN hareket_tipi = 'giris' THEN tutar ELSE 0 END) as giris_toplam,
        SUM(CASE WHEN hareket_tipi = 'cikis' THEN tutar ELSE 0 END) as cikis_toplam
    FROM kasa_banka_hareketleri
    WHERE tarih = CURRENT_DATE
    GROUP BY hesap_id
) bugun ON bugun.hesap_id = kbh.id
WHERE kbh.aktif = TRUE
ORDER BY
    CASE kbh.hesap_tipi
        WHEN 'kasa' THEN 1
        WHEN 'banka' THEN 2
        WHEN 'kredi_karti' THEN 3
    END,
    kbh.hesap_adi;

-- ====================================================
-- 8. AUDIT LOG İÇİN HELPER
-- ====================================================

-- Cari hareket silme/güncelleme için cari bakiye güncelleme trigger'ı
CREATE OR REPLACE FUNCTION update_cari_on_hareket_change()
RETURNS TRIGGER AS $$
BEGIN
    -- DELETE veya UPDATE durumunda eski cari'yi sync et
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        PERFORM sync_cari_bakiye(OLD.cari_id);
    END IF;

    -- INSERT veya UPDATE durumunda yeni cari'yi sync et
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.cari_id != OLD.cari_id OR TG_OP = 'INSERT' THEN
            PERFORM sync_cari_bakiye(NEW.cari_id);
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı oluştur (UPDATE ve DELETE için)
DROP TRIGGER IF EXISTS trigger_cari_hareket_change ON cari_hareketler;

CREATE TRIGGER trigger_cari_hareket_change
    AFTER UPDATE OR DELETE ON cari_hareketler
    FOR EACH ROW
    EXECUTE FUNCTION update_cari_on_hareket_change();

-- ====================================================
-- Migration tamamlandı!
-- ====================================================

COMMENT ON FUNCTION create_cari_hareket_from_kasa_banka IS
'Kasa/Banka hareketi eklendiğinde otomatik olarak cari hareket oluşturur.
Tahsilat (giris) -> Müşterinin borcu azalır (cari_hareketler.borc artar)
Ödeme (cikis) -> Tedarikçiye olan borcumuz azalır (cari_hareketler.alacak artar)';

COMMENT ON FUNCTION sync_cari_bakiye IS
'Tek bir carinin borc/alacak değerlerini cari_hareketler tablosundan yeniden hesaplar';

COMMENT ON FUNCTION sync_all_cari_bakiye IS
'Tüm carilerin borc/alacak değerlerini cari_hareketler tablosundan yeniden hesaplar';

COMMENT ON FUNCTION verify_all_cari_bakiye IS
'Tutarsız bakiyesi olan carileri listeler (debug için)';
