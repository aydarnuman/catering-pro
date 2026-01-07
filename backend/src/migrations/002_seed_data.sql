-- Demo kullanıcı ekle (şifre: Admin123!)
INSERT INTO users (email, password_hash, name, role) VALUES
('admin@catering.com', '$2a$10$KrzxJ4vIlQl9kb3AY.BGvegtMby4SpUW9m7U3xiGiS..FR2BHB4sS', 'Admin User', 'admin')
ON CONFLICT (email) DO NOTHING;
