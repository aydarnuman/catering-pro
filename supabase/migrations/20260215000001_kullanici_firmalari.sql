-- Kullanıcı-Firma ilişki tablosu
-- Bir kullanıcı birden fazla firmaya atanabilir
-- Login sırasında firma seçimi yapılır

CREATE TABLE IF NOT EXISTS kullanici_firmalari (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    firma_id INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, firma_id)
);

CREATE INDEX IF NOT EXISTS idx_kf_user ON kullanici_firmalari(user_id) WHERE aktif = true;
CREATE INDEX IF NOT EXISTS idx_kf_firma ON kullanici_firmalari(firma_id);

-- Geçiş dönemi: Mevcut tüm aktif kullanıcıları mevcut tüm aktif firmalara ata
INSERT INTO kullanici_firmalari (user_id, firma_id)
SELECT u.id, f.id
FROM users u
CROSS JOIN firmalar f
WHERE u.is_active = true AND f.aktif = true
ON CONFLICT (user_id, firma_id) DO NOTHING;
