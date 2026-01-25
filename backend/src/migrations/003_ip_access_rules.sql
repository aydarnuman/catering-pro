-- =============================================
-- 003: IP ACCESS RULES TABLOSU
-- Whitelist/Blacklist IP yönetimi
-- =============================================

-- 1. IP ACCESS RULES TABLOSU
CREATE TABLE IF NOT EXISTS ip_access_rules (
    id SERIAL PRIMARY KEY,
    ip_address CIDR NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('whitelist', 'blacklist')),
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_rules_type ON ip_access_rules(type);
CREATE INDEX IF NOT EXISTS idx_ip_rules_active ON ip_access_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_ip_rules_ip ON ip_access_rules(ip_address);

-- 2. IP KONTROLÜ FONKSİYONU
CREATE OR REPLACE FUNCTION check_ip_access(p_ip_address INET)
RETURNS TABLE(allowed BOOLEAN, rule_type VARCHAR, description TEXT) AS $$
BEGIN
    -- Önce blacklist kontrol et
    IF EXISTS (
        SELECT 1 FROM ip_access_rules 
        WHERE type = 'blacklist' 
          AND is_active = TRUE 
          AND p_ip_address << ip_address
    ) THEN
        RETURN QUERY SELECT FALSE, 'blacklist'::VARCHAR, 
            (SELECT ip_access_rules.description FROM ip_access_rules 
             WHERE type = 'blacklist' AND is_active = TRUE AND p_ip_address << ip_address LIMIT 1);
        RETURN;
    END IF;
    
    -- Whitelist varsa kontrol et
    IF EXISTS (SELECT 1 FROM ip_access_rules WHERE type = 'whitelist' AND is_active = TRUE) THEN
        IF EXISTS (
            SELECT 1 FROM ip_access_rules 
            WHERE type = 'whitelist' 
              AND is_active = TRUE 
              AND p_ip_address << ip_address
        ) THEN
            RETURN QUERY SELECT TRUE, 'whitelist'::VARCHAR, 'IP whitelist içinde'::TEXT;
        ELSE
            RETURN QUERY SELECT FALSE, 'whitelist'::VARCHAR, 'IP whitelist dışında'::TEXT;
        END IF;
        RETURN;
    END IF;
    
    -- Hiçbir kural yoksa izin ver
    RETURN QUERY SELECT TRUE, NULL::VARCHAR, 'Kural yok - varsayılan izin'::TEXT;
END;
$$ LANGUAGE plpgsql;
