'use client';

import { createContext, type ReactNode, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { API_ENDPOINTS, API_BASE_URL } from '@/lib/config';

interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
  user_type?: 'super_admin' | 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const isLoadingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  // Client-side mount kontrolü (hydration hatası önleme)
  useEffect(() => {
    setMounted(true);

    // Token expired event listener - api interceptor'dan gelen
    const handleTokenExpired = () => {
      console.log('Token expired event received');
      setUser(null);
      setToken(null);
      // Login sayfasında değilsek yönlendir
      if (pathname !== '/giris') {
        router.push('/giris');
      }
    };

    // Token refreshed event listener - api interceptor'dan gelen
    const handleTokenRefreshed = (event: any) => {
      const { user: refreshedUser } = event.detail || {};
      if (refreshedUser) {
        console.log('Token refreshed, updating user state');
        setUser(refreshedUser);
        setToken('cookie-based');
        setIsLoading(false);
      }
    };

    window.addEventListener('auth:token-expired', handleTokenExpired);
    window.addEventListener('auth:token-refreshed', handleTokenRefreshed as EventListener);

    return () => {
      window.removeEventListener('auth:token-expired', handleTokenExpired);
      window.removeEventListener('auth:token-refreshed', handleTokenRefreshed as EventListener);
    };
  }, [pathname, router]);

  // Token yenileme
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // HttpOnly cookie'leri gönder
      });

      if (response.ok) {
        // Yeni access token cookie'ye set edildi, kullanıcıyı tekrar yükle
        const meResponse = await fetch(API_ENDPOINTS.AUTH_ME, {
          credentials: 'include',
        });

        if (meResponse.ok) {
          const data = await meResponse.json();
          if (data.user) {
            setUser(data.user);
            setToken('cookie-based');
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }, []);

  // Kullanıcı doğrulama ve yükleme
  const verifyAndLoadUser = useCallback(async () => {
    // Çift çalışmayı önle
    if (hasInitializedRef.current || isLoadingRef.current) return;
    hasInitializedRef.current = true;
    isLoadingRef.current = true;

    try {
      const response = await fetch(API_ENDPOINTS.AUTH_ME, {
        credentials: 'include', // HttpOnly cookie'leri gönder
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          setUser(data.user);
          setToken('cookie-based'); // Token artık cookie'de
        } else {
          setUser(null);
          setToken(null);
        }
      } else if (response.status === 401) {
        // Token geçersiz veya yok - refresh dene
        const refreshed = await refreshToken();
        if (!refreshed) {
          setUser(null);
          setToken(null);
        }
      } else {
        setUser(null);
        setToken(null);
      }
    } catch (error) {
      console.error('User verification error:', error);
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [refreshToken]);

  // Sayfa yüklendiğinde kullanıcı durumunu kontrol et
  // Token artık HttpOnly cookie'de, localStorage'dan okumuyoruz
  useEffect(() => {
    if (!mounted) return;

    // mounted olduğunda ref'i sıfırla ki verifyAndLoadUser çalışabilsin
    hasInitializedRef.current = false;

    // Geriye uyumluluk: localStorage'da token varsa temizle (migration)
    const oldToken = localStorage.getItem('auth_token');
    if (oldToken) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    }

    // Cookie'deki token ile kullanıcı bilgisini al
    verifyAndLoadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]); // Sadece mounted değiştiğinde çalışsın

  // Giriş yap
  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH_LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Cookie'leri al
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setToken('cookie-based'); // Token artık HttpOnly cookie'de
        setUser(data.user);
        setIsLoading(false); // Loading state'i kapat
        // hasInitializedRef'i sıfırla ki verifyAndLoadUser tekrar çalışabilsin
        hasInitializedRef.current = false;
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Giriş başarısız' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Sunucu hatası' };
    }
  };

  // Çıkış yap
  const logout = async () => {
    try {
      // Backend'e logout isteği gönder (cookie'leri temizler)
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    setToken(null);
    setUser(null);

    // Geriye uyumluluk: eski localStorage verilerini temizle
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  };

  // Kullanıcı bilgilerini yenile
  const refreshUser = useCallback(async () => {
    // Ref'i sıfırla ki tekrar çalışabilsin
    hasInitializedRef.current = false;
    await verifyAndLoadUser();
  }, [verifyAndLoadUser]);

  // isLoading: mounted olmadan veya auth kontrolü tamamlanmadan true
  const actualIsLoading = !mounted || isLoading;

  const value: AuthContextType = {
    user,
    token,
    isLoading: actualIsLoading,
    isAuthenticated: mounted && !!user,
    isAdmin:
      mounted &&
      (user?.role === 'admin' || user?.user_type === 'super_admin' || user?.user_type === 'admin'),
    isSuperAdmin: mounted && user?.user_type === 'super_admin',
    login,
    logout,
    refreshUser,
    refreshToken,
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
