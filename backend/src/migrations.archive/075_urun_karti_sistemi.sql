-- =====================================================
-- ÜRÜN KARTI SİSTEMİ - Stok Kartlarından Geçiş
-- =====================================================
-- Bu migration:
-- 1. urun_kartlari tablosunu genişletir
-- 2. Tedarikçi fiyat geçmişi tablosu oluşturur
-- 3. Tedarikçi ürün eşleştirme tablosu oluşturur
-- 4. Ürün depo durumları tablosu oluşturur
-- 5. Ürün hareketleri tablosu oluşturur
-- 6. stok_kartlari tablosunu arşivler
-- =====================================================

-- 1. ÜRÜN KATEGORİLERİ TABLOSU (eğer yoksa)
CREATE TABLE IF NOT EXISTS urun_kategorileri (
    id SERIAL PRIMARY KEY,
    kod VARCHAR(20) UNIQUE,
    ad VARCHAR(100) NOT NULL,
    ust_kategori_id INTEGER REFERENCES urun_kategorileri(id),
    sira INTEGER DEFAULT 0,
    ikon VARCHAR(50),
    renk VARCHAR(20),
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 066 ile oluşturulmuş tabloda kod/ust_kategori_id/renk yoksa ekle (075 uyumu)
ALTER TABLE urun_kategorileri ADD COLUMN IF NOT EXISTS kod VARCHAR(20);
ALTER TABLE urun_kategorileri ADD COLUMN IF NOT EXISTS ust_kategori_id INTEGER REFERENCES urun_kategorileri(id);
ALTER TABLE urun_kategorileri ADD COLUMN IF NOT EXISTS renk VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS urun_kategorileri_kod_key ON urun_kategorileri(kod) WHERE kod IS NOT NULL;

-- Varsayılan kategorileri ekle (eğer yoksa)
INSERT INTO urun_kategorileri (id, kod, ad, sira) VALUES
(1, 'ET', 'Et Ürünleri', 1),
(2, 'BALIK', 'Balık & Deniz Ürünleri', 2),
(3, 'SUT', 'Süt Ürünleri', 3),
(4, 'SEBZE', 'Sebzeler', 4),
(5, 'MEYVE', 'Meyveler', 5),
(6, 'TAHIL', 'Tahıllar & Bakliyat', 6),
(7, 'BAHARAT', 'Baharat & Çeşni', 7),
(8, 'YAG', 'Yağlar', 8),
(9, 'KONSERVE', 'Konserve & Hazır Gıda', 9),
(10, 'ICECEK', 'İçecekler', 10),
(11, 'TATLI', 'Tatlı & Şekerleme', 11),
(12, 'EKMEK', 'Ekmek & Unlu Mamul', 12),
(13, 'DIGER', 'Diğer', 99)
ON CONFLICT (id) DO NOTHING;

-- 2. ÜRÜN KARTLARI TABLOSUNU GENİŞLET
-- Yeni alanlar ekle
ALTER TABLE urun_kartlari 
ADD COLUMN IF NOT EXISTS ana_birim_id INTEGER REFERENCES birimler(id),
ADD COLUMN IF NOT EXISTS barkod VARCHAR(50),
ADD COLUMN IF NOT EXISTS min_stok DECIMAL(15,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_stok DECIMAL(15,3),
ADD COLUMN IF NOT EXISTS kritik_stok DECIMAL(15,3),
ADD COLUMN IF NOT EXISTS raf_omru_gun INTEGER,
ADD COLUMN IF NOT EXISTS kdv_orani DECIMAL(5,2) DEFAULT 10,
ADD COLUMN IF NOT EXISTS aciklama TEXT,
ADD COLUMN IF NOT EXISTS resim_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS ortalama_fiyat DECIMAL(15,4),
ADD COLUMN IF NOT EXISTS son_alis_fiyati DECIMAL(15,4),
ADD COLUMN IF NOT EXISTS son_alis_tarihi TIMESTAMP,
ADD COLUMN IF NOT EXISTS toplam_stok DECIMAL(15,3) DEFAULT 0;

-- Eski stok_kart_id alanını kaldır (artık gerekli değil)
-- ALTER TABLE urun_kartlari DROP COLUMN IF EXISTS stok_kart_id;

-- 3. TEDARİKÇİ FİYAT GEÇMİŞİ TABLOSU
CREATE TABLE IF NOT EXISTS urun_fiyat_gecmisi (
    id SERIAL PRIMARY KEY,
    urun_kart_id INTEGER NOT NULL REFERENCES urun_kartlari(id) ON DELETE CASCADE,
    cari_id INTEGER REFERENCES cariler(id) ON DELETE SET NULL, -- Tedarikçi (NULL = manuel giriş)
    fiyat DECIMAL(15,4) NOT NULL,
    birim_id INTEGER REFERENCES birimler(id),
    kdv_dahil BOOLEAN DEFAULT FALSE,
    fatura_ettn VARCHAR(100), -- Hangi faturadan geldi
    kaynak VARCHAR(50) DEFAULT 'manuel', -- 'fatura', 'manuel', 'piyasa', 'import'
    tarih DATE DEFAULT CURRENT_DATE,
    aciklama VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_urun_fiyat_gecmisi_urun ON urun_fiyat_gecmisi(urun_kart_id);
CREATE INDEX IF NOT EXISTS idx_urun_fiyat_gecmisi_cari ON urun_fiyat_gecmisi(cari_id);
CREATE INDEX IF NOT EXISTS idx_urun_fiyat_gecmisi_tarih ON urun_fiyat_gecmisi(tarih DESC);

-- 4. TEDARİKÇİ ÜRÜN EŞLEŞTİRME TABLOSU
-- Fatura kalemlerini ürün kartlarına eşleştirmek için
CREATE TABLE IF NOT EXISTS urun_tedarikci_eslestirme (
    id SERIAL PRIMARY KEY,
    urun_kart_id INTEGER NOT NULL REFERENCES urun_kartlari(id) ON DELETE CASCADE,
    cari_id INTEGER REFERENCES cariler(id) ON DELETE SET NULL, -- Tedarikçi
    tedarikci_urun_kodu VARCHAR(100), -- Tedarikçinin kullandığı kod
    tedarikci_urun_adi VARCHAR(500) NOT NULL, -- Tedarikçinin kullandığı isim
    tedarikci_urun_adi_normalized VARCHAR(500), -- Normalize edilmiş isim (arama için)
    tedarikci_birimi VARCHAR(20), -- UBL birim kodu (KGM, C62 vb.)
    birim_carpani DECIMAL(10,6) DEFAULT 1, -- 1 tedarikçi birimi = X sistem birimi
    eslestirme_sayisi INTEGER DEFAULT 1, -- Kaç kez bu eşleştirme kullanıldı
    otomatik_pilanmis BOOLEAN DEFAULT FALSE, -- AI tarafından mı eşleştirildi
    guven_skoru DECIMAL(5,2), -- Eşleştirme güven skoru
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id),
    
    -- Aynı tedarikçi+ürün adı kombinasyonu tekrar edemez
    UNIQUE(cari_id, tedarikci_urun_adi_normalized)
);

CREATE INDEX IF NOT EXISTS idx_urun_tedarikci_eslestirme_urun ON urun_tedarikci_eslestirme(urun_kart_id);
CREATE INDEX IF NOT EXISTS idx_urun_tedarikci_eslestirme_cari ON urun_tedarikci_eslestirme(cari_id);
CREATE INDEX IF NOT EXISTS idx_urun_tedarikci_eslestirme_normalized ON urun_tedarikci_eslestirme(tedarikci_urun_adi_normalized);

-- Trigram index for fuzzy search
CREATE INDEX IF NOT EXISTS idx_urun_tedarikci_eslestirme_trgm 
ON urun_tedarikci_eslestirme USING gin (tedarikci_urun_adi_normalized gin_trgm_ops);

-- 5. ÜRÜN DEPO DURUMLARI TABLOSU
CREATE TABLE IF NOT EXISTS urun_depo_durumlari (
    id SERIAL PRIMARY KEY,
    urun_kart_id INTEGER NOT NULL REFERENCES urun_kartlari(id) ON DELETE CASCADE,
    depo_id INTEGER NOT NULL REFERENCES depolar(id) ON DELETE CASCADE,
    miktar DECIMAL(15,3) DEFAULT 0,
    rezerve_miktar DECIMAL(15,3) DEFAULT 0,
    min_stok DECIMAL(15,3),
    max_stok DECIMAL(15,3),
    raf_konum VARCHAR(50),
    son_sayim_tarihi DATE,
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(urun_kart_id, depo_id)
);

CREATE INDEX IF NOT EXISTS idx_urun_depo_durumlari_urun ON urun_depo_durumlari(urun_kart_id);
CREATE INDEX IF NOT EXISTS idx_urun_depo_durumlari_depo ON urun_depo_durumlari(depo_id);

-- 6. ÜRÜN HAREKETLERİ TABLOSU
CREATE TABLE IF NOT EXISTS urun_hareketleri (
    id SERIAL PRIMARY KEY,
    urun_kart_id INTEGER NOT NULL REFERENCES urun_kartlari(id) ON DELETE CASCADE,
    hareket_tipi VARCHAR(20) NOT NULL, -- 'giris', 'cikis', 'transfer', 'sayim', 'fire'
    miktar DECIMAL(15,3) NOT NULL,
    birim_id INTEGER REFERENCES birimler(id),
    birim_fiyat DECIMAL(15,4),
    toplam_tutar DECIMAL(15,2),
    
    -- Depo bilgileri
    kaynak_depo_id INTEGER REFERENCES depolar(id),
    hedef_depo_id INTEGER REFERENCES depolar(id),
    
    -- İlişkili belgeler
    fatura_id INTEGER, -- Manuel fatura
    uyumsoft_fatura_id INTEGER REFERENCES uyumsoft_invoices(id),
    fatura_ettn VARCHAR(100),
    siparis_id INTEGER,
    
    -- Tedarikçi/Müşteri
    cari_id INTEGER REFERENCES cariler(id),
    
    -- Detaylar
    aciklama VARCHAR(500),
    referans_no VARCHAR(100),
    tarih TIMESTAMP DEFAULT NOW(),
    
    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_urun_hareketleri_urun ON urun_hareketleri(urun_kart_id);
CREATE INDEX IF NOT EXISTS idx_urun_hareketleri_tarih ON urun_hareketleri(tarih DESC);
CREATE INDEX IF NOT EXISTS idx_urun_hareketleri_tip ON urun_hareketleri(hareket_tipi);
CREATE INDEX IF NOT EXISTS idx_urun_hareketleri_depo ON urun_hareketleri(hedef_depo_id);

-- 7. ÜRÜN ADI NORMALİZASYON FONKSİYONU
-- Parametre adı değişikliği için önce drop (PostgreSQL 42P13)
DROP FUNCTION IF EXISTS normalize_urun_adi_v2(text);
CREATE OR REPLACE FUNCTION normalize_urun_adi_v2(urun_adi TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(TRIM(REGEXP_REPLACE(
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                REGEXP_REPLACE(urun_adi, 
                    '\s*\d+[.,]?\d*\s*(kg|gr|g|lt|l|ml|adet|ad|pkt|paket|kutu|koli|m|cm|m2|m3)\s*', ' ', 'gi'), -- Miktar ve birimleri kaldır
                '[^a-zA-ZğüşöçıİĞÜŞÖÇ0-9\s]', ' ', 'gi'), -- Özel karakterleri boşluğa çevir
            '\s+', ' ', 'g'), -- Birden fazla boşluğu tek boşluğa indir
        '^\s+|\s+$', '', 'g' -- Baş ve sondaki boşlukları kaldır
    )));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 8. EN İYİ ÜRÜN EŞLEŞTİRME FONKSİYONU
CREATE OR REPLACE FUNCTION find_best_urun_match(
    p_urun_adi TEXT,
    p_urun_kodu TEXT DEFAULT NULL,
    p_cari_id INTEGER DEFAULT NULL,
    p_min_guven_skoru DECIMAL DEFAULT 60
)
RETURNS TABLE(
    urun_kart_id INTEGER,
    urun_kod VARCHAR,
    urun_ad VARCHAR,
    urun_birim_id INTEGER,
    guven_skoru DECIMAL,
    eslestirme_kaynagi VARCHAR -- 'exact_code', 'tedarikci_gecmis', 'fuzzy_match'
) AS $$
DECLARE
    normalized_adi TEXT;
BEGIN
    normalized_adi := normalize_urun_adi_v2(p_urun_adi);
    
    -- 1. Önce tam kod eşleşmesi kontrol et
    IF p_urun_kodu IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            uk.id,
            uk.kod,
            uk.ad,
            uk.ana_birim_id,
            100::DECIMAL,
            'exact_code'::VARCHAR
        FROM urun_kartlari uk
        WHERE uk.kod = p_urun_kodu AND uk.aktif = TRUE
        LIMIT 1;
        
        IF FOUND THEN RETURN; END IF;
    END IF;
    
    -- 2. Tedarikçi geçmişinden eşleşme ara
    RETURN QUERY
    SELECT 
        ute.urun_kart_id,
        uk.kod,
        uk.ad,
        uk.ana_birim_id,
        LEAST(100, 80 + (ute.eslestirme_sayisi * 2))::DECIMAL,
        'tedarikci_gecmis'::VARCHAR
    FROM urun_tedarikci_eslestirme ute
    JOIN urun_kartlari uk ON uk.id = ute.urun_kart_id
    WHERE ute.aktif = TRUE
      AND uk.aktif = TRUE
      AND (
          ute.tedarikci_urun_adi_normalized = normalized_adi
          OR (p_urun_kodu IS NOT NULL AND ute.tedarikci_urun_kodu = p_urun_kodu)
          OR (p_cari_id IS NOT NULL AND ute.cari_id = p_cari_id AND ute.tedarikci_urun_adi_normalized = normalized_adi)
      )
    ORDER BY ute.eslestirme_sayisi DESC
    LIMIT 1;
    
    IF FOUND THEN RETURN; END IF;
    
    -- 3. Fuzzy match ile ürün kartlarından ara
    RETURN QUERY
    SELECT 
        uk.id,
        uk.kod,
        uk.ad,
        uk.ana_birim_id,
        (SIMILARITY(normalized_adi, normalize_urun_adi_v2(uk.ad)) * 100)::DECIMAL,
        'fuzzy_match'::VARCHAR
    FROM urun_kartlari uk
    WHERE uk.aktif = TRUE
      AND SIMILARITY(normalized_adi, normalize_urun_adi_v2(uk.ad)) >= (p_min_guven_skoru / 100)
    ORDER BY SIMILARITY(normalized_adi, normalize_urun_adi_v2(uk.ad)) DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 9. FİYAT ANOMALİ KONTROL FONKSİYONU
CREATE OR REPLACE FUNCTION kontrol_urun_fiyat_anomali(
    p_urun_kart_id INTEGER,
    p_yeni_fiyat DECIMAL,
    p_cari_id INTEGER DEFAULT NULL,
    p_tolerans_yuzde DECIMAL DEFAULT 30
)
RETURNS TABLE(anomali BOOLEAN, fark_yuzde DECIMAL, referans_fiyat DECIMAL, referans_kaynak VARCHAR) AS $$
DECLARE
    _son_fiyat DECIMAL;
    _kaynak VARCHAR;
BEGIN
    -- Önce aynı tedarikçiden son fiyatı bul
    IF p_cari_id IS NOT NULL THEN
        SELECT fiyat, 'ayni_tedarikci' INTO _son_fiyat, _kaynak
        FROM urun_fiyat_gecmisi
        WHERE urun_kart_id = p_urun_kart_id AND cari_id = p_cari_id
        ORDER BY tarih DESC, created_at DESC
        LIMIT 1;
    END IF;
    
    -- Tedarikçiden bulunamadıysa genel ortalamaya bak
    IF _son_fiyat IS NULL THEN
        SELECT AVG(fiyat), 'ortalama' INTO _son_fiyat, _kaynak
        FROM urun_fiyat_gecmisi
        WHERE urun_kart_id = p_urun_kart_id
          AND tarih >= CURRENT_DATE - INTERVAL '90 days';
    END IF;
    
    IF _son_fiyat IS NOT NULL AND _son_fiyat > 0 THEN
        fark_yuzde := ABS((p_yeni_fiyat - _son_fiyat) / _son_fiyat) * 100;
        anomali := fark_yuzde >= p_tolerans_yuzde;
        referans_fiyat := _son_fiyat;
        referans_kaynak := _kaynak;
    ELSE
        anomali := FALSE;
        fark_yuzde := 0;
        referans_fiyat := NULL;
        referans_kaynak := 'ilk_kayit';
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 10. ÜRÜN TOPLAM STOK GÜNCELLEME TRİGGER'I
CREATE OR REPLACE FUNCTION update_urun_toplam_stok()
RETURNS TRIGGER AS $$
BEGIN
    -- Ürün kartındaki toplam stoku güncelle
    UPDATE urun_kartlari 
    SET toplam_stok = (
        SELECT COALESCE(SUM(miktar), 0) 
        FROM urun_depo_durumlari 
        WHERE urun_kart_id = COALESCE(NEW.urun_kart_id, OLD.urun_kart_id)
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.urun_kart_id, OLD.urun_kart_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_urun_toplam_stok ON urun_depo_durumlari;
CREATE TRIGGER trg_update_urun_toplam_stok
AFTER INSERT OR UPDATE OR DELETE ON urun_depo_durumlari
FOR EACH ROW EXECUTE FUNCTION update_urun_toplam_stok();

-- 11. ÜRÜN HAREKETİ SONRASI DEPO GÜNCELLEME TRİGGER'I
CREATE OR REPLACE FUNCTION update_depo_after_hareket()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.hareket_tipi IN ('giris', 'sayim') AND NEW.hedef_depo_id IS NOT NULL THEN
        -- Giriş: Hedef depoya ekle
        INSERT INTO urun_depo_durumlari (urun_kart_id, depo_id, miktar)
        VALUES (NEW.urun_kart_id, NEW.hedef_depo_id, NEW.miktar)
        ON CONFLICT (urun_kart_id, depo_id) 
        DO UPDATE SET 
            miktar = CASE 
                WHEN NEW.hareket_tipi = 'sayim' THEN NEW.miktar  -- Sayımda direkt değer ata
                ELSE urun_depo_durumlari.miktar + NEW.miktar     -- Girişte ekle
            END,
            updated_at = NOW();
            
    ELSIF NEW.hareket_tipi IN ('cikis', 'fire') AND NEW.kaynak_depo_id IS NOT NULL THEN
        -- Çıkış: Kaynak depodan düş
        UPDATE urun_depo_durumlari 
        SET miktar = miktar - NEW.miktar, updated_at = NOW()
        WHERE urun_kart_id = NEW.urun_kart_id AND depo_id = NEW.kaynak_depo_id;
        
    ELSIF NEW.hareket_tipi = 'transfer' THEN
        -- Transfer: Kaynaktan düş, hedefe ekle
        UPDATE urun_depo_durumlari 
        SET miktar = miktar - NEW.miktar, updated_at = NOW()
        WHERE urun_kart_id = NEW.urun_kart_id AND depo_id = NEW.kaynak_depo_id;
        
        INSERT INTO urun_depo_durumlari (urun_kart_id, depo_id, miktar)
        VALUES (NEW.urun_kart_id, NEW.hedef_depo_id, NEW.miktar)
        ON CONFLICT (urun_kart_id, depo_id) 
        DO UPDATE SET miktar = urun_depo_durumlari.miktar + NEW.miktar, updated_at = NOW();
    END IF;
    
    -- Son alış fiyatı ve tarihini güncelle (giriş işlemlerinde)
    IF NEW.hareket_tipi = 'giris' AND NEW.birim_fiyat IS NOT NULL THEN
        UPDATE urun_kartlari 
        SET son_alis_fiyati = NEW.birim_fiyat,
            son_alis_tarihi = NEW.tarih,
            updated_at = NOW()
        WHERE id = NEW.urun_kart_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_depo_after_hareket ON urun_hareketleri;
CREATE TRIGGER trg_update_depo_after_hareket
AFTER INSERT ON urun_hareketleri
FOR EACH ROW EXECUTE FUNCTION update_depo_after_hareket();

-- 12. RECETE_MALZEMELER TABLOSUNDA urun_kart_id ZORUNLU YAP
-- (Önce mevcut verileri kontrol et, sonra constraint ekle)
-- ALTER TABLE recete_malzemeler 
-- ALTER COLUMN urun_kart_id SET NOT NULL;

-- 13. ESKİ stok_kartlari TABLOSUNU ARŞİVLE
-- Önce yeni bir arşiv tablosuna kopyala
CREATE TABLE IF NOT EXISTS stok_kartlari_arsiv AS 
SELECT *, NOW() as arsiv_tarihi FROM stok_kartlari;

-- 14. VIEW: Ürün Kartı Detaylı Görünümü
CREATE OR REPLACE VIEW v_urun_kartlari_detay AS
SELECT 
    uk.id,
    uk.kod,
    uk.ad,
    uk.kategori_id,
    kat.ad as kategori_adi,
    uk.ana_birim_id,
    b.ad as birim_adi,
    b.kisa_ad as birim_kisa,
    uk.barkod,
    uk.min_stok,
    uk.max_stok,
    uk.kritik_stok,
    uk.kdv_orani,
    uk.toplam_stok,
    uk.ortalama_fiyat,
    uk.son_alis_fiyati,
    uk.son_alis_tarihi,
    uk.aktif,
    uk.created_at,
    -- Son 3 tedarikçi fiyatı
    (
        SELECT json_agg(t) FROM (
            SELECT c.unvan as tedarikci, ufg.fiyat, ufg.tarih
            FROM urun_fiyat_gecmisi ufg
            LEFT JOIN cariler c ON c.id = ufg.cari_id
            WHERE ufg.urun_kart_id = uk.id
            ORDER BY ufg.tarih DESC
            LIMIT 3
        ) t
    ) as son_fiyatlar,
    -- Depo durumları
    (
        SELECT json_agg(d) FROM (
            SELECT dep.ad as depo, udd.miktar
            FROM urun_depo_durumlari udd
            JOIN depolar dep ON dep.id = udd.depo_id
            WHERE udd.urun_kart_id = uk.id AND udd.miktar > 0
        ) d
    ) as depo_durumlari
FROM urun_kartlari uk
LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
LEFT JOIN birimler b ON b.id = uk.ana_birim_id
WHERE uk.aktif = TRUE;

-- 15. COMMENT'LER
COMMENT ON TABLE urun_kartlari IS 'Ana ürün kartları - Standart ürün tanımları';
COMMENT ON TABLE urun_fiyat_gecmisi IS 'Tedarikçi bazlı fiyat geçmişi';
COMMENT ON TABLE urun_tedarikci_eslestirme IS 'Fatura kalemlerini ürün kartlarına eşleştirme tablosu';
COMMENT ON TABLE urun_depo_durumlari IS 'Ürünlerin depo bazlı stok durumları';
COMMENT ON TABLE urun_hareketleri IS 'Ürün giriş/çıkış/transfer hareketleri';

COMMENT ON FUNCTION find_best_urun_match IS 'Fatura kalemini en uygun ürün kartına eşleştirir';
COMMENT ON FUNCTION kontrol_urun_fiyat_anomali IS 'Yeni fiyatın normal aralıkta olup olmadığını kontrol eder';
