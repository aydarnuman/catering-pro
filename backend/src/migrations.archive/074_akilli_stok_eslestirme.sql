-- =============================================
-- 074: AKILLI STOK EŞLEŞTİRME SİSTEMİ
-- =============================================
-- Fatura kalemlerini stok kartlarına akıllı eşleştirme
-- Fuzzy matching, güven skoru, birim dönüşüm, fiyat anomali

-- =============================================
-- 1. UBL BİRİM DÖNÜŞÜM TABLOSU
-- E-faturadaki birim kodlarını sistem birimlerine çevirir
-- =============================================
CREATE TABLE IF NOT EXISTS ubl_birim_donusum (
    id SERIAL PRIMARY KEY,
    ubl_kodu VARCHAR(10) NOT NULL,          -- KGM, C62, LTR, GRM, MLT, MTR
    ubl_aciklama VARCHAR(100),               -- Kilogram, Piece, Litre
    sistem_birim_id INTEGER REFERENCES birimler(id),
    carpan DECIMAL(15,6) DEFAULT 1,          -- Dönüşüm çarpanı (GRM→KG için 0.001)
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(ubl_kodu)
);

-- Temel UBL birim kodları
INSERT INTO ubl_birim_donusum (ubl_kodu, ubl_aciklama, sistem_birim_id, carpan) VALUES
    -- Ağırlık
    ('KGM', 'Kilogram', (SELECT id FROM birimler WHERE kod = 'KG'), 1),
    ('GRM', 'Gram', (SELECT id FROM birimler WHERE kod = 'KG'), 0.001),
    ('TNE', 'Ton', (SELECT id FROM birimler WHERE kod = 'KG'), 1000),
    -- Hacim
    ('LTR', 'Litre', (SELECT id FROM birimler WHERE kod = 'LT'), 1),
    ('MLT', 'Mililitre', (SELECT id FROM birimler WHERE kod = 'LT'), 0.001),
    ('MTQ', 'Metreküp', (SELECT id FROM birimler WHERE kod = 'LT'), 1000),
    -- Sayı
    ('C62', 'Adet (Piece)', (SELECT id FROM birimler WHERE kod = 'ADET'), 1),
    ('EA', 'Each', (SELECT id FROM birimler WHERE kod = 'ADET'), 1),
    ('NAR', 'Adet', (SELECT id FROM birimler WHERE kod = 'ADET'), 1),
    ('NIU', 'Adet', (SELECT id FROM birimler WHERE kod = 'ADET'), 1),
    ('PCE', 'Piece', (SELECT id FROM birimler WHERE kod = 'ADET'), 1),
    -- Uzunluk
    ('MTR', 'Metre', (SELECT id FROM birimler WHERE kod = 'METRE'), 1),
    ('CMT', 'Santimetre', (SELECT id FROM birimler WHERE kod = 'METRE'), 0.01),
    -- Paket/Kutu
    ('PK', 'Paket', (SELECT id FROM birimler WHERE kod = 'PAKET'), 1),
    ('BX', 'Kutu', (SELECT id FROM birimler WHERE kod = 'KUTU'), 1),
    ('CT', 'Karton', (SELECT id FROM birimler WHERE kod = 'KOLİ'), 1)
ON CONFLICT (ubl_kodu) DO UPDATE SET
    ubl_aciklama = EXCLUDED.ubl_aciklama,
    sistem_birim_id = EXCLUDED.sistem_birim_id,
    carpan = EXCLUDED.carpan;

-- =============================================
-- 2. FATURA ÜRÜN EŞLEŞTİRME TABLOSUNA YENİ ALANLAR
-- Güven skoru ve eşleştirme yöntemi ekleniyor
-- =============================================
ALTER TABLE fatura_urun_eslestirme
ADD COLUMN IF NOT EXISTS tedarikci_vkn VARCHAR(20),
ADD COLUMN IF NOT EXISTS guven_skoru DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS eslestirme_yontemi VARCHAR(30) DEFAULT 'manuel',
ADD COLUMN IF NOT EXISTS otomatik_onay BOOLEAN DEFAULT FALSE;

-- Eşleştirme yöntemi: tam_eslesme, gecmis_eslesme, fuzzy_match, manuel
COMMENT ON COLUMN fatura_urun_eslestirme.guven_skoru IS 'Eşleştirme güven skoru (0-100)';
COMMENT ON COLUMN fatura_urun_eslestirme.eslestirme_yontemi IS 'tam_eslesme, gecmis_eslesme, fuzzy_match, manuel';
COMMENT ON COLUMN fatura_urun_eslestirme.otomatik_onay IS 'Güven skoru 90+ ise true';

-- =============================================
-- 3. STOK KARTI FİYAT GEÇMİŞİ TABLOSU
-- Fiyat anomali tespiti için
-- =============================================
CREATE TABLE IF NOT EXISTS stok_fiyat_gecmisi (
    id SERIAL PRIMARY KEY,
    stok_kart_id INTEGER NOT NULL REFERENCES stok_kartlari(id) ON DELETE CASCADE,
    tedarikci_vkn VARCHAR(20),
    tedarikci_ad VARCHAR(500),
    fatura_ettn VARCHAR(100),
    fatura_tarihi DATE,
    birim_fiyat DECIMAL(15,4) NOT NULL,
    miktar DECIMAL(15,3),
    onceki_fiyat DECIMAL(15,4),
    fiyat_degisim_orani DECIMAL(8,2),  -- Yüzde olarak değişim
    anomali_var BOOLEAN DEFAULT FALSE,
    anomali_aciklama VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stok_fiyat_gecmisi_kart ON stok_fiyat_gecmisi(stok_kart_id);
CREATE INDEX IF NOT EXISTS idx_stok_fiyat_gecmisi_tedarikci ON stok_fiyat_gecmisi(tedarikci_vkn);
CREATE INDEX IF NOT EXISTS idx_stok_fiyat_gecmisi_tarih ON stok_fiyat_gecmisi(fatura_tarihi);

COMMENT ON TABLE stok_fiyat_gecmisi IS 'Stok kartı fiyat değişim geçmişi ve anomali tespiti';

-- =============================================
-- 4. TOPLU FATURA İŞLEM TABLOSU
-- Toplu işlem takibi için
-- =============================================
CREATE TABLE IF NOT EXISTS toplu_fatura_islem (
    id SERIAL PRIMARY KEY,
    islem_tarihi TIMESTAMP DEFAULT NOW(),
    isleyen_kullanici_id INTEGER,
    toplam_fatura INTEGER DEFAULT 0,
    basarili_fatura INTEGER DEFAULT 0,
    hatali_fatura INTEGER DEFAULT 0,
    toplam_kalem INTEGER DEFAULT 0,
    otomatik_eslesen INTEGER DEFAULT 0,
    manuel_gereken INTEGER DEFAULT 0,
    durum VARCHAR(20) DEFAULT 'beklemede',  -- beklemede, isleniyor, tamamlandi, hata
    hata_mesaji TEXT,
    sonuc_ozeti JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE toplu_fatura_islem IS 'Toplu fatura işleme kayıtları';

-- =============================================
-- 5. FUZZY MATCH İÇİN POSTGRESQL FONKSİYONU
-- Levenshtein benzeri benzerlik hesaplama
-- =============================================

-- pg_trgm extension'ı etkinleştir (fuzzy search için)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Benzerlik eşik değeri ayarla (0.3 = %30 benzerlik)
-- SET pg_trgm.similarity_threshold = 0.3;

-- Ürün adı normalize fonksiyonu
CREATE OR REPLACE FUNCTION normalize_urun_adi(ad TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    REGEXP_REPLACE(
                        COALESCE(ad, ''),
                        '\d+[.,]?\d*\s*(kg|gr|lt|ml|adet|ad|pkt|paket)', '', 'gi'  -- Miktar/birim kaldır
                    ),
                    '[%\(\)\-\_\.\,\/]', ' ', 'g'  -- Özel karakterleri boşluğa çevir
                ),
                '\s+', ' ', 'g'  -- Çoklu boşlukları tek boşluğa
            ),
            '^\s+|\s+$', '', 'g'  -- Baş ve sondaki boşlukları kaldır
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Akıllı eşleştirme fonksiyonu
CREATE OR REPLACE FUNCTION akilli_stok_eslestir(
    p_urun_adi TEXT,
    p_urun_kodu TEXT DEFAULT NULL,
    p_tedarikci_vkn TEXT DEFAULT NULL
)
RETURNS TABLE (
    stok_kart_id INTEGER,
    stok_kodu VARCHAR,
    stok_adi VARCHAR,
    guven_skoru DECIMAL,
    eslestirme_yontemi VARCHAR,
    benzerlik DECIMAL
) AS $$
DECLARE
    normalized_adi TEXT;
BEGIN
    normalized_adi := normalize_urun_adi(p_urun_adi);
    
    RETURN QUERY
    WITH eslesme_skorlari AS (
        -- 1. TAM EŞLEŞME (Ürün kodu)
        SELECT 
            sk.id,
            sk.kod,
            sk.ad,
            100.0::DECIMAL as skor,
            'tam_eslesme'::VARCHAR as yontem,
            1.0::DECIMAL as sim
        FROM stok_kartlari sk
        WHERE sk.aktif = true 
          AND p_urun_kodu IS NOT NULL 
          AND sk.kod = p_urun_kodu
        
        UNION ALL
        
        -- 2. GEÇMİŞ EŞLEŞME (Daha önce eşleştirilmiş)
        SELECT 
            sk.id,
            sk.kod,
            sk.ad,
            (95 - LEAST(10, (NOW()::DATE - fue.son_eslestirme::DATE) / 30))::DECIMAL as skor,
            'gecmis_eslesme'::VARCHAR as yontem,
            1.0::DECIMAL as sim
        FROM fatura_urun_eslestirme fue
        JOIN stok_kartlari sk ON sk.id = fue.stok_kart_id AND sk.aktif = true
        WHERE fue.tedarikci_urun_kodu = p_urun_kodu
           OR fue.tedarikci_urun_adi ILIKE '%' || LEFT(p_urun_adi, 20) || '%'
           OR (p_tedarikci_vkn IS NOT NULL AND fue.tedarikci_vkn = p_tedarikci_vkn 
               AND fue.tedarikci_urun_adi ILIKE '%' || LEFT(p_urun_adi, 15) || '%')
        
        UNION ALL
        
        -- 3. FUZZY MATCH (İsim benzerliği - pg_trgm)
        SELECT 
            sk.id,
            sk.kod,
            sk.ad,
            (similarity(normalize_urun_adi(sk.ad), normalized_adi) * 90)::DECIMAL as skor,
            'fuzzy_match'::VARCHAR as yontem,
            similarity(normalize_urun_adi(sk.ad), normalized_adi)::DECIMAL as sim
        FROM stok_kartlari sk
        WHERE sk.aktif = true
          AND similarity(normalize_urun_adi(sk.ad), normalized_adi) > 0.3
    )
    SELECT DISTINCT ON (es.id)
        es.id as stok_kart_id,
        es.kod as stok_kodu,
        es.ad as stok_adi,
        es.skor as guven_skoru,
        es.yontem as eslestirme_yontemi,
        es.sim as benzerlik
    FROM eslesme_skorlari es
    ORDER BY es.id, es.skor DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 6. FİYAT ANOMALİ KONTROL FONKSİYONU
-- %30+ fiyat değişimi tespit eder
-- =============================================
CREATE OR REPLACE FUNCTION kontrol_fiyat_anomali(
    p_stok_kart_id INTEGER,
    p_yeni_fiyat DECIMAL,
    p_esik_yuzde DECIMAL DEFAULT 30
)
RETURNS TABLE (
    anomali_var BOOLEAN,
    onceki_fiyat DECIMAL,
    fiyat_degisim_yuzde DECIMAL,
    aciklama VARCHAR
) AS $$
DECLARE
    v_onceki_fiyat DECIMAL;
    v_degisim DECIMAL;
BEGIN
    -- Son fiyatı al
    SELECT sk.son_alis_fiyat INTO v_onceki_fiyat
    FROM stok_kartlari sk
    WHERE sk.id = p_stok_kart_id;
    
    -- Önceki fiyat yoksa anomali yok
    IF v_onceki_fiyat IS NULL OR v_onceki_fiyat = 0 THEN
        RETURN QUERY SELECT FALSE, NULL::DECIMAL, NULL::DECIMAL, NULL::VARCHAR;
        RETURN;
    END IF;
    
    -- Değişim oranını hesapla
    v_degisim := ((p_yeni_fiyat - v_onceki_fiyat) / v_onceki_fiyat) * 100;
    
    -- Anomali kontrolü
    IF ABS(v_degisim) >= p_esik_yuzde THEN
        RETURN QUERY SELECT 
            TRUE,
            v_onceki_fiyat,
            ROUND(v_degisim, 2),
            CASE 
                WHEN v_degisim > 0 THEN 
                    FORMAT('Fiyat %%%.0f arttı (₺%.2f → ₺%.2f)', v_degisim, v_onceki_fiyat, p_yeni_fiyat)
                ELSE 
                    FORMAT('Fiyat %%%.0f düştü (₺%.2f → ₺%.2f)', ABS(v_degisim), v_onceki_fiyat, p_yeni_fiyat)
            END::VARCHAR;
    ELSE
        RETURN QUERY SELECT FALSE, v_onceki_fiyat, ROUND(v_degisim, 2), NULL::VARCHAR;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 7. İNDEKSLER
-- =============================================

-- Stok kartı adına trigram indeksi (fuzzy search için)
CREATE INDEX IF NOT EXISTS idx_stok_kartlari_ad_trgm ON stok_kartlari USING gin (ad gin_trgm_ops);

-- Fatura eşleştirme indeksleri
CREATE INDEX IF NOT EXISTS idx_fue_tedarikci_vkn ON fatura_urun_eslestirme(tedarikci_vkn);
CREATE INDEX IF NOT EXISTS idx_fue_guven_skoru ON fatura_urun_eslestirme(guven_skoru);

-- =============================================
-- YORUM VE AÇIKLAMALAR
-- =============================================
COMMENT ON TABLE ubl_birim_donusum IS 'E-fatura UBL birim kodlarını sistem birimlerine dönüştürür';
COMMENT ON FUNCTION normalize_urun_adi(TEXT) IS 'Ürün adını normalize eder (miktar, birim, özel karakter temizler)';
COMMENT ON FUNCTION akilli_stok_eslestir(TEXT, TEXT, TEXT) IS 'Fatura kalemini stok kartına akıllı eşleştirir, güven skoru döner';
COMMENT ON FUNCTION kontrol_fiyat_anomali(INTEGER, DECIMAL, DECIMAL) IS 'Fiyat değişim anomalisini tespit eder';
