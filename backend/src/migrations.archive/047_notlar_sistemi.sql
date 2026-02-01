-- Notlar/Ajanda Sistemi
-- Kullanıcıların kişisel notlarını ve yapılacaklar listesini yönetir

-- Notlar tablosu
CREATE TABLE IF NOT EXISTS notlar (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    priority VARCHAR(10) DEFAULT 'normal', -- low, normal, high
    color VARCHAR(20) DEFAULT 'blue', -- blue, green, orange, red, violet
    due_date DATE, -- Opsiyonel son tarih
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_notlar_user_id ON notlar(user_id);
CREATE INDEX IF NOT EXISTS idx_notlar_is_completed ON notlar(is_completed);
CREATE INDEX IF NOT EXISTS idx_notlar_due_date ON notlar(due_date);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_notlar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notlar_updated_at ON notlar;
CREATE TRIGGER trigger_notlar_updated_at
    BEFORE UPDATE ON notlar
    FOR EACH ROW
    EXECUTE FUNCTION update_notlar_updated_at();

-- Örnek veri (opsiyonel, silinebilir)
-- INSERT INTO notlar (user_id, content, priority, color) VALUES
-- (1, 'Ankara ihalesi için dökümanları hazırla', 'high', 'red'),
-- (1, 'Tedarikçi toplantısı planla', 'normal', 'blue'),
-- (1, 'Menü planlamasını gözden geçir', 'normal', 'green');
