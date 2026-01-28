'use client';

import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { clearGlobalSession, setGlobalSession } from '@/lib/api';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/client';

// App User tipi - Supabase user + public.users profil
interface AppUser {
  id: number; // public.users.id (integer)
  authId: string; // Supabase auth.users.id (uuid)
  email: string;
  name: string;
  user_type: 'super_admin' | 'admin' | 'user';
}

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [_mounted, setMounted] = useState(false);
  const initRef = useRef(false);

  const supabase = createClient();

  // public.users tablosundan profil bilgisi al
  const fetchUserProfile = useCallback(
    async (authUser: SupabaseUser): Promise<AppUser | null> => {
      try {
        // Timeout ile profil yükleme (2 saniye - 5'ten azaltıldı)
        const profilePromise = supabase
          .from('users')
          .select('id, email, name, user_type')
          .eq('email', authUser.email)
          .single();

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Profile fetch timeout')), 2000);
        });

        const { data, error } = await Promise.race([profilePromise, timeoutPromise]).catch(() => {
          logger.debug('[Auth] Profile fetch timeout (2s), using fallback');
          return { data: null, error: { message: 'timeout' } };
        });

        if (error || !data) {
          logger.debug('[Auth] Using fallback profile for', { email: authUser.email });
          // Fallback - minimal user objesi
          return {
            id: 0,
            authId: authUser.id,
            email: authUser.email || '',
            name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Kullanıcı',
            user_type: 'user',
          };
        }

        return {
          id: data.id,
          authId: authUser.id,
          email: data.email,
          name: data.name || authUser.email?.split('@')[0] || 'Kullanıcı',
          user_type: data.user_type || 'user',
        };
      } catch (error) {
        console.error('Error fetching user profile:', error);
        // Hata durumunda da fallback döndür
        return {
          id: 0,
          authId: authUser.id,
          email: authUser.email || '',
          name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Kullanıcı',
          user_type: 'user',
        };
      }
    },
    [supabase]
  );

  // Auth durumunu başlat
  useEffect(() => {
    setMounted(true);

    if (initRef.current) return;
    initRef.current = true;

    let isInitialized = false;
    let timeoutId: NodeJS.Timeout | null = null;

    const initAuth = async () => {
      try {
        // Timeout: 5 saniye içinde tamamlanmazsa yükleme ekranını kapat (10'dan 5'e düşürüldü)
        timeoutId = setTimeout(() => {
          if (!isInitialized) {
            console.warn('⚠️ Auth initialization timeout (5s), forcing loading to false');
            setIsLoading(false);
            isInitialized = true;
          }
        }, 5000);

        // Mevcut session'ı al
        const {
          data: { session: currentSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.warn('Session alınamadı:', sessionError);
          if (timeoutId) clearTimeout(timeoutId);
          setIsLoading(false);
          isInitialized = true;
          return;
        }

        if (currentSession?.user && currentSession?.access_token) {
          // Token formatını kontrol et
          const tokenParts = currentSession.access_token.split('.');
          if (tokenParts.length !== 3) {
            console.warn('⚠️ Token formatı geçersiz, session temizleniyor');
            await supabase.auth.signOut();
            if (timeoutId) clearTimeout(timeoutId);
            setIsLoading(false);
            isInitialized = true;
            return;
          }

          // Önce global session'ı güncelle (cache senkronizasyonu için)
          setGlobalSession(currentSession);
          // Sonra state'i güncelle
          setSession(currentSession);

          try {
            const profile = await fetchUserProfile(currentSession.user);
            setUser(profile);
          } catch (profileError) {
            console.error('Profile fetch error:', profileError);
            // Profile hatası olsa bile session geçerli, devam et
          }

          logger.debug('Session yüklendi', {
            userId: currentSession.user.id,
            email: currentSession.user.email,
            tokenLength: currentSession.access_token.length,
            expiresAt: currentSession.expires_at
              ? new Date(currentSession.expires_at * 1000).toISOString()
              : 'N/A',
          });
        } else {
          // Session yok - cache'i temizle
          setGlobalSession(null);
        }
      } catch (error) {
        console.error('Init auth error:', error);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        setIsLoading(false);
        isInitialized = true;
      }
    };

    initAuth();

    // Auth state değişikliklerini dinle
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        logger.debug('Auth state changed', {
          event,
          hasSession: !!newSession,
          hasUser: !!newSession?.user,
          hasAccessToken: !!newSession?.access_token,
        });
      }

      // INITIAL_SESSION event'i initAuth ile çakışmasın
      if (event === 'INITIAL_SESSION') {
        // initAuth zaten çalıştı, sadece state'i güncelle ama isLoading'i değiştirme
        if (newSession?.user && !isInitialized) {
          setGlobalSession(newSession);
          setSession(newSession);
          try {
            const profile = await fetchUserProfile(newSession.user);
            setUser(profile);
          } catch (error) {
            console.error('Profile fetch error in INITIAL_SESSION:', error);
          }
          setIsLoading(false);
          isInitialized = true;
        }
        return;
      }

      if (event === 'SIGNED_IN' && newSession?.user) {
        // Önce global session'ı güncelle
        setGlobalSession(newSession);
        setSession(newSession);
        try {
          const profile = await fetchUserProfile(newSession.user);
          setUser(profile);
        } catch (error) {
          console.error('Profile fetch error in SIGNED_IN:', error);
          // Profile hatası olsa bile session geçerli, devam et
        }
        setIsLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        clearGlobalSession(); // Global store'u temizle
        setIsLoading(false);
      } else if (event === 'TOKEN_REFRESHED' && newSession) {
        // Token refresh edildiğinde - önce global session'ı güncelle
        setGlobalSession(newSession);
        setSession(newSession);
        // Token refresh edildiğinde user profilini de güncelle
        if (newSession.user) {
          try {
            const profile = await fetchUserProfile(newSession.user);
            setUser(profile);
          } catch (error) {
            console.error('Profile fetch error in TOKEN_REFRESHED:', error);
          }
        }
      }
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [supabase, fetchUserProfile]);

  // Sign In (Supabase)
  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        setIsLoading(true);

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error('Sign in error:', error);
          let errorMessage = 'Giriş başarısız';

          if (error.message === 'Invalid login credentials') {
            errorMessage = 'Geçersiz email veya şifre';
          } else if (error.message.includes('Email not confirmed')) {
            errorMessage = 'Email adresi doğrulanmamış';
          } else {
            errorMessage = error.message;
          }

          return { success: false, error: errorMessage };
        }

        if (data.user && data.session) {
          // Önce global session'ı güncelle
          setGlobalSession(data.session);
          setSession(data.session);
          const profile = await fetchUserProfile(data.user);
          setUser(profile);
          return { success: true };
        }

        return { success: false, error: 'Beklenmeyen hata' };
      } catch (error: unknown) {
        console.error('Sign in exception:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Giriş sırasında bir hata oluştu',
        };
      } finally {
        setIsLoading(false);
      }
    },
    [supabase, fetchUserProfile]
  );

  // Sign Out (Supabase)
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      clearGlobalSession(); // Global store'u temizle
      // Sayfayı yenile - middleware login'e yönlendirecek
      window.location.href = '/giris';
    } catch (error) {
      console.error('Sign out error:', error);
      // Hata olsa bile state temizle ve yönlendir
      setUser(null);
      setSession(null);
      clearGlobalSession(); // Global store'u temizle
      window.location.href = '/giris';
    }
  }, [supabase]);

  // Kullanıcı bilgisini yenile
  const refreshUser = useCallback(async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (authUser) {
      const profile = await fetchUserProfile(authUser);
      setUser(profile);
    }
  }, [supabase, fetchUserProfile]);

  // Geriye uyumluluk için login/logout alias
  const login = signIn;
  const logout = signOut;

  const value: AuthContextType = {
    user,
    session,
    isLoading: isLoading,
    // Session varsa authenticated say - user profili yüklenene kadar beklemeyelim
    isAuthenticated: !!session && !!session.access_token,
    isAdmin: user?.user_type === 'admin' || user?.user_type === 'super_admin',
    isSuperAdmin: user?.user_type === 'super_admin',
    login,
    logout,
    signIn,
    signOut,
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
