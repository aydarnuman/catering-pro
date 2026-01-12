-- ====================================================
-- Migration 029: Görevler Tablosu
-- Proje personellerinin görev tanımları için
-- ====================================================

-- Görevler tablosu
CREATE TABLE IF NOT EXISTS gorevler (
    id SERIAL PRIMARY KEY,
    ad VARCHAR(100) NOT NULL UNIQUE,
    kod VARCHAR(20),
    aciklama TEXT,
    renk VARCHAR(20) DEFAULT '#6366f1',
    ikon VARCHAR(50) DEFAULT 'briefcase',
    
    -- Puantaj için (ileride kullanılacak)
    saat_ucreti DECIMAL(10,2) DEFAULT 0,
    gunluk_ucret DECIMAL(10,2) DEFAULT 0,
    
    -- Sıralama ve durum
    sira INTEGER DEFAULT 0,
    aktif BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Varsayılan görevleri ekle
INSERT INTO gorevler (ad, kod, ikon, renk, sira) VALUES 
    ('Aşçıbaşı', 'ASCIBASI', 'chef-hat', '#ef4444', 1),
    ('Aşçı', 'ASCI', 'chef-hat', '#f97316', 2),
    ('Aşçı Yardımcısı', 'ASCI_YRD', 'chef-hat', '#fb923c', 3),
    ('Garson', 'GARSON', 'utensils', '#22c55e', 4),
    ('Komi', 'KOMI', 'utensils', '#86efac', 5),
    ('Bulaşıkçı', 'BULASIKCI', 'droplet', '#3b82f6', 6),
    ('Temizlik Personeli', 'TEMIZLIK', 'spray', '#60a5fa', 7),
    ('Depo Sorumlusu', 'DEPO', 'package', '#8b5cf6', 8),
    ('Satın Alma', 'SATIN_ALMA', 'shopping-cart', '#a855f7', 9),
    ('Muhasebe', 'MUHASEBE', 'calculator', '#ec4899', 10),
    ('Yönetici', 'YONETICI', 'user-cog', '#14b8a6', 11),
    ('Şoför', 'SOFOR', 'truck', '#64748b', 12),
    ('Kalite Kontrol', 'KALITE', 'clipboard-check', '#06b6d4', 13),
    ('Diğer', 'DIGER', 'dots', '#9ca3af', 99)
ON CONFLICT (ad) DO NOTHING;

-- proje_personelleri tablosuna gorev_id ekle
ALTER TABLE proje_personelleri 
    ADD COLUMN IF NOT EXISTS gorev_id INTEGER REFERENCES gorevler(id) ON DELETE SET NULL;

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_gorevler_aktif ON gorevler(aktif);
CREATE INDEX IF NOT EXISTS idx_gorevler_sira ON gorevler(sira);
CREATE INDEX IF NOT EXISTS idx_proje_personel_gorev ON proje_personelleri(gorev_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_gorevler_updated_at ON gorevler;
CREATE TRIGGER update_gorevler_updated_at 
    BEFORE UPDATE ON gorevler
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ====================================================
-- Migration tamamlandı!
-- ====================================================

