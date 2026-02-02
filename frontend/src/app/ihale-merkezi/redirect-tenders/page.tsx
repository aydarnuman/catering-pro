'use client';

/**
 * Bu sayfa /tenders'tan /ihale-merkezi'ne yönlendirme için bir örnek.
 * Mevcut /tenders sayfası korunuyor, bu sadece referans amaçlı.
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function RedirectTendersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tenderId = searchParams.get('id');
    if (tenderId) {
      router.replace(`/ihale-merkezi?tab=all&tender=${tenderId}`);
    } else {
      router.replace('/ihale-merkezi?tab=all');
    }
  }, [router, searchParams]);

  return null;
}
