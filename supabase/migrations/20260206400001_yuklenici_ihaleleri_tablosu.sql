-- =====================================================
-- Yüklenici Kütüphanesi: Yüklenici-İhale İlişki Tablosu
-- Bir yüklenicinin katıldığı/kazandığı ihalelerin kaydı
-- =====================================================

CREATE TABLE IF NOT EXISTS yuklenici_ihaleleri (
    id SERIAL PRIMARY KEY,
    
    -- İlişkiler
    yuklenici_id INTEGER NOT NULL REFERENCES yukleniciler(id) ON DELETE CASCADE,
    tender_id INTEGER REFERENCES tenders(id) ON DELETE SET NULL,
    
    -- İhale bilgileri (tender_id NULL olsa bile bilgi tutulabilsin)
    ihale_basligi TEXT,
    kurum_adi TEXT,
    sehir TEXT,
    
    -- Finansal bilgiler
    sozlesme_bedeli NUMERIC(15,2),
    sozlesme_tarihi DATE,
    indirim_orani NUMERIC(5,2),
    
    -- Katılım bilgileri
    rol TEXT DEFAULT 'yuklenici' CHECK (rol IN ('yuklenici', 'katilimci', 'ortak_girisim')),
    durum TEXT DEFAULT 'tamamlandi' CHECK (durum IN ('tamamlandi', 'devam', 'iptal', 'bilinmiyor')),
    fesih_durumu TEXT,  -- 'Yok', 'Var', veya açıklama metni
    
    -- Referans
    ikn TEXT,
    
    -- Zaman
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Aynı yüklenici + aynı ihale + aynı rol = tekil kayıt
    UNIQUE(yuklenici_id, tender_id, rol)
);

-- === İndeksler ===
CREATE INDEX IF NOT EXISTS idx_yi_yuklenici_id ON yuklenici_ihaleleri(yuklenici_id);
CREATE INDEX IF NOT EXISTS idx_yi_tender_id ON yuklenici_ihaleleri(tender_id) WHERE tender_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_yi_sehir ON yuklenici_ihaleleri(sehir) WHERE sehir IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_yi_rol ON yuklenici_ihaleleri(rol);
CREATE INDEX IF NOT EXISTS idx_yi_durum ON yuklenici_ihaleleri(durum);
CREATE INDEX IF NOT EXISTS idx_yi_sozlesme_tarihi ON yuklenici_ihaleleri(sozlesme_tarihi DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_yi_fesih ON yuklenici_ihaleleri(fesih_durumu) WHERE fesih_durumu IS NOT NULL AND fesih_durumu != 'Yok';

COMMENT ON TABLE yuklenici_ihaleleri IS 'Yüklenicilerin ihale geçmişi — katıldığı, kazandığı veya kaybettiği ihaleler';
COMMENT ON COLUMN yuklenici_ihaleleri.rol IS 'yuklenici: ihaleyi kazanan firma, katilimci: ihaleye teklif veren firma, ortak_girisim: ortak girişim ortağı';
