-- Bildirim Sistemi
-- Kullanıcı bildirimlerini yönetir

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type VARCHAR(50) DEFAULT 'info', -- info, success, warning, error
  category VARCHAR(50), -- tender, invoice, payment, stock, system
  link VARCHAR(500), -- Tıklandığında gidilecek sayfa
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Örnek veri (test için)
-- INSERT INTO notifications (user_id, title, message, type, category, link) VALUES
-- (1, 'Yeni İhale', 'Ankara bölgesinde yeni yemek ihalesi yayınlandı', 'info', 'tender', '/tenders'),
-- (1, 'Vade Uyarısı', '3 faturanın vadesi bugün doluyor', 'warning', 'invoice', '/muhasebe/faturalar'),
-- (1, 'Stok Uyarısı', '5 üründe kritik stok seviyesi', 'warning', 'stock', '/muhasebe/stok');

COMMENT ON TABLE notifications IS 'Kullanıcı bildirimleri';
