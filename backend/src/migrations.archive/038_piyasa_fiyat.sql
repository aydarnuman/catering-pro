-- =============================================
-- PİYASA FİYAT TAKİP SİSTEMİ
-- =============================================

-- Piyasa fiyat araştırma geçmişi
CREATE TABLE IF NOT EXISTS piyasa_fiyat_gecmisi (
    id SERIAL PRIMARY KEY,
    stok_kart_id INTEGER REFERENCES stok_kartlari(id) ON DELETE SET NULL,
    urun_adi VARCHAR(200) NOT NULL,
    sistem_fiyat DECIMAL(15,2),
    piyasa_fiyat_min DECIMAL(15,2),
    piyasa_fiyat_max DECIMAL(15,2),
    piyasa_fiyat_ort DECIMAL(15,2),
    kaynaklar JSONB,                 -- [{market: 'A101', fiyat: 78}, ...]
    ai_oneri TEXT,
    arastirma_tarihi TIMESTAMP DEFAULT NOW()
);

-- Kullanıcının takip listesi
CREATE TABLE IF NOT EXISTS piyasa_takip_listesi (
    id SERIAL PRIMARY KEY,
    stok_kart_id INTEGER REFERENCES stok_kartlari(id) ON DELETE SET NULL,
    urun_adi VARCHAR(200) NOT NULL,
    son_sistem_fiyat DECIMAL(15,2),
    son_piyasa_fiyat DECIMAL(15,2),
    fark_yuzde DECIMAL(5,2),
    durum VARCHAR(20) DEFAULT 'bilinmiyor', -- ucuz, pahali, normal, bilinmiyor
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_piyasa_gecmis_urun ON piyasa_fiyat_gecmisi(urun_adi);
CREATE INDEX IF NOT EXISTS idx_piyasa_gecmis_tarih ON piyasa_fiyat_gecmisi(arastirma_tarihi DESC);
CREATE INDEX IF NOT EXISTS idx_piyasa_gecmis_stok ON piyasa_fiyat_gecmisi(stok_kart_id);

CREATE INDEX IF NOT EXISTS idx_piyasa_takip_aktif ON piyasa_takip_listesi(aktif);
CREATE INDEX IF NOT EXISTS idx_piyasa_takip_durum ON piyasa_takip_listesi(durum);
CREATE INDEX IF NOT EXISTS idx_piyasa_takip_stok ON piyasa_takip_listesi(stok_kart_id);

-- Güncelleme trigger'ı
CREATE OR REPLACE FUNCTION update_piyasa_takip_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_piyasa_takip_updated ON piyasa_takip_listesi;
CREATE TRIGGER trg_piyasa_takip_updated
    BEFORE UPDATE ON piyasa_takip_listesi
    FOR EACH ROW
    EXECUTE FUNCTION update_piyasa_takip_timestamp();

-- Yorum
COMMENT ON TABLE piyasa_fiyat_gecmisi IS 'AI piyasa fiyat araştırma geçmişi';
COMMENT ON TABLE piyasa_takip_listesi IS 'Kullanıcının takip ettiği ürünlerin piyasa fiyat listesi';

