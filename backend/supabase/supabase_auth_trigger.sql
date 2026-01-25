-- Supabase Auth → public.users sync trigger
-- Çalıştırmak için: Supabase Dashboard → SQL Editor → bu dosyanın içeriğini yapıştırıp Run.
--
-- auth.users'a INSERT olduğunda public.users'a satır ekler.
-- id: SERIAL, auth_user_id: auth.users.id (UUID), password_hash: NULL.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    email,
    name,
    user_type,
    is_active,
    auth_user_id,
    password_hash,
    role,
    created_at,
    updated_at
  )
  VALUES (
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    'user',
    true,
    NEW.id,
    NULL,
    'user',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
