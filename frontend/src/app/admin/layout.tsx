'use client';

import { AdminGuard } from '@/components/AdminGuard';

// Middleware zaten koruma sağlıyor, AdminGuard ekstra güvenlik katmanı
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGuard>{children}</AdminGuard>;
}
