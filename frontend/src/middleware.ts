import { type NextRequest, NextResponse } from 'next/server';

/**
 * AUTH MIDDLEWARE - PostgreSQL Only (Simplified)
 * Supabase KALDIRILDI - Cookie tabanlı auth
 *
 * Protected path'lerde cookie varlığını kontrol eder.
 * Gerçek auth doğrulaması backend'de yapılır.
 */

// Auth gerektiren path'ler ('/' ana sayfa dahil)
const PROTECTED_PATHS = ['/', '/ayarlar', '/admin', '/profil', '/muhasebe', '/ai-chat', '/tracking'];

// Static dosyalar - middleware atla
const STATIC_PATHS = ['/_next', '/api', '/favicon.ico', '/images', '/fonts', '/logo'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static dosyaları atla
  if (STATIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Korumalı path mi kontrol et
  const isProtectedPath = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  // Korumalı değilse direkt geç
  if (!isProtectedPath) {
    return NextResponse.next();
  }

  // Korumalı path için cookie kontrolü
  const accessToken = request.cookies.get('access_token')?.value;

  // Cookie yoksa login'e yönlendir
  if (!accessToken) {
    const loginUrl = new URL('/giris', request.url);
    // Ana sayfa için redirect parametresi ekleme (temiz URL)
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Cookie var - backend doğrulayacak
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
