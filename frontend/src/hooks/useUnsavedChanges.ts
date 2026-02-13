/**
 * useUnsavedChanges Hook
 *
 * Sayfadan ayrılırken kaydedilmemiş değişiklik uyarısı gösterir.
 * beforeunload event ile tarayıcı native dialog'unu tetikler.
 */

import { useEffect } from 'react';

export function useUnsavedChanges(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern tarayıcılar kendi mesajını gösterir, returnValue gerekli
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);
}
