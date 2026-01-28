-- =====================================================
-- IP Access Control System
-- IP whitelist ve blacklist yönetimi
-- =====================================================

-- 1. IP access rules tablosu
CREATE TABLE IF NOT EXISTS ip_access_rules (
    id SERIAL PRIMARY KEY,
    ip_address CIDR NOT NULL, -- CIDR notation desteği (192.168.1.0/24, 10.0.0.1/32)
    type VARCHAR(20) NOT NULL CHECK (type IN ('whitelist', 'blacklist')),
    description TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ip_rules_type ON ip_access_rules(type);
CREATE INDEX IF NOT EXISTS idx_ip_rules_active ON ip_access_rules(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ip_rules_ip ON ip_access_rules USING GIST (ip_address inet_ops); -- GIST index for CIDR

-- 2. IP'nin kurala uyup uymadığını kontrol eden fonksiyon
-- Önce eski imzayı kaldır (003'te RETURNS TABLE vardı)
DROP FUNCTION IF EXISTS check_ip_access(INET);

CREATE OR REPLACE FUNCTION check_ip_access(ip_to_check INET)
RETURNS BOOLEAN AS $$
DECLARE
    has_whitelist BOOLEAN;
    is_whitelisted BOOLEAN;
    is_blacklisted BOOLEAN;
BEGIN
    -- Whitelist var mı kontrol et
    SELECT EXISTS(
        SELECT 1 FROM ip_access_rules 
        WHERE type = 'whitelist' 
          AND is_active = TRUE
    ) INTO has_whitelist;
    
    -- Whitelist varsa sadece whitelist'teki IP'ler erişebilir
    IF has_whitelist THEN
        SELECT EXISTS(
            SELECT 1 FROM ip_access_rules
            WHERE type = 'whitelist'
              AND is_active = TRUE
              AND ip_to_check <<= ip_address  -- CIDR içinde mi kontrol
        ) INTO is_whitelisted;
        
        RETURN is_whitelisted;
    END IF;
    
    -- Whitelist yoksa blacklist kontrolü yap
    SELECT EXISTS(
        SELECT 1 FROM ip_access_rules
        WHERE type = 'blacklist'
          AND is_active = TRUE
          AND ip_to_check <<= ip_address  -- CIDR içinde mi kontrol
    ) INTO is_blacklisted;
    
    -- Blacklist'te değilse erişim izni ver
    RETURN NOT is_blacklisted;
END;
$$ LANGUAGE plpgsql;

-- 3. IP'nin hangi kurala uyduğunu getiren fonksiyon
CREATE OR REPLACE FUNCTION get_ip_rule(ip_to_check INET)
RETURNS TABLE(
    rule_id INTEGER,
    rule_type VARCHAR,
    rule_description TEXT
) AS $$
BEGIN
    -- Önce blacklist kontrolü
    RETURN QUERY
    SELECT id, type, description
    FROM ip_access_rules
    WHERE type = 'blacklist'
      AND is_active = TRUE
      AND ip_to_check <<= ip_address
    LIMIT 1;
    
    -- Blacklist'te yoksa whitelist kontrolü
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT id, type, description
        FROM ip_access_rules
        WHERE type = 'whitelist'
          AND is_active = TRUE
          AND ip_to_check <<= ip_address
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. Eski kuralları temizleme fonksiyonu (90 günden eski)
CREATE OR REPLACE FUNCTION cleanup_old_ip_rules()
RETURNS void AS $$
BEGIN
    DELETE FROM ip_access_rules
    WHERE created_at < NOW() - INTERVAL '90 days'
      AND is_active = FALSE;
END;
$$ LANGUAGE plpgsql;

-- Yorumlar
COMMENT ON TABLE ip_access_rules IS 'IP erişim kuralları - whitelist ve blacklist';
COMMENT ON COLUMN ip_access_rules.ip_address IS 'CIDR notation (192.168.1.0/24, 10.0.0.1/32)';
COMMENT ON COLUMN ip_access_rules.type IS 'whitelist veya blacklist';
COMMENT ON COLUMN ip_access_rules.description IS 'Kural açıklaması (örn: "Ofis IP aralığı")';
