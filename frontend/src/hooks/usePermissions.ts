'use client';

/**
 * usePermissions - Modul Bazli Yetki Kontrolu
 *
 * Cookie tabanli JWT auth ile calisir.
 * 401 hatalarini Axios interceptor yonetir (token refresh + giris yonlendirmesi).
 * Bu hook retry yapmaz - Axios interceptor'a guvenilir.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { adminAPI } from '@/lib/api/services/admin';

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
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userType, setUserType] = useState<string>('user');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const fetchPermissions = useCallback(async () => {
    // Auth hala yukleniyorsa bekle
    if (authLoading) return;

    // Giris yapilmamissa API cagrisi yapma
    if (!isAuthenticated || !user) {
      setLoading(false);
      return;
    }

    // Zaten basarili fetch yapildiysa tekrar yapma
    if (hasFetched.current) return;

    try {
      const data = await adminAPI.getMyPermissions();

      if (data.success) {
        setPermissions(data.data?.permissions || []);
        setUserType(data.data?.userType || 'user');
        setIsSuperAdmin(data.data?.isSuperAdmin || false);
        hasFetched.current = true;
      }
    } catch (err: unknown) {
      // 401 hatalari Axios interceptor tarafindan yonetilir
      // (token refresh dener, basarisizsa /giris'e yonlendirir)
      // Buraya duserse refresh de basarisiz demektir - sadece hatayi goster
      const axiosError = err as { response?: { status?: number }; message?: string };

      if (axiosError.response?.status === 401) {
        // Axios interceptor zaten giris sayfasina yonlendirecek
        return;
      }

      console.error('Yetkiler yuklenemedi:', err);
      setError(axiosError.message || 'Yetkiler yuklenemedi');
    } finally {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, user]);

  useEffect(() => {
    if (authLoading) return;

    if (isAuthenticated && user && !hasFetched.current) {
      fetchPermissions();
    } else if (!isAuthenticated && !authLoading) {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, user, fetchPermissions]);

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
  ihale: ['/tenders', '/upload', '/tracking', '/ihale-merkezi', '/ihale-uzmani'],
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
