/**
 * CSRF Token Management
 * Cookie'den CSRF token okuma ve yönetimi
 */

/**
 * Cookie'den CSRF token'ı oku
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') {
    return null; // SSR durumunda
  }

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrf-token') {
      return decodeURIComponent(value);
    }
  }

  return null;
}

/**
 * Response header'dan CSRF token'ı al (ilk yüklemede)
 */
export function getCsrfTokenFromHeader(): string | null {
  // Bu fonksiyon ilk sayfa yüklemesinde response header'dan token almak için kullanılabilir
  // Şu an için cookie'den okumak yeterli
  return getCsrfToken();
}

/**
 * CSRF token'ı localStorage'a kaydet (opsiyonel - cache için)
 */
export function cacheCsrfToken(token: string): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('csrf_token_cache', token);
    } catch (e) {
      // localStorage kullanılamıyorsa sessizce devam et
    }
  }
}

/**
 * Cache'den CSRF token'ı oku
 */
export function getCachedCsrfToken(): string | null {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem('csrf_token_cache');
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * CSRF token'ı temizle (logout'ta)
 */
export function clearCsrfToken(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('csrf_token_cache');
      // Cookie'yi silmek için expire date'i geçmiş yap
      document.cookie = 'csrf-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    } catch (e) {
      // Hata olursa sessizce devam et
    }
  }
}
