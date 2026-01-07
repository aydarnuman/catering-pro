-- Demo kullanıcı ekle (şifre: admin123)
-- Şifre hash'i: bcryptjs ile oluşturulmalı
INSERT INTO users (email, password_hash, name, role) VALUES
('admin@catering.com', '$2a$10$XYZ...', 'Admin User', 'admin')
ON CONFLICT (email) DO NOTHING;
