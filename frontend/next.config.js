const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  // Output file tracing root - workspace root'u belirt (warning'i kaldırmak için)
  outputFileTracingRoot: path.join(__dirname),
}

module.exports = nextConfig