'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

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
  const [mounted, setMounted] = useState(false);
  const initRef = useRef(false);
  
  const supabase = createClient();

  // public.users tablosundan profil bilgisi al
  const fetchUserProfile = useCallback(async (authUser: SupabaseUser): Promise<AppUser | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, user_type')
        .eq('email', authUser.email)
        .single();

      if (error || !data) {
        console.warn('User profile not found in public.users:', authUser.email);
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
      return null;
    }
  }, [supabase]);

  // Auth durumunu başlat
  useEffect(() => {
    setMounted(true);
    
    if (initRef.current) return;
    initRef.current = true;

    const initAuth = async () => {
      try {
        // Mevcut session'ı al
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.warn('Session alınamadı:', sessionError);
          setIsLoading(false);
          return;
        }
        
        if (currentSession?.user && currentSession?.access_token) {
          // Token formatını kontrol et
          const tokenParts = currentSession.access_token.split('.');
          if (tokenParts.length !== 3) {
            console.warn('⚠️ Token formatı geçersiz, session temizleniyor');
            await supabase.auth.signOut();
            setIsLoading(false);
            return;
          }
          
          setSession(currentSession);
          const profile = await fetchUserProfile(currentSession.user);
          setUser(profile);
          
          // Debug: Session bilgilerini logla
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ Session yüklendi:', {
              userId: currentSession.user.id,
              email: currentSession.user.email,
              tokenLength: currentSession.access_token.length,
              expiresAt: currentSession.expires_at ? new Date(currentSession.expires_at * 1000).toISOString() : 'N/A'
            });
          }
        } else {
          // Session yok veya token eksik
          if (process.env.NODE_ENV === 'development') {
            console.log('ℹ️ Session yok veya token eksik');
          }
        }
      } catch (error) {
        console.error('Init auth error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Auth state değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth state changed:', event, {
          hasSession: !!newSession,
          hasUser: !!newSession?.user,
          hasAccessToken: !!newSession?.access_token
        });

        if (event === 'SIGNED_IN' && newSession?.user) {
          setSession(newSession);
          const profile = await fetchUserProfile(newSession.user);
          setUser(profile);
          setIsLoading(false);
        } else if (event === 'INITIAL_SESSION' && newSession?.user) {
          // İlk session yüklendiğinde
          setSession(newSession);
          const profile = await fetchUserProfile(newSession.user);
          setUser(profile);
          setIsLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setIsLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && newSession) {
          setSession(newSession);
          // Token refresh edildiğinde user profilini de güncelle
          if (newSession.user) {
            const profile = await fetchUserProfile(newSession.user);
            setUser(profile);
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchUserProfile]);

  // Sign In (Supabase)
  const signIn = useCallback(async (email: string, password: string) => {
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
        const profile = await fetchUserProfile(data.user);
        setUser(profile);
        setSession(data.session);
        return { success: true };
      }

      return { success: false, error: 'Beklenmeyen hata' };
    } catch (error: any) {
      console.error('Sign in exception:', error);
      return { success: false, error: 'Giriş sırasında bir hata oluştu' };
    } finally {
      setIsLoading(false);
    }
  }, [supabase, fetchUserProfile]);

  // Sign Out (Supabase)
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      // Sayfayı yenile - middleware login'e yönlendirecek
      window.location.href = '/giris';
    } catch (error) {
      console.error('Sign out error:', error);
      // Hata olsa bile state temizle ve yönlendir
      setUser(null);
      setSession(null);
      window.location.href = '/giris';
    }
  }, [supabase]);

  // Kullanıcı bilgisini yenile
  const refreshUser = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
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
    isLoading: !mounted || isLoading,
    isAuthenticated: mounted && !!user && !!session,
    isAdmin: mounted && (user?.user_type === 'admin' || user?.user_type === 'super_admin'),
    isSuperAdmin: mounted && user?.user_type === 'super_admin',
    login,
    logout,
    signIn,
    signOut,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
