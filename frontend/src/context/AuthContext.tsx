'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_BASE_URL } from '@/lib/config';

const API_URL = API_BASE_URL;

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Client-side mount kontrolü (hydration hatası önleme)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sayfa yüklendiğinde localStorage'dan token kontrol et
  useEffect(() => {
    if (!mounted) return;
    
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');
    
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        // Token'ın hala geçerli olup olmadığını kontrol et
        verifyToken(storedToken);
      } catch (error) {
        console.error('Error parsing stored user:', error);
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [mounted]);

  // Token doğrulama
  const verifyToken = async (authToken: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          setUser(data.user);
          localStorage.setItem('auth_user', JSON.stringify(data.user));
        }
      } else {
        // Token geçersiz - çıkış yap
        logout();
      }
    } catch (error) {
      console.error('Token verification error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Giriş yap
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setToken(data.token);
        setUser(data.user);
        
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        
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
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  };

  // Kullanıcı bilgilerini yenile
  const refreshUser = async () => {
    if (token) {
      await verifyToken(token);
    }
  };

  // isLoading: mounted olmadan veya auth kontrolü tamamlanmadan true
  const actualIsLoading = !mounted || isLoading;
  
  const value: AuthContextType = {
    user,
    token,
    isLoading: actualIsLoading,
    isAuthenticated: mounted && !!user && !!token,
    isAdmin: mounted && (user?.role === 'admin' || user?.user_type === 'super_admin' || user?.user_type === 'admin'),
    isSuperAdmin: mounted && user?.user_type === 'super_admin',
    login,
    logout,
    refreshUser
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

