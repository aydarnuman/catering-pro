-- WhatsApp Entegrasyonu - Kalıcı Veri Saklama
-- User bazlı, güvenli, 500 mesaj limiti

-- WhatsApp Contacts (Rehber)
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    wa_id VARCHAR(50) NOT NULL, -- 905551234567@s.whatsapp.net
    name VARCHAR(255),
    push_name VARCHAR(255),
    phone VARCHAR(20),
    is_group BOOLEAN DEFAULT FALSE,
    profile_pic_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, wa_id)
);

-- WhatsApp Chats (Sohbetler)
CREATE TABLE IF NOT EXISTS whatsapp_chats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    wa_id VARCHAR(50) NOT NULL, -- Chat ID
    name VARCHAR(255),
    is_group BOOLEAN DEFAULT FALSE,
    unread_count INTEGER DEFAULT 0,
    last_message TEXT,
    last_message_time TIMESTAMP,
    is_archived BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, wa_id)
);

-- WhatsApp Messages (Mesajlar - Son 500)
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    chat_id VARCHAR(50) NOT NULL, -- Chat ID
    message_id VARCHAR(100) NOT NULL, -- WhatsApp message ID
    body TEXT,
    from_me BOOLEAN DEFAULT FALSE,
    message_type VARCHAR(20) DEFAULT 'text', -- text, image, video, document, audio, sticker
    media_url TEXT,
    media_mime_type VARCHAR(100),
    media_filename VARCHAR(255),
    timestamp TIMESTAMP NOT NULL,
    is_forwarded BOOLEAN DEFAULT FALSE,
    quoted_message_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, message_id)
);

-- WhatsApp Media (Medya Dosyaları)
CREATE TABLE IF NOT EXISTS whatsapp_media (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message_id VARCHAR(100) NOT NULL,
    file_path TEXT NOT NULL, -- Supabase Storage path
    file_name VARCHAR(255),
    mime_type VARCHAR(100),
    file_size INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, message_id)
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_user ON whatsapp_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_wa_id ON whatsapp_contacts(wa_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_user ON whatsapp_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_wa_id ON whatsapp_chats(wa_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user ON whatsapp_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat ON whatsapp_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_time ON whatsapp_messages(timestamp DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_whatsapp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS whatsapp_contacts_updated_at ON whatsapp_contacts;
CREATE TRIGGER whatsapp_contacts_updated_at
    BEFORE UPDATE ON whatsapp_contacts
    FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();

DROP TRIGGER IF EXISTS whatsapp_chats_updated_at ON whatsapp_chats;
CREATE TRIGGER whatsapp_chats_updated_at
    BEFORE UPDATE ON whatsapp_chats
    FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();

-- Mesaj temizleme fonksiyonu (chat başına 500 mesaj tut)
CREATE OR REPLACE FUNCTION cleanup_old_whatsapp_messages()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM whatsapp_messages 
    WHERE id IN (
        SELECT id FROM whatsapp_messages 
        WHERE user_id = NEW.user_id AND chat_id = NEW.chat_id
        ORDER BY timestamp DESC
        OFFSET 500
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS whatsapp_messages_cleanup ON whatsapp_messages;
CREATE TRIGGER whatsapp_messages_cleanup
    AFTER INSERT ON whatsapp_messages
    FOR EACH ROW EXECUTE FUNCTION cleanup_old_whatsapp_messages();
