'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Eski URL yönlendirmesi: /muhasebe/menu-planlama -> /menu-planlama
 */
export default function MenuPlanlamaRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(`/menu-planlama${qs ? `?${qs}` : ''}`);
  }, [router, searchParams]);

  return null;
}
