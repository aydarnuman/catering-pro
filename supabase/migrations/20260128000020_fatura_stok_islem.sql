-- Faturadan stok işleme takip tablosu
CREATE TABLE IF NOT EXISTS fatura_stok_islem (
    id SERIAL PRIMARY KEY,
    uyumsoft_invoice_id INTEGER REFERENCES uyumsoft_invoices(id),
    ettn VARCHAR(100) NOT NULL,
    depo_id INTEGER REFERENCES depolar(id),
    islem_tarihi TIMESTAMP DEFAULT NOW(),
    isleyen_kullanici VARCHAR(100),
    toplam_kalem INTEGER DEFAULT 0,
    toplam_tutar DECIMAL(15,2) DEFAULT 0,
    notlar TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Fatura kalem-stok eşleştirme geçmişi (otomatik eşleştirme için)
CREATE TABLE IF NOT EXISTS fatura_urun_eslestirme (
    id SERIAL PRIMARY KEY,
    tedarikci_urun_kodu VARCHAR(100),
    tedarikci_urun_adi VARCHAR(500),
    stok_kart_id INTEGER REFERENCES stok_kartlari(id),
    eslestirme_sayisi INTEGER DEFAULT 1,
    son_eslestirme TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tedarikci_urun_kodu, stok_kart_id)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_fatura_stok_islem_ettn ON fatura_stok_islem(ettn);
CREATE INDEX IF NOT EXISTS idx_fatura_stok_islem_invoice_id ON fatura_stok_islem(uyumsoft_invoice_id);
CREATE INDEX IF NOT EXISTS idx_fatura_urun_eslestirme_kod ON fatura_urun_eslestirme(tedarikci_urun_kodu);
CREATE INDEX IF NOT EXISTS idx_fatura_urun_eslestirme_adi ON fatura_urun_eslestirme(tedarikci_urun_adi);

-- stok_hareketleri tablosuna fatura referansı ekle
ALTER TABLE stok_hareketleri 
ADD COLUMN IF NOT EXISTS fatura_ettn VARCHAR(100),
ADD COLUMN IF NOT EXISTS fatura_kalem_sira INTEGER;

COMMENT ON TABLE fatura_stok_islem IS 'Stok olarak işlenmiş faturaların kaydı';
COMMENT ON TABLE fatura_urun_eslestirme IS 'Tedarikçi ürün kodu/adı ile stok kartı eşleştirme geçmişi';

