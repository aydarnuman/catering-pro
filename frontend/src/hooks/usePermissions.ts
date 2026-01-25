'use client';

import { useCallback, useEffect, useState } from 'react';
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

interface PermissionsData {
  userType: string;
  isSuperAdmin: boolean;
  permissions: Permission[];
}

export function usePermissions() {
  const { user, isAuthenticated } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userType, setUserType] = useState<string>('user');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    // Token yoksa veya authenticated değilse API çağrısı yapma
    if (!isAuthenticated || !user) {
      setLoading(false);
      return;
    }
    
    // Session'ın hazır olmasını bekle
    try {
      // Kısa bir gecikme ekle - session tam hazır olsun
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const data = await adminAPI.getMyPermissions();
      if (data.success) {
        setPermissions(data.data?.permissions || []);
        setUserType(data.data?.userType || 'user');
        setIsSuperAdmin(data.data?.isSuperAdmin || false);
      }
    } catch (err: any) {
      console.error('Permissions fetch error:', err);
      // 401 hatası ise session henüz hazır değil, tekrar dene
      if (err.response?.status === 401) {
        console.warn('401 hatası - session henüz hazır değil, 2 saniye sonra tekrar denenecek');
        setTimeout(() => {
          if (isAuthenticated && user) {
            fetchPermissions();
          }
        }, 2000);
      } else {
        setError('Yetkiler yüklenemedi');
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    // Sadece authenticated ise fetch yap
    if (isAuthenticated && user) {
      fetchPermissions();
    } else {
      setLoading(false);
    }
  }, [fetchPermissions, isAuthenticated, user]);

  /**
   * Belirli bir modül ve işlem için yetki kontrolü
   * @param moduleName - Modül adı (ihale, fatura, cari, stok, personel, bordro, etc.)
   * @param action - İşlem (view, create, edit, delete, export)
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

  /**
   * Modülü görüntüleme yetkisi var mı?
   */
  const canView = useCallback(
    (moduleName: string): boolean => {
      return can(moduleName, 'view');
    },
    [can]
  );

  /**
   * Modüle ekleme yetkisi var mı?
   */
  const canCreate = useCallback(
    (moduleName: string): boolean => {
      return can(moduleName, 'create');
    },
    [can]
  );

  /**
   * Modülde düzenleme yetkisi var mı?
   */
  const canEdit = useCallback(
    (moduleName: string): boolean => {
      return can(moduleName, 'edit');
    },
    [can]
  );

  /**
   * Modülden silme yetkisi var mı?
   */
  const canDelete = useCallback(
    (moduleName: string): boolean => {
      return can(moduleName, 'delete');
    },
    [can]
  );

  /**
   * Modülden dışa aktarma yetkisi var mı?
   */
  const canExport = useCallback(
    (moduleName: string): boolean => {
      return can(moduleName, 'export');
    },
    [can]
  );

  /**
   * Erişilebilir modül listesi
   */
  const accessibleModules = permissions.filter((p) => p.can_view).map((p) => p.module_name);

  return {
    permissions,
    userType,
    isSuperAdmin,
    loading,
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
  bordro: ['/muhasebe/personel'], // Bordro personel sayfasında
  kasa_banka: ['/muhasebe/finans'],
  planlama: ['/planlama', '/muhasebe/menu-planlama'],
  firma: ['/ayarlar'],
  demirbas: ['/muhasebe/demirbas'],
  rapor: ['/muhasebe/raporlar'],
  ayarlar: ['/ayarlar', '/admin'],
};

// Route -> Modül eşleştirmesi
export function getModuleFromRoute(pathname: string): string | null {
  for (const [module, routes] of Object.entries(MODULE_ROUTES)) {
    if (routes.some((route) => pathname.startsWith(route))) {
      return module;
    }
  }
  return null;
}
