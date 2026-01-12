-- Teklifler tablosu
-- Teklif oluşturma ve maliyet hesaplama sistemi

CREATE TABLE IF NOT EXISTS teklifler (
    id SERIAL PRIMARY KEY,
    
    -- İhale bilgileri
    ihale_id INTEGER REFERENCES tenders(id) ON DELETE SET NULL,
    ihale_adi TEXT NOT NULL,
    ihale_kayit_no VARCHAR(50),
    
    -- Maliyet özeti
    maliyet_toplam DECIMAL(15,2) DEFAULT 0,
    kar_orani DECIMAL(5,2) DEFAULT 12.00,
    kar_tutari DECIMAL(15,2) DEFAULT 0,
    teklif_fiyati DECIMAL(15,2) DEFAULT 0,
    
    -- Maliyet kalemleri detayı (8 kalem)
    maliyet_detay JSONB DEFAULT '{
        "malzeme": {"tutar": 0, "detay": {}},
        "personel": {"tutar": 0, "detay": {}},
        "nakliye": {"tutar": 0, "detay": {}},
        "sarf_malzeme": {"tutar": 0, "detay": {}},
        "ekipman_bakim": {"tutar": 0, "detay": {}},
        "genel_gider": {"tutar": 0, "detay": {}},
        "yasal_giderler": {"tutar": 0, "detay": {}},
        "risk_payi": {"tutar": 0, "oran": 5}
    }'::jsonb,
    
    -- Birim fiyat teklif cetveli
    birim_fiyat_cetveli JSONB DEFAULT '[]'::jsonb,
    
    -- Cetvel toplamı (karşılaştırma için)
    cetvel_toplami DECIMAL(15,2) DEFAULT 0,
    
    -- Durum
    durum VARCHAR(20) DEFAULT 'taslak' CHECK (durum IN ('taslak', 'tamamlandi', 'gonderildi', 'kazanildi', 'kaybedildi')),
    
    -- Notlar
    notlar TEXT,
    
    -- Zaman damgaları
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_teklifler_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_teklifler_updated_at ON teklifler;
CREATE TRIGGER trigger_teklifler_updated_at
    BEFORE UPDATE ON teklifler
    FOR EACH ROW
    EXECUTE FUNCTION update_teklifler_updated_at();

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_teklifler_ihale_id ON teklifler(ihale_id);
CREATE INDEX IF NOT EXISTS idx_teklifler_durum ON teklifler(durum);
CREATE INDEX IF NOT EXISTS idx_teklifler_created_at ON teklifler(created_at DESC);

COMMENT ON TABLE teklifler IS 'İhale teklif hesaplamaları ve birim fiyat cetvelleri';

