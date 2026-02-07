const path = require('path');
const { execSync } = require('child_process');

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
  },
  // NOT: NEXT_PUBLIC_API_URL artik kullanilmiyor
  // config.ts dosyasi dinamik olarak hostname'den URL olusturuyor
  // Bu sayede build sirasinda hardcoded URL'ler olusmuyor

  // Asset prefix - undefined = relative path (IP veya domain fark etmez)
  ...(process.env.NEXT_PUBLIC_ASSET_PREFIX ? { assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX } : {}),

  // Build ID'yi git commit hash'inden al (cache sorunlarini onler)
  generateBuildId: async () => {
    try {
      return execSync('git rev-parse HEAD').toString().trim().substring(0, 7);
    } catch {
      return Date.now().toString();
    }
  },

  // Output file tracing root
  outputFileTracingRoot: path.join(__dirname),

  // ============================================================
  // Deploy Sonrasi Eski Sayfa Sorunu Cozumu
  // ============================================================
  // Next.js Server Action'lari build ID'sine baglidir. Eski bir
  // tarayici cache'i farkli build ID'si gonderdiginde "Failed to
  // find Server Action" hatasi olusur. Bu header'lar tarayicinin
  // her deploy'dan sonra guncel dosyalari almasini saglar.
  // ============================================================
  async headers() {
    return [
      {
        // Next.js static assets - uzun sureli cache (dosya adi hash iceriyor)
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // HTML sayfalari - her zaman sunucudan kontrol et
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ];
  },

  // Webpack config - chunk sorunlarini onlemek icin
  webpack: (config, { isServer, dev }) => {
    if (dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig