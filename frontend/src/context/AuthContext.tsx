'use client';

/**
 * AUTH CONTEXT - PostgreSQL Only (Simplified)
 * Supabase Auth KALDIRILDI - Sadece kendi JWT sistemimiz
 *
 * Avantajlar:
 * - Timeout yok
 * - Hızlı başlatma
 * - Basit state yönetimi
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getApiBaseUrlDynamic } from '@/lib/config';

// App User tipi
interface AppUser {
  id: number;
  email: string;
  name: string;
  role: string;
  user_type: 'super_admin' | 'admin' | 'user';
}

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initRef = useRef(false);

  // API base URL
  const getApiUrl = useCallback(() => {
    return getApiBaseUrlDynamic() || '';
  }, []);

  // Kullanıcı bilgisini API'den al
  const fetchUser = useCallback(async (): Promise<AppUser | null> => {
    try {
      const baseUrl = getApiUrl();
      // SSR veya URL yoksa atla
      if (typeof window === 'undefined' || !baseUrl) {
        return null;
      }

      // Timeout ile fetch - 3 saniye içinde cevap gelmezse null döndür
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      // Aynı origin'de relative URL daha güvenilir (CORS/SSL sorunlarını önler)
      const apiUrl = baseUrl.startsWith(window.location.origin) ? '/api/auth/me' : `${baseUrl}/api/auth/me`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'include', // Cookie'leri gönder
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (data.success && data.user) {
        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role,
          user_type: data.user.user_type || 'user',
        };
      }
      return null;
    } catch (error) {
      // Network hataları sessizce ele al — backend henüz hazır olmayabilir
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.warn('[Auth] Timeout — API yanıt vermedi, tekrar denenecek');
        } else if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
          console.warn('[Auth] Backend bağlantı hatası — backend çalışıyor mu?');
        } else {
          console.warn('[Auth] Kullanıcı bilgisi alınamadı:', error.message);
        }
      }
      return null;
    }
  }, [getApiUrl]);

  // Auth durumunu başlat
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const initAuth = async () => {
      // Timeout ekle - 5 saniye sonra loading'i kapat
      const timeoutId = setTimeout(() => {
        setIsLoading(false);
      }, 5000);

      try {
        const userData = await fetchUser();
        clearTimeout(timeoutId);
        setUser(userData);
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Init auth error:', error);
        setUser(null);
      } finally {
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    };

    initAuth();
  }, [fetchUser]);

  // Login
  const login = useCallback(
    async (email: string, password: string) => {
      try {
        setIsLoading(true);

        const response = await fetch(`${getApiUrl()}/api/auth/login`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          let errorMessage = 'Giriş başarısız';

          if (data.error === 'Geçersiz email veya şifre') {
            errorMessage = 'Geçersiz email veya şifre';
          } else if (data.code === 'ACCOUNT_LOCKED') {
            errorMessage = data.error;
          } else if (data.code === 'PASSWORD_NOT_SET') {
            errorMessage = data.error;
          } else if (data.error) {
            errorMessage = data.error;
          }

          return { success: false, error: errorMessage };
        }

        if (data.success && data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            role: data.user.role,
            user_type: data.user.user_type || 'user',
          });
          return { success: true };
        }

        return { success: false, error: 'Beklenmeyen hata' };
      } catch (error: unknown) {
        console.error('Login exception:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Giriş sırasında bir hata oluştu',
        };
      } finally {
        setIsLoading(false);
      }
    },
    [getApiUrl]
  );

  // Logout
  const logout = useCallback(async () => {
    try {
      await fetch(`${getApiUrl()}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      window.location.href = '/giris';
    }
  }, [getApiUrl]);

  // Kullanıcı bilgisini yenile
  const refreshUser = useCallback(async () => {
    const userData = await fetchUser();
    setUser(userData);
  }, [fetchUser]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.user_type === 'admin' || user?.user_type === 'super_admin',
    isSuperAdmin: user?.user_type === 'super_admin',
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
