-- =============================================
-- 002: AI GOD MODE TABLOLARI
-- God Mode audit log ve custom tools için
-- =============================================

-- 1. GOD MODE AUDIT LOG TABLOSU
CREATE TABLE IF NOT EXISTS ai_god_mode_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100),
    tool_name VARCHAR(100) NOT NULL,
    parameters JSONB,
    result JSONB,
    status VARCHAR(50) DEFAULT 'started',
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_god_mode_logs_user ON ai_god_mode_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_god_mode_logs_tool ON ai_god_mode_logs(tool_name);
CREATE INDEX IF NOT EXISTS idx_god_mode_logs_status ON ai_god_mode_logs(status);
CREATE INDEX IF NOT EXISTS idx_god_mode_logs_created ON ai_god_mode_logs(created_at DESC);

-- 2. CUSTOM TOOLS TABLOSU (AI'ın oluşturduğu tool'lar)
CREATE TABLE IF NOT EXISTS ai_custom_tools (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parameters JSONB,
    implementation TEXT,
    created_by VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_tools_name ON ai_custom_tools(name);
CREATE INDEX IF NOT EXISTS idx_custom_tools_active ON ai_custom_tools(is_active);

-- 3. AI SECRETS TABLOSU (API key'ler için)
CREATE TABLE IF NOT EXISTS ai_secrets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    encrypted_value TEXT NOT NULL,
    service VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_secrets_name ON ai_secrets(name);
CREATE INDEX IF NOT EXISTS idx_ai_secrets_service ON ai_secrets(service);
