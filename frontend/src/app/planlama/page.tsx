'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function PlanlamaPage() {
  const router = useRouter();

  // Direkt Menü Planlama'ya yönlendir
  useEffect(() => {
    router.replace('/menu-planlama');
  }, [router]);

  return null;
}
