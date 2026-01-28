'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { adminAPI } from '@/lib/api/services/admin';
import { logger } from '@/lib/logger';

interface Permission {
  module_name: string;
  display_name: string;
  icon: string;
  color: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
}

export function usePermissions() {
  const { user, session, isAuthenticated, isLoading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userType, setUserType] = useState<string>('user');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Retry sayacı - sonsuz döngüyü önlemek için
  const retryCount = useRef(0);
  const maxRetries = 3;
  const hasFetched = useRef(false);

  const fetchPermissions = useCallback(async () => {
    // Auth hala yükleniyorsa bekle
    if (authLoading) {
      return;
    }

    // Token yoksa veya authenticated değilse API çağrısı yapma
    if (!isAuthenticated || !user || !session?.access_token) {
      logger.debug('usePermissions: Auth hazır değil', {
        isAuthenticated,
        hasUser: !!user,
        hasToken: !!session?.access_token,
      });
      setLoading(false);
      return;
    }

    // Zaten başarılı fetch yapıldıysa tekrar yapma
    if (hasFetched.current && permissions.length > 0) {
      return;
    }

    try {
      logger.debug('usePermissions: Yetkiler yükleniyor');
      const data = await adminAPI.getMyPermissions();

      if (data.success) {
        setPermissions(data.data?.permissions || []);
        setUserType(data.data?.userType || 'user');
        setIsSuperAdmin(data.data?.isSuperAdmin || false);
        hasFetched.current = true;
        retryCount.current = 0;
        logger.debug('usePermissions: Yetkiler yüklendi', {
          permCount: data.data?.permissions?.length,
          userType: data.data?.userType,
          isSuperAdmin: data.data?.isSuperAdmin,
        });
      }
    } catch (err: unknown) {
      console.error('Permissions fetch error:', err);

      // Type guard for axios error
      const axiosError = err as { response?: { status?: number }; message?: string };

      // 401 hatası ve retry hakkı varsa tekrar dene
      if (axiosError.response?.status === 401 && retryCount.current < maxRetries) {
        retryCount.current++;
        console.warn(`401 hatası - tekrar deneniyor (${retryCount.current}/${maxRetries})`);
        setTimeout(() => {
          fetchPermissions();
        }, 1000 * retryCount.current); // Her seferinde daha uzun bekle
        return; // loading'i false yapma, tekrar deneyeceğiz
      }

      // 500 hatası - sunucu hatası
      if (axiosError.response?.status === 500) {
        setError(
          axiosError.message ||
            'Yetkiler yüklenirken sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.'
        );
        return;
      }

      // 503 hatası - servis kullanılamıyor
      if (axiosError.response?.status === 503) {
        setError(
          axiosError.message ||
            'Yetkiler servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.'
        );
        return;
      }

      // Diğer hatalar
      if (retryCount.current >= maxRetries) {
        console.error('Max retry sayısına ulaşıldı, yetkiler yüklenemedi');
        setError('Yetkiler yüklenemedi - lütfen sayfayı yenileyin');
      } else {
        setError(axiosError.message || 'Yetkiler yüklenemedi');
      }
    } finally {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, user, session?.access_token, permissions.length]);

  useEffect(() => {
    // Auth yükleniyorsa bekle
    if (authLoading) {
      return;
    }

    // Authenticated ise ve henüz fetch yapılmadıysa
    if (isAuthenticated && user && session?.access_token && !hasFetched.current) {
      fetchPermissions();
    } else if (!isAuthenticated && !authLoading) {
      // Auth yüklendi ama authenticated değil
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, user, session?.access_token, fetchPermissions]);

  /**
   * Belirli bir modül ve işlem için yetki kontrolü
   */
  const can = useCallback(
    (
      moduleName: string,
      action: 'view' | 'create' | 'edit' | 'delete' | 'export' = 'view'
    ): boolean => {
      // Super admin her şeyi yapabilir
      if (isSuperAdmin) return true;

      const perm = permissions.find((p) => p.module_name === moduleName);
      if (!perm) return false;

      switch (action) {
        case 'view':
          return perm.can_view;
        case 'create':
          return perm.can_create;
        case 'edit':
          return perm.can_edit;
        case 'delete':
          return perm.can_delete;
        case 'export':
          return perm.can_export;
        default:
          return false;
      }
    },
    [permissions, isSuperAdmin]
  );

  const canView = useCallback((moduleName: string): boolean => can(moduleName, 'view'), [can]);
  const canCreate = useCallback((moduleName: string): boolean => can(moduleName, 'create'), [can]);
  const canEdit = useCallback((moduleName: string): boolean => can(moduleName, 'edit'), [can]);
  const canDelete = useCallback((moduleName: string): boolean => can(moduleName, 'delete'), [can]);
  const canExport = useCallback((moduleName: string): boolean => can(moduleName, 'export'), [can]);

  const accessibleModules = permissions.filter((p) => p.can_view).map((p) => p.module_name);

  return {
    permissions,
    userType,
    isSuperAdmin,
    loading: loading || authLoading,
    error,
    can,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canExport,
    accessibleModules,
    refetch: fetchPermissions,
  };
}

// Modül adı -> Route eşleştirmesi
export const MODULE_ROUTES: Record<string, string[]> = {
  ihale: ['/tenders', '/upload', '/tracking', '/ihale-uzmani'],
  fatura: ['/muhasebe/faturalar'],
  cari: ['/muhasebe/cariler'],
  stok: ['/muhasebe/stok'],
  personel: ['/muhasebe/personel'],
  bordro: ['/muhasebe/personel'],
  kasa_banka: ['/muhasebe/finans'],
  planlama: ['/planlama', '/muhasebe/menu-planlama'],
  firma: ['/ayarlar'],
  demirbas: ['/muhasebe/demirbas'],
  rapor: ['/muhasebe/raporlar'],
  ayarlar: ['/ayarlar', '/admin'],
};

export function getModuleFromRoute(pathname: string): string | null {
  for (const [module, routes] of Object.entries(MODULE_ROUTES)) {
    if (routes.some((route) => pathname.startsWith(route))) {
      return module;
    }
  }
  return null;
}
