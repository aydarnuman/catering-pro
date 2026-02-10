-- =====================================================
-- Yüklenici İstihbarat Merkezi: Modül Durum Takip Tablosu
-- Her yüklenici için 8 farklı istihbarat modülünün
-- durumunu, verisini ve son güncelleme zamanını saklar.
--
-- Modüller:
--   1. ihale_gecmisi    → ihalebul.com ihale geçmişi (mevcut scraper)
--   2. profil_analizi   → ihalebul.com analiz sayfası (mevcut scraper)
--   3. katilimcilar     → ihalebul.com katılımcı bilgileri (mevcut scraper)
--   4. kik_kararlari    → ihalebul.com KİK kararları (mevcut scraper)
--   5. kik_yasaklilar   → EKAP yasaklı firma sorgusu (YENİ)
--   6. sirket_bilgileri  → MERSİS + Ticaret Sicil Gazetesi (YENİ)
--   7. haberler         → Google News RSS haber taraması (YENİ)
--   8. ai_arastirma     → Claude AI istihbarat raporu (YENİ)
-- =====================================================

CREATE TABLE IF NOT EXISTS yuklenici_istihbarat (
    id SERIAL PRIMARY KEY,

    -- Hangi yükleniciye ait
    yuklenici_id INTEGER NOT NULL
        REFERENCES yukleniciler(id) ON DELETE CASCADE,

    -- Modül adı (yukarıdaki 8 modülden biri)
    modul TEXT NOT NULL,

    -- Çalışma durumu
    --   bekliyor   : Henüz hiç çalıştırılmadı
    --   calisiyor  : Şu anda arka planda çalışıyor
    --   tamamlandi : Başarıyla tamamlandı, veri mevcut
    --   hata       : Hata oluştu, hata_mesaji alanında detay var
    durum TEXT NOT NULL DEFAULT 'bekliyor'
        CHECK (durum IN ('bekliyor', 'calisiyor', 'tamamlandi', 'hata')),

    -- Son başarılı güncelleme zamanı
    son_guncelleme TIMESTAMP,

    -- Modüle özel veri (JSONB)
    -- ihalebul modülleri: boş veya özet istatistik
    -- Yeni modüller: tüm çekilen veri burada saklanır
    veri JSONB DEFAULT '{}'::jsonb,

    -- Hata durumunda açıklama mesajı
    hata_mesaji TEXT,

    -- Zaman damgaları
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Her yüklenici için her modül tek satır
    UNIQUE(yuklenici_id, modul)
);

-- === İndeksler ===

-- Yükleniciye göre tüm modülleri hızlı çekmek için
CREATE INDEX IF NOT EXISTS idx_yi_yuklenici
    ON yuklenici_istihbarat(yuklenici_id);

-- Belirli bir modülün tüm yüklenicilerdeki durumunu sorgulamak için
-- Örnek: "Hangi yüklenicilerin haber modülü eski?"
CREATE INDEX IF NOT EXISTS idx_yi_modul
    ON yuklenici_istihbarat(modul);

-- Çalışan modülleri hızlı bulmak için
CREATE INDEX IF NOT EXISTS idx_yi_calisiyor
    ON yuklenici_istihbarat(durum)
    WHERE durum = 'calisiyor';

-- === Açıklamalar ===

COMMENT ON TABLE yuklenici_istihbarat IS
    'Yüklenici İstihbarat Merkezi: Her yüklenici × modül kombinasyonu için durum takibi ve veri saklama tablosu';

COMMENT ON COLUMN yuklenici_istihbarat.modul IS
    'İstihbarat modülü adı: ihale_gecmisi, profil_analizi, katilimcilar, kik_kararlari, kik_yasaklilar, sirket_bilgileri, haberler, ai_arastirma';

COMMENT ON COLUMN yuklenici_istihbarat.veri IS
    'Modüle özel JSON veri. ihalebul modülleri için özet (veri ana tablolarda), yeni modüller için tüm içerik burada saklanır';


-- =====================================================
-- Yüklenici Bildirimleri: Rakip Alarm Sistemi
-- Takipteki yüklenicilerde değişiklik olduğunda
-- otomatik bildirim oluşturur.
--
-- Bildirim tipleri:
--   yeni_ihale_kazanim  → Takipteki firma yeni ihale kazandı
--   yeni_sehir          → Firma yeni bir şehirde göründü
--   kik_sikayet         → Firmaya KİK şikayeti açıldı
--   yasaklama           → Firma yasaklılar listesine girdi
--   fesih               → Firmanın sözleşmesi feshedildi
--   fiyat_degisim       → İndirim oranında belirgin değişiklik
--   genel               → Diğer genel bildirimler
-- =====================================================

CREATE TABLE IF NOT EXISTS yuklenici_bildirimler (
    id SERIAL PRIMARY KEY,

    -- Hangi yükleniciyle ilgili
    yuklenici_id INTEGER NOT NULL
        REFERENCES yukleniciler(id) ON DELETE CASCADE,

    -- Bildirim tipi (yukarıdaki listeden)
    tip TEXT NOT NULL,

    -- Kısa başlık (bildirim listesinde görünecek)
    baslik TEXT NOT NULL,

    -- Detaylı açıklama (opsiyonel)
    icerik TEXT,

    -- Ek veri (ilgili ihale id'si, bedel vb.)
    meta JSONB DEFAULT '{}'::jsonb,

    -- Kullanıcı tarafından okundu mu
    okundu BOOLEAN DEFAULT false,

    -- Oluşturulma zamanı
    created_at TIMESTAMP DEFAULT NOW()
);

-- === İndeksler ===

-- Yükleniciye göre bildirimleri çekmek
CREATE INDEX IF NOT EXISTS idx_yb_yuklenici
    ON yuklenici_bildirimler(yuklenici_id);

-- Okunmamış bildirimleri hızlı saymak (bildirim zili badge'i için)
CREATE INDEX IF NOT EXISTS idx_yb_okunmamis
    ON yuklenici_bildirimler(okundu, created_at DESC)
    WHERE okundu = false;

-- Bildirim tipine göre filtreleme
CREATE INDEX IF NOT EXISTS idx_yb_tip
    ON yuklenici_bildirimler(tip);

-- === Açıklamalar ===

COMMENT ON TABLE yuklenici_bildirimler IS
    'Yüklenici İstihbarat Merkezi: Rakip alarm/bildirim sistemi — takipteki yüklenicilerde değişiklik olduğunda otomatik bildirim oluşturur';

COMMENT ON COLUMN yuklenici_bildirimler.tip IS
    'Bildirim tipi: yeni_ihale_kazanim, yeni_sehir, kik_sikayet, yasaklama, fesih, fiyat_degisim, genel';

COMMENT ON COLUMN yuklenici_bildirimler.meta IS
    'Ek bilgi — örnek: {"ihale_id": 123, "bedel": 5000000, "sehir": "Ankara"}';
