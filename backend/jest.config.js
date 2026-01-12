/**
 * Jest Configuration
 * Catering Pro - Test Altyapısı
 */

export default {
  // ESM modül desteği
  testEnvironment: 'node',
  
  // Test dosyaları pattern
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.spec.js'
  ],
  
  // Coverage ayarları
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/migrate.js',
    '!src/scraper/**',
    '!src/services/sync-scheduler.js',
    '!src/services/tender-scheduler.js'
  ],
  
  // Coverage thresholds (ileride artırılabilir)
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 20,
      lines: 20,
      statements: 20
    }
  },
  
  // Coverage rapor formatları
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Coverage çıktı klasörü
  coverageDirectory: 'coverage',
  
  // Test timeout (bordro hesaplamaları için)
  testTimeout: 10000,
  
  // Verbose output
  verbose: true,
  
  // Setup dosyası
  setupFilesAfterEnv: ['./__tests__/setup.js'],
  
  // Transform ayarları (ESM için)
  transform: {},
  
  // Module name mapper (path alias)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Test ortamı değişkenleri
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  },
  
  // Paralel test çalıştırma
  maxWorkers: '50%',
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/'
  ]
};
