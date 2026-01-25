# Supabase Auth Kurulumu

## 1. Trigger (auth.users → public.users)

`supabase_auth_trigger.sql` dosyasını Supabase Dashboard → SQL Editor’da çalıştırın.  
Bu trigger, `auth.users` tablosuna yeni kayıt eklendiğinde `public.users` tablosuna karşılık gelen satırı oluşturur.

## 2. Dashboard Ayarları

- **Authentication → Providers:** Email provider’ı açık olsun.
- **Authentication → URL Configuration:**
  - **Site URL:** `http://localhost:3000` (geliştirme) veya production domain.
  - **Redirect URLs:**  
    `http://localhost:3000/**`,  
    `https://yourdomain.com/**` (production).

## 3. Test Kullanıcısı

1. **Authentication → Users → Add user**
   - Email: `admin@catering.com`
   - Password: `Admin123!`
   - Auto Confirm User: işaretli

2. **SQL Editor’da:**

```sql
UPDATE public.users SET user_type = 'super_admin' WHERE email = 'admin@catering.com';
```

Mevcut `public.users` kaydı yoksa, önce Supabase’te bu email ile kullanıcı oluşturulmalı; trigger `public.users` satırını ekleyecektir. Ardından yukarıdaki `UPDATE` ile `user_type` güncellenir.

## 4. Mevcut Kullanıcılar

Eski bcrypt şifreler Supabase’e taşınamaz. Seçenekler:

- Supabase Dashboard’dan kullanıcıyı manuel ekleyip yeni şifre verin.
- “Şifremi unuttum” akışı ile şifre sıfırlayın.
- Gerekirse `public.users` için `auth_user_id` ile eşleme yapın (opsiyonel).
