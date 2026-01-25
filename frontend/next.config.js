const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  // Production'da standalone output - şimdilik kapalı (npm start ile çalışması için)
  // ...(process.env.NODE_ENV === 'production' && { output: 'standalone' }),
  // Asset prefix - undefined = relative path (IP veya domain fark etmez)
  // Sadece belirtilirse kullanılır, yoksa Next.js otomatik relative path kullanır
  ...(process.env.NEXT_PUBLIC_ASSET_PREFIX ? { assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX } : {}),
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