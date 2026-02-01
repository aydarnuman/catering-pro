-- =============================================
-- İHALE SONUÇLARI TABLOSU
-- İhale açıklandıktan sonraki süreç yönetimi
-- =============================================

-- Ana tablo
CREATE TABLE IF NOT EXISTS ihale_sonuclari (
    id SERIAL PRIMARY KEY,
    
    -- Bağlantı (opsiyonel - manuel eklenenlerde NULL olabilir)
    tender_id INTEGER REFERENCES tenders(id) ON DELETE SET NULL,
    
    -- İhale Temel Bilgileri
    ihale_basligi TEXT NOT NULL,
    kurum TEXT NOT NULL,
    ihale_kayit_no VARCHAR(50), -- İKN
    ihale_turu VARCHAR(50) DEFAULT 'hizmet', -- hizmet, mal, yapim
    
    -- Sonuç Bilgileri (ihale açıklandıktan sonra)
    yaklasik_maliyet DECIMAL(15,2),
    sinir_deger DECIMAL(15,2),
    bizim_teklif DECIMAL(15,2),
    bizim_sira INTEGER, -- Kaçıncı sıradayız
    
    -- Rakip Teklifler
    -- [{firma: "ABC Gıda Ltd.", teklif: 12500000, sira: 1, asiri_dusuk: true}, ...]
    diger_teklifler JSONB DEFAULT '[]'::jsonb,
    
    -- Teklif sayısı (otomatik hesaplanabilir ama hızlı erişim için)
    toplam_teklif_sayisi INTEGER DEFAULT 0,
    
    -- Kritik Tarihler
    ihale_tarihi DATE,
    kesinlesme_tarihi DATE,
    asiri_dusuk_sorgu_tarihi DATE,
    asiri_dusuk_cevap_tarihi DATE,
    itiraz_son_tarihi DATE,
    
    -- Durum
    durum VARCHAR(30) DEFAULT 'beklemede',
    -- beklemede: Sonuç bekleniyor
    -- asiri_dusuk_soruldu: Aşırı düşük açıklama istendi
    -- asiri_dusuk_cevaplandi: Açıklama verildi
    -- kazandik: İhale kazanıldı
    -- elendik: Teklif elendi
    -- itiraz_edildi: İdareye şikayet yapıldı
    -- kik_basvurusu: KİK'e itirazen şikayet yapıldı
    -- sonuclandi: Süreç tamamlandı
    
    -- Aşırı Düşük Bilgileri
    asiri_dusuk_aciklama_durumu VARCHAR(30), -- bekliyor, hazirlaniyor, gonderildi, kabul, red
    asiri_dusuk_aciklama_metni TEXT,
    
    -- Hesaplama Sonuçları (cache)
    hesaplamalar JSONB DEFAULT '{}'::jsonb,
    -- {
    --   sinir_deger_hesabi: {tort1, stdSapma, tort2, c, k, sonuc},
    --   asiri_dusuk_oran: 0.85,
    --   itiraz_suresi: {son_tarih, kalan_gun},
    --   kik_bedeli: 50640
    -- }
    
    -- Belgeler
    -- [{ad: "asiri_dusuk_aciklama.pdf", url: "/uploads/...", tip: "asiri_dusuk", tarih: "2025-01-10"}, ...]
    belgeler JSONB DEFAULT '[]'::jsonb,
    
    -- Notlar
    notlar TEXT,
    
    -- AI Sohbet Geçmişi (opsiyonel)
    ai_sohbet_gecmisi JSONB DEFAULT '[]'::jsonb,
    
    -- Meta
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- İndeksler
CREATE INDEX idx_ihale_sonuclari_tender_id ON ihale_sonuclari(tender_id);
CREATE INDEX idx_ihale_sonuclari_durum ON ihale_sonuclari(durum);
CREATE INDEX idx_ihale_sonuclari_kesinlesme ON ihale_sonuclari(kesinlesme_tarihi);
CREATE INDEX idx_ihale_sonuclari_kurum ON ihale_sonuclari(kurum);
CREATE INDEX idx_ihale_sonuclari_created ON ihale_sonuclari(created_at DESC);

-- GIN index for JSONB search
CREATE INDEX idx_ihale_sonuclari_teklifler ON ihale_sonuclari USING GIN (diger_teklifler);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_ihale_sonuclari_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ihale_sonuclari_updated_at
    BEFORE UPDATE ON ihale_sonuclari
    FOR EACH ROW
    EXECUTE FUNCTION update_ihale_sonuclari_updated_at();

-- Teklif sayısı otomatik güncelleme trigger
CREATE OR REPLACE FUNCTION update_ihale_sonuclari_teklif_sayisi()
RETURNS TRIGGER AS $$
BEGIN
    NEW.toplam_teklif_sayisi = jsonb_array_length(COALESCE(NEW.diger_teklifler, '[]'::jsonb));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ihale_sonuclari_teklif_sayisi
    BEFORE INSERT OR UPDATE OF diger_teklifler ON ihale_sonuclari
    FOR EACH ROW
    EXECUTE FUNCTION update_ihale_sonuclari_teklif_sayisi();

-- View: Aktif süreçler (itiraz süresi dolmamış)
CREATE OR REPLACE VIEW aktif_ihale_surecleri AS
SELECT 
    s.*,
    t.url as ihale_url,
    t.city as ihale_sehir,
    CASE 
        WHEN s.kesinlesme_tarihi IS NOT NULL 
        THEN s.kesinlesme_tarihi + INTERVAL '10 days'
        ELSE NULL 
    END as sikayet_son_tarih,
    CASE 
        WHEN s.kesinlesme_tarihi IS NOT NULL 
        THEN (s.kesinlesme_tarihi + INTERVAL '10 days')::date - CURRENT_DATE
        ELSE NULL 
    END as kalan_gun
FROM ihale_sonuclari s
LEFT JOIN tenders t ON s.tender_id = t.id
WHERE s.durum NOT IN ('sonuclandi', 'kazandik')
ORDER BY 
    CASE WHEN s.kesinlesme_tarihi IS NOT NULL 
         THEN s.kesinlesme_tarihi + INTERVAL '10 days' 
         ELSE '9999-12-31'::date 
    END ASC;

-- View: İhale sonuç istatistikleri
CREATE OR REPLACE VIEW ihale_sonuc_istatistikleri AS
SELECT 
    COUNT(*) as toplam,
    COUNT(*) FILTER (WHERE durum = 'beklemede') as beklemede,
    COUNT(*) FILTER (WHERE durum LIKE 'asiri_dusuk%') as asiri_dusuk,
    COUNT(*) FILTER (WHERE durum = 'kazandik') as kazanilan,
    COUNT(*) FILTER (WHERE durum = 'elendik') as elenen,
    COUNT(*) FILTER (WHERE durum IN ('itiraz_edildi', 'kik_basvurusu')) as itiraz,
    SUM(bizim_teklif) FILTER (WHERE durum = 'kazandik') as kazanilan_toplam_tutar,
    AVG(bizim_sira) FILTER (WHERE bizim_sira IS NOT NULL) as ortalama_sira
FROM ihale_sonuclari;

-- Comment
COMMENT ON TABLE ihale_sonuclari IS 'İhale açıklandıktan sonraki süreç yönetimi - sonuçlar, itirazlar, aşırı düşük açıklamalar';
COMMENT ON COLUMN ihale_sonuclari.diger_teklifler IS 'Rakip firmaların teklifleri - JSONB array [{firma, teklif, sira, asiri_dusuk}]';
COMMENT ON COLUMN ihale_sonuclari.hesaplamalar IS 'Yapılan hesaplamaların cache''i - sınır değer, aşırı düşük oran vs.';
