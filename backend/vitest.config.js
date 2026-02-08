import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      '__tests__/**/*.test.{js,mjs}',
      'src/**/tests/*.test.{js,mjs}',
    ],
    exclude: ['node_modules', 'coverage'],
    testTimeout: 30000,
    setupFiles: ['./__tests__/setup.js'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: [
        'src/server.js',
        'src/scraper/**',
        'src/services/sync-scheduler.js',
        'src/services/tender-scheduler.js',
      ],
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
    },
  },
});
