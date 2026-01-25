const path = require('path');
const { execSync } = require('child_process');

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
  },
  // NOT: NEXT_PUBLIC_API_URL artık kullanılmıyor
  // config.ts dosyası dinamik olarak hostname'den URL oluşturuyor
  // Bu sayede build sırasında hardcoded URL'ler oluşmuyor
  // Production'da standalone output - şimdilik kapalı (npm start ile çalışması için)
  // ...(process.env.NODE_ENV === 'production' && { output: 'standalone' }),
  // Asset prefix - undefined = relative path (IP veya domain fark etmez)
  // Sadece belirtilirse kullanılır, yoksa Next.js otomatik relative path kullanır
  ...(process.env.NEXT_PUBLIC_ASSET_PREFIX ? { assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX } : {}),
  // Build ID'yi git commit hash'inden al (cache sorunlarını önler)
  generateBuildId: async () => {
    try {
      return execSync('git rev-parse HEAD').toString().trim().substring(0, 7);
    } catch {
      // Git yoksa timestamp kullan
      return Date.now().toString();
    }
  },
  // Output file tracing root - workspace root'u belirt (warning'i kaldırmak için)
  outputFileTracingRoot: path.join(__dirname),
  // Webpack config - chunk sorunlarını önlemek için
  webpack: (config, { isServer, dev }) => {
    if (dev && !isServer) {
      // Development'ta chunk sorunlarını önlemek için
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