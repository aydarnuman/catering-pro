-- Yüklenici İhaleleri - Ek Kolonlar
-- Yaklaşık maliyet, iş başlangıç/bitiş tarihleri ve katilimci rolü desteği

-- Yaklaşık maliyet (ihale kartından çekilen tahmini bedel)
ALTER TABLE yuklenici_ihaleleri
ADD COLUMN IF NOT EXISTS yaklasik_maliyet NUMERIC(15,2);

-- İş başlangıç tarihi
ALTER TABLE yuklenici_ihaleleri
ADD COLUMN IF NOT EXISTS is_baslangic DATE;

-- İş bitiş tarihi
ALTER TABLE yuklenici_ihaleleri
ADD COLUMN IF NOT EXISTS is_bitis DATE;

-- rol CHECK constraint'ini güncelle: 'katilimci' zaten var ama 'kik_karari' rolünü de ekle
-- Mevcut constraint'i kaldır ve yeniden oluştur
ALTER TABLE yuklenici_ihaleleri DROP CONSTRAINT IF EXISTS yuklenici_ihaleleri_rol_check;
ALTER TABLE yuklenici_ihaleleri ADD CONSTRAINT yuklenici_ihaleleri_rol_check 
  CHECK (rol IN ('yuklenici', 'katilimci', 'ortak_girisim', 'kik_karari'));

COMMENT ON COLUMN yuklenici_ihaleleri.yaklasik_maliyet IS 'İhalenin yaklaşık maliyeti (ihale kartından)';
COMMENT ON COLUMN yuklenici_ihaleleri.is_baslangic IS 'İş başlangıç tarihi';
COMMENT ON COLUMN yuklenici_ihaleleri.is_bitis IS 'İş bitiş tarihi';
