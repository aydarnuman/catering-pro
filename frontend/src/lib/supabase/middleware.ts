/**
 * SUPABASE MIDDLEWARE - DEPRECATED
 * Auth artık PostgreSQL + Cookie tabanlı yapılıyor.
 * Bu dosya sadece geriye dönük uyumluluk için bırakıldı.
 *
 * Yeni middleware: frontend/src/middleware.ts
 */

import { type NextRequest, NextResponse } from 'next/server';

export async function updateSession(request: NextRequest) {
  // Auth artık cookie tabanlı - sadece NextResponse döndür
  return {
    supabaseResponse: NextResponse.next({
      request: {
        headers: request.headers,
      },
    }),
    user: null,
  };
}
