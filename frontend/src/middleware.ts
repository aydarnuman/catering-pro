import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * AUTH MIDDLEWARE - Güncellendi 26 Ocak 2026
 * Korumalı path'ler: /ayarlar, /admin, /profil, /muhasebe, /ai-chat, /tracking
 * Diğer sayfalar (/, /tenders, /giris vb.) herkese açık
 */

// Auth gerektiren path'ler
const PROTECTED_PATHS = [
  '/ayarlar',
  '/admin',
  '/profil',
  '/muhasebe', // Finansal veriler - auth gerekli
  '/ai-chat', // AI konuşma geçmişi - auth gerekli
  '/tracking', // İhale takip - auth gerekli
];

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

  // Korumalı değilse direkt geç - AUTH KONTROLÜ YOK
  if (!isProtectedPath) {
    return NextResponse.next();
  }

  // Sadece korumalı path'ler için auth kontrolü
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Kullanıcı yoksa ve korumalı path'e erişmeye çalışıyorsa → login'e yönlendir
  if (!user) {
    const loginUrl = new URL('/giris', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
