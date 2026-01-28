-- Demo kullanıcı ekle (şifre: Admin123!)
-- Şifre hash'i: bcryptjs ile oluşturuldu (Admin123!)
INSERT INTO users (email, password_hash, name, role, is_active) VALUES
('admin@catering.com', '$2a$10$Z664ntAoUQ15T9zZD0jaPO1KrU8rZ0/53OhGvP7dgwufquoMpRPfa', 'Admin User', 'admin', true)
ON CONFLICT (email) DO UPDATE SET 
  password_hash = EXCLUDED.password_hash,
  is_active = true;
