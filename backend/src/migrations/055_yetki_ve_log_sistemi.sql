-- =====================================================
-- YETKİ VE LOG SİSTEMİ
-- Rol bazlı erişim kontrolü (RBAC) ve audit logging
-- =====================================================

-- 1. KULLANICI TİPLERİ (Süper Admin, Admin, User)
-- users tablosuna user_type kolonu ekle
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'user';
-- user_type: 'super_admin', 'admin', 'user'

-- Mevcut admin'leri koru
UPDATE users SET user_type = 'admin' WHERE role = 'admin' AND user_type = 'user';

-- 2. MODÜL TANIMLARI
CREATE TABLE IF NOT EXISTS modules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,      -- ihale, fatura, cari, stok, personel, bordro, planlama, firma, ayarlar
  display_name VARCHAR(100) NOT NULL,     -- Türkçe görünen isim
  icon VARCHAR(50),                        -- Tabler icon adı
  color VARCHAR(20),                       -- Mantine renk
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Modülleri ekle
INSERT INTO modules (name, display_name, icon, color, sort_order) VALUES
  ('ihale', 'İhale Merkezi', 'IconFolder', 'blue', 1),
  ('fatura', 'Faturalar', 'IconReceipt', 'green', 2),
  ('cari', 'Cari Hesaplar', 'IconUsers', 'teal', 3),
  ('stok', 'Stok Takibi', 'IconPackage', 'orange', 4),
  ('personel', 'Personel', 'IconUserCircle', 'violet', 5),
  ('bordro', 'Bordro & Maaş', 'IconCash', 'pink', 6),
  ('kasa_banka', 'Kasa & Banka', 'IconWallet', 'cyan', 7),
  ('planlama', 'Menü Planlama', 'IconToolsKitchen2', 'yellow', 8),
  ('firma', 'Firma Bilgileri', 'IconBuilding', 'gray', 9),
  ('demirbas', 'Demirbaş/Envanter', 'IconBox', 'indigo', 10),
  ('rapor', 'Raporlar', 'IconChartBar', 'lime', 11),
  ('ayarlar', 'Sistem Ayarları', 'IconSettings', 'red', 12)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order;

-- 3. KULLANICI YETKİLERİ
CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT false,          -- Görüntüleme
  can_create BOOLEAN DEFAULT false,        -- Ekleme
  can_edit BOOLEAN DEFAULT false,          -- Düzenleme
  can_delete BOOLEAN DEFAULT false,        -- Silme
  can_export BOOLEAN DEFAULT false,        -- Dışa aktarma
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, module_id)
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_module ON user_permissions(module_id);

-- 4. İŞLEM GEÇMİŞİ (AUDIT LOG)
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(100),                  -- Kullanıcı silinse bile isim kalsın
  user_email VARCHAR(255),
  action VARCHAR(50) NOT NULL,             -- create, update, delete, login, logout, export, view
  entity_type VARCHAR(50) NOT NULL,        -- user, invoice, tender, cari, personel, stok, etc.
  entity_id INTEGER,                       -- İlgili kaydın ID'si
  entity_name VARCHAR(255),                -- Kaydın adı/başlığı (silinse bile görünsün)
  old_data JSONB,                          -- Değişiklik öncesi veriler
  new_data JSONB,                          -- Değişiklik sonrası veriler
  changes JSONB,                           -- Sadece değişen alanlar
  ip_address INET,
  user_agent TEXT,
  request_path TEXT,
  description TEXT,                        -- Okunabilir açıklama
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON audit_logs(DATE(created_at));

-- 5. YETKİ ŞABLONLARI (Hazır profiller)
CREATE TABLE IF NOT EXISTS permission_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,        -- muhasebe, ihale_sorumlusu, mutfak, satinalma, ik
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL,              -- {module_name: {view: true, create: false, ...}}
  is_system BOOLEAN DEFAULT false,         -- Sistem şablonu (silinemez)
  created_at TIMESTAMP DEFAULT NOW()
);

-- Varsayılan şablonları ekle
INSERT INTO permission_templates (name, display_name, description, permissions, is_system) VALUES
  ('muhasebe', 'Muhasebeci', 'Fatura, cari, kasa-banka işlemleri', '{
    "fatura": {"view": true, "create": true, "edit": true, "delete": true, "export": true},
    "cari": {"view": true, "create": true, "edit": true, "delete": true, "export": true},
    "kasa_banka": {"view": true, "create": true, "edit": true, "delete": true, "export": true},
    "bordro": {"view": true, "create": false, "edit": false, "delete": false, "export": true},
    "rapor": {"view": true, "create": false, "edit": false, "delete": false, "export": true},
    "stok": {"view": true, "create": false, "edit": false, "delete": false, "export": false}
  }', true),
  ('ihale_sorumlusu', 'İhale Sorumlusu', 'İhale takibi ve teklif hazırlama', '{
    "ihale": {"view": true, "create": true, "edit": true, "delete": true, "export": true},
    "firma": {"view": true, "create": false, "edit": false, "delete": false, "export": false},
    "rapor": {"view": true, "create": false, "edit": false, "delete": false, "export": true}
  }', true),
  ('mutfak', 'Mutfak/Üretim', 'Menü planlama ve reçete yönetimi', '{
    "planlama": {"view": true, "create": true, "edit": true, "delete": true, "export": true},
    "stok": {"view": true, "create": false, "edit": false, "delete": false, "export": false},
    "rapor": {"view": true, "create": false, "edit": false, "delete": false, "export": false}
  }', true),
  ('satinalma', 'Satın Alma', 'Stok ve tedarikçi yönetimi', '{
    "stok": {"view": true, "create": true, "edit": true, "delete": true, "export": true},
    "cari": {"view": true, "create": true, "edit": true, "delete": false, "export": true},
    "rapor": {"view": true, "create": false, "edit": false, "delete": false, "export": true}
  }', true),
  ('ik', 'İnsan Kaynakları', 'Personel ve izin yönetimi', '{
    "personel": {"view": true, "create": true, "edit": true, "delete": true, "export": true},
    "bordro": {"view": true, "create": false, "edit": false, "delete": false, "export": true},
    "rapor": {"view": true, "create": false, "edit": false, "delete": false, "export": true}
  }', true),
  ('tam_yetki', 'Tam Yetkili', 'Tüm modüllere tam erişim', '{
    "ihale": {"view": true, "create": true, "edit": true, "delete": true, "export": true},
    "fatura": {"view": true, "create": true, "edit": true, "delete": true, "export": true},
    "cari": {"view": true, "create": true, "edit": true, "delete": true, "export": true},
    "stok": {"view": true, "create": true, "edit": true, "delete": true, "export": true},
    "personel": {"view": true, "create": true, "edit": true, "delete": true, "export": true},
    "bordro": {"view": true, "create": true, "edit": true, "delete": true, "export": true},
    "kasa_banka": {"view": true, "create": true, "edit": true, "delete": true, "export": true},
    "planlama": {"view": true, "create": true, "edit": true, "delete": true, "export": true},
    "firma": {"view": true, "create": true, "edit": true, "delete": true, "export": true},
    "demirbas": {"view": true, "create": true, "edit": true, "delete": true, "export": true},
    "rapor": {"view": true, "create": true, "edit": true, "delete": true, "export": true},
    "ayarlar": {"view": true, "create": true, "edit": true, "delete": true, "export": true}
  }', true)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions;

-- 6. TRIGGER: user_permissions updated_at
CREATE OR REPLACE FUNCTION update_user_permissions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_permissions_updated ON user_permissions;
CREATE TRIGGER trg_user_permissions_updated
  BEFORE UPDATE ON user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_permissions_timestamp();

-- 7. FONKSİYON: Kullanıcıya şablon uygula
CREATE OR REPLACE FUNCTION apply_permission_template(p_user_id INTEGER, p_template_name VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  template_perms JSONB;
  module_rec RECORD;
  perm_obj JSONB;
  applied_count INTEGER := 0;
BEGIN
  -- Şablon izinlerini al
  SELECT permissions INTO template_perms 
  FROM permission_templates 
  WHERE name = p_template_name;
  
  IF template_perms IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Her modül için izinleri uygula
  FOR module_rec IN SELECT id, name FROM modules WHERE is_active = true LOOP
    perm_obj := template_perms -> module_rec.name;
    
    IF perm_obj IS NOT NULL THEN
      INSERT INTO user_permissions (user_id, module_id, can_view, can_create, can_edit, can_delete, can_export)
      VALUES (
        p_user_id,
        module_rec.id,
        COALESCE((perm_obj->>'view')::boolean, false),
        COALESCE((perm_obj->>'create')::boolean, false),
        COALESCE((perm_obj->>'edit')::boolean, false),
        COALESCE((perm_obj->>'delete')::boolean, false),
        COALESCE((perm_obj->>'export')::boolean, false)
      )
      ON CONFLICT (user_id, module_id) DO UPDATE SET
        can_view = EXCLUDED.can_view,
        can_create = EXCLUDED.can_create,
        can_edit = EXCLUDED.can_edit,
        can_delete = EXCLUDED.can_delete,
        can_export = EXCLUDED.can_export,
        updated_at = NOW();
      
      applied_count := applied_count + 1;
    END IF;
  END LOOP;
  
  RETURN applied_count;
END;
$$ LANGUAGE plpgsql;

-- 8. FONKSİYON: Yetki kontrolü
CREATE OR REPLACE FUNCTION check_user_permission(
  p_user_id INTEGER, 
  p_module_name VARCHAR, 
  p_action VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  user_rec RECORD;
  perm_rec RECORD;
BEGIN
  -- Kullanıcı bilgilerini al
  SELECT user_type, role INTO user_rec FROM users WHERE id = p_user_id AND is_active = true;
  
  IF user_rec IS NULL THEN
    RETURN false;
  END IF;
  
  -- Super admin her şeyi yapabilir
  IF user_rec.user_type = 'super_admin' THEN
    RETURN true;
  END IF;
  
  -- Yetki tablosundan kontrol et
  SELECT up.* INTO perm_rec
  FROM user_permissions up
  JOIN modules m ON m.id = up.module_id
  WHERE up.user_id = p_user_id AND m.name = p_module_name;
  
  IF perm_rec IS NULL THEN
    RETURN false;
  END IF;
  
  -- Action'a göre kontrol
  CASE p_action
    WHEN 'view' THEN RETURN perm_rec.can_view;
    WHEN 'create' THEN RETURN perm_rec.can_create;
    WHEN 'edit' THEN RETURN perm_rec.can_edit;
    WHEN 'delete' THEN RETURN perm_rec.can_delete;
    WHEN 'export' THEN RETURN perm_rec.can_export;
    ELSE RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- 9. VIEW: Kullanıcı yetkileri özeti
CREATE OR REPLACE VIEW user_permissions_summary AS
SELECT 
  u.id as user_id,
  u.name as user_name,
  u.email,
  u.user_type,
  u.is_active,
  COALESCE(
    json_agg(
      json_build_object(
        'module', m.name,
        'display_name', m.display_name,
        'view', up.can_view,
        'create', up.can_create,
        'edit', up.can_edit,
        'delete', up.can_delete,
        'export', up.can_export
      ) ORDER BY m.sort_order
    ) FILTER (WHERE m.id IS NOT NULL),
    '[]'::json
  ) as permissions
FROM users u
LEFT JOIN user_permissions up ON up.user_id = u.id
LEFT JOIN modules m ON m.id = up.module_id AND m.is_active = true
GROUP BY u.id, u.name, u.email, u.user_type, u.is_active;

-- 10. İlk super_admin'i ayarla (ID=1 olan kullanıcı)
UPDATE users SET user_type = 'super_admin' WHERE id = 1;

-- Başarı mesajı
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Yetki ve Log sistemi oluşturuldu!';
  RAISE NOTICE '📋 Tablolar: modules, user_permissions, audit_logs, permission_templates';
  RAISE NOTICE '🔧 Fonksiyonlar: apply_permission_template, check_user_permission';
END $$;
