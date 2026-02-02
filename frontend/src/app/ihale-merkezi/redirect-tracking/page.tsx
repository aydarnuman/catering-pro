'use client';

/**
 * Bu sayfa /tracking'den /ihale-merkezi'ne yönlendirme için bir örnek.
 * Mevcut /tracking sayfası korunuyor, bu sadece referans amaçlı.
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function RedirectTrackingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tenderId = searchParams.get('tender');
    if (tenderId) {
      router.replace(`/ihale-merkezi?tab=tracked&tender=${tenderId}`);
    } else {
      router.replace('/ihale-merkezi?tab=tracked');
    }
  }, [router, searchParams]);

  return null;
}
