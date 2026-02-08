# Supabase Kullanımı

> **DIKKAT:** Supabase Auth bu projede **KULLANILMIYOR**.  
> Kimlik doğrulama tamamen Custom JWT + bcrypt + PostgreSQL ile yapılır.  
> Bu klasördeki eski `supabase_auth_trigger.sql` dosyası artık geçersizdir.

## Supabase Ne İçin Kullanılıyor?

Supabase bu projede **yalnızca** şu amaçlarla kullanılır:

1. **PostgreSQL Veritabanı Hosting** - Tüm uygulama verileri Supabase üzerindeki PostgreSQL'de saklanır
2. **Realtime** - Tablo değişikliklerini frontend'e anlık yansıtmak için (bildirimler, canlı veri güncellemeleri)
3. **Migration Yönetimi** - `supabase db push` ile migration'lar uygulanır

## Auth Sistemi (Supabase Auth DEĞİL)

Auth tamamen custom implementasyon:

| Bileşen | Dosya | Açıklama |
|---------|-------|----------|
| JWT Middleware | `backend/src/middleware/auth.js` | Token doğrulama, rol kontrolü |
| Auth Routes | `backend/src/routes/auth.js` | Login, logout, refresh, register |
| Session Service | `backend/src/services/session-service.js` | Oturum yönetimi (max 3) |
| Permission Service | `backend/src/services/permission-service.js` | Modül bazlı RBAC |
| Login Attempt | `backend/src/services/login-attempt-service.js` | Brute-force koruması |

**Akış:**
1. Kullanıcı email + şifre ile login olur
2. Backend bcrypt ile şifre doğrular
3. JWT access token (24 saat) + refresh token (30 gün) oluşturur
4. Token'lar HttpOnly cookie ile taşınır
5. Her istekte `authenticate` middleware JWT'yi doğrular

## Eski Dosyalar (Kullanılmıyor)

- `supabase_auth_trigger.sql` - Eski Supabase Auth trigger'ı. **Artık geçersiz.** Auth, `users` tablosunda doğrudan yönetilir.

## Migration'lar

Migration dosyaları `supabase/migrations/` klasöründedir:

```bash
# Migration durumunu kontrol et
supabase migration list

# Migration'ları uygula
supabase db push

# Yeni migration oluştur
supabase migration new migration_adi
```
