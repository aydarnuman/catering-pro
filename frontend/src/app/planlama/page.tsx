'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PlanlamaPage() {
  const router = useRouter();

  // Direkt Menü Planlama'ya yönlendir
  useEffect(() => {
    router.push('/muhasebe/menu-planlama');
  }, [router]);

  return null;
}
