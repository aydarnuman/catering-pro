-- ====================================================
-- ÇEK/SENET YÖNETİM SİSTEMİ
-- Migration 026
-- ====================================================

-- ====================================================
-- 1. ÇEK/SENET ANA TABLOSU
-- ====================================================
CREATE TABLE IF NOT EXISTS cek_senetler (
    id SERIAL PRIMARY KEY,
    
    -- Temel bilgiler
    tip VARCHAR(10) NOT NULL CHECK (tip IN ('cek', 'senet')),
    yonu VARCHAR(10) NOT NULL CHECK (yonu IN ('alinan', 'verilen')),
    durum VARCHAR(20) DEFAULT 'beklemede' CHECK (durum IN (
        'beklemede',      -- Henüz vadesi gelmemiş
        'tahsil_edildi',  -- Banka tahsil etti
        'odendi',         -- Verilen çek/senet ödendi
        'ciro_edildi',    -- Başkasına ciro edildi
        'iade_edildi',    -- Karşılıksız/iade
        'iptal'           -- İptal edildi
    )),
    
    -- Belge bilgileri
    belge_no VARCHAR(50) NOT NULL,  -- Çek/Senet numarası
    seri_no VARCHAR(20),            -- Seri numarası
    
    -- Tutar bilgileri
    tutar DECIMAL(15,2) NOT NULL,
    doviz VARCHAR(3) DEFAULT 'TRY',
    
    -- Tarihler
    kesim_tarihi DATE NOT NULL,     -- Düzenleme tarihi
    vade_tarihi DATE NOT NULL,      -- Vade tarihi
    
    -- Banka bilgileri (çek için)
    banka_adi VARCHAR(100),
    sube_adi VARCHAR(100),
    sube_kodu VARCHAR(20),
    hesap_no VARCHAR(50),
    
    -- Düzenleyen/Muhatap bilgileri
    kesen_unvan VARCHAR(255) NOT NULL,  -- Kim keşide etti
    kesen_vkn_tckn VARCHAR(20),         -- VKN veya TCKN
    
    -- Cari bağlantısı
    cari_id INTEGER REFERENCES cariler(id) ON DELETE SET NULL,
    
    -- Ciro bilgileri
    cirolu_mu BOOLEAN DEFAULT FALSE,
    ciro_edilen_cari_id INTEGER REFERENCES cariler(id) ON DELETE SET NULL,
    ciro_tarihi DATE,
    ciro_aciklama TEXT,
    
    -- Tahsilat/Ödeme bilgileri
    islem_tarihi DATE,                  -- Tahsil/ödeme tarihi
    islem_hesap_id INTEGER REFERENCES kasa_banka_hesaplari(id) ON DELETE SET NULL,
    
    -- İade/İptal bilgileri
    iade_nedeni TEXT,
    iptal_nedeni TEXT,
    
    -- Notlar
    notlar TEXT,
    
    -- Metadata
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_cek_senet_tip ON cek_senetler(tip);
CREATE INDEX IF NOT EXISTS idx_cek_senet_yonu ON cek_senetler(yonu);
CREATE INDEX IF NOT EXISTS idx_cek_senet_durum ON cek_senetler(durum);
CREATE INDEX IF NOT EXISTS idx_cek_senet_vade ON cek_senetler(vade_tarihi);
CREATE INDEX IF NOT EXISTS idx_cek_senet_cari ON cek_senetler(cari_id);
CREATE INDEX IF NOT EXISTS idx_cek_senet_belge ON cek_senetler(belge_no);

-- Beklemedeki çekler için partial index
CREATE INDEX IF NOT EXISTS idx_cek_senet_beklemede ON cek_senetler(vade_tarihi) 
    WHERE durum = 'beklemede';

-- ====================================================
-- 2. ÇEK/SENET HAREKET GEÇMİŞİ
-- ====================================================
CREATE TABLE IF NOT EXISTS cek_senet_hareketler (
    id SERIAL PRIMARY KEY,
    cek_senet_id INTEGER NOT NULL REFERENCES cek_senetler(id) ON DELETE CASCADE,
    
    -- Hareket bilgileri
    islem_tipi VARCHAR(30) NOT NULL CHECK (islem_tipi IN (
        'kayit',          -- İlk kayıt
        'tahsilat',       -- Bankadan tahsil
        'odeme',          -- Verilen çek/senet ödeme
        'ciro',           -- Ciro işlemi
        'iade',           -- İade
        'iptal',          -- İptal
        'guncelleme'      -- Bilgi güncelleme
    )),
    
    -- Detaylar
    aciklama TEXT,
    eski_durum VARCHAR(20),
    yeni_durum VARCHAR(20),
    
    -- İlişkili hesap (tahsilat/ödeme için)
    hesap_id INTEGER REFERENCES kasa_banka_hesaplari(id) ON DELETE SET NULL,
    
    -- Ciro için hedef cari
    hedef_cari_id INTEGER REFERENCES cariler(id) ON DELETE SET NULL,
    
    -- Metadata
    islem_tarihi TIMESTAMP DEFAULT NOW(),
    kullanici VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cek_senet_hareket_cek ON cek_senet_hareketler(cek_senet_id);
CREATE INDEX IF NOT EXISTS idx_cek_senet_hareket_tarih ON cek_senet_hareketler(islem_tarihi DESC);

-- ====================================================
-- 3. GÖRÜNÜMLER (VIEWS)
-- ====================================================

-- Çek/Senet Özet Görünümü
CREATE OR REPLACE VIEW cek_senet_ozet AS
SELECT 
    tip,
    yonu,
    durum,
    COUNT(*) as adet,
    SUM(tutar) as toplam_tutar,
    SUM(CASE WHEN vade_tarihi < CURRENT_DATE AND durum = 'beklemede' THEN tutar ELSE 0 END) as vadesi_gecmis_tutar,
    SUM(CASE WHEN vade_tarihi BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' AND durum = 'beklemede' THEN tutar ELSE 0 END) as bu_hafta_vadesi_gelen
FROM cek_senetler
GROUP BY tip, yonu, durum;

-- Yaklaşan Vadeler Görünümü
CREATE OR REPLACE VIEW yaklasan_vadeler AS
SELECT 
    cs.*,
    c.unvan as cari_unvan,
    c.telefon as cari_telefon,
    CASE 
        WHEN vade_tarihi < CURRENT_DATE THEN 'gecmis'
        WHEN vade_tarihi = CURRENT_DATE THEN 'bugun'
        WHEN vade_tarihi <= CURRENT_DATE + INTERVAL '7 days' THEN 'bu_hafta'
        WHEN vade_tarihi <= CURRENT_DATE + INTERVAL '30 days' THEN 'bu_ay'
        ELSE 'ileri'
    END as vade_durumu,
    vade_tarihi - CURRENT_DATE as kalan_gun
FROM cek_senetler cs
LEFT JOIN cariler c ON c.id = cs.cari_id
WHERE cs.durum = 'beklemede'
ORDER BY cs.vade_tarihi ASC;

-- ====================================================
-- 4. TRIGGER'LAR
-- ====================================================

-- Updated_at otomatik güncelleme
CREATE TRIGGER update_cek_senetler_updated_at 
    BEFORE UPDATE ON cek_senetler
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Çek/Senet tahsil edildiğinde kasa/banka bakiyesine ekle
CREATE OR REPLACE FUNCTION cek_senet_tahsilat_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Sadece durum 'tahsil_edildi' veya 'odendi' olduğunda
    IF NEW.durum IN ('tahsil_edildi', 'odendi') AND OLD.durum = 'beklemede' THEN
        -- İşlem hesabı varsa bakiyeyi güncelle
        IF NEW.islem_hesap_id IS NOT NULL THEN
            IF NEW.yonu = 'alinan' THEN
                -- Alınan çek tahsil edildi = Hesaba giriş
                INSERT INTO kasa_banka_hareketleri (
                    hesap_id, hareket_tipi, tutar, aciklama, belge_no, tarih
                ) VALUES (
                    NEW.islem_hesap_id,
                    'giris',
                    NEW.tutar,
                    NEW.tip || ' tahsilatı: ' || NEW.belge_no || ' - ' || NEW.kesen_unvan,
                    NEW.belge_no,
                    COALESCE(NEW.islem_tarihi, CURRENT_DATE)
                );
            ELSIF NEW.yonu = 'verilen' THEN
                -- Verilen çek ödendi = Hesaptan çıkış
                INSERT INTO kasa_banka_hareketleri (
                    hesap_id, hareket_tipi, tutar, aciklama, belge_no, tarih
                ) VALUES (
                    NEW.islem_hesap_id,
                    'cikis',
                    NEW.tutar,
                    NEW.tip || ' ödemesi: ' || NEW.belge_no,
                    NEW.belge_no,
                    COALESCE(NEW.islem_tarihi, CURRENT_DATE)
                );
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cek_senet_tahsilat_bakiye
    AFTER UPDATE ON cek_senetler
    FOR EACH ROW EXECUTE FUNCTION cek_senet_tahsilat_trigger();

-- ====================================================
-- 5. ROW LEVEL SECURITY
-- ====================================================
ALTER TABLE cek_senetler ENABLE ROW LEVEL SECURITY;
ALTER TABLE cek_senet_hareketler ENABLE ROW LEVEL SECURITY;

-- Tüm kullanıcılara erişim (service key kullanıldığı için)
CREATE POLICY "Enable all access for service role" ON cek_senetler
    FOR ALL USING (true);

CREATE POLICY "Enable all access for service role" ON cek_senet_hareketler
    FOR ALL USING (true);

-- ====================================================
-- Migration tamamlandı!
-- ====================================================

