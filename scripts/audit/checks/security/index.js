/**
 * Security Check Module Aggregator
 * Güvenlik kontrollerinin birleştiricisi
 */

import { checkDependencies } from './dependencies.js';
import { checkSecrets } from './secrets.js';
import { checkAuthSecurity } from './auth-security.js';
import { checkCorsHeaders } from './cors-headers.js';
import { checkRateLimiting } from './rate-limiting.js';
import { checkInputValidation } from './input-validation.js';
import { checkEnvSecurity } from './env-security.js';

export const securityChecks = {
  name: 'security',
  displayName: 'Güvenlik',
  description: 'Bağımlılık güvenliği, gizli anahtarlar, auth, CORS, rate limiting ve input validation kontrolleri',
  checks: [
    {
      id: 'dependencies',
      name: 'Bağımlılık Güvenliği',
      description: 'npm audit ile bilinen güvenlik açıkları',
      run: checkDependencies,
      fixable: true,
    },
    {
      id: 'secrets',
      name: 'Gizli Anahtar Tespiti',
      description: 'Kodda API key, password, token tespiti',
      run: checkSecrets,
      fixable: false,
    },
    {
      id: 'auth-security',
      name: 'Auth & Permission Güvenliği',
      description: 'Authentication ve authorization endpoint güvenliği',
      run: checkAuthSecurity,
      fixable: false,
    },
    {
      id: 'cors-headers',
      name: 'CORS & Security Headers',
      description: 'CORS yapılandırması ve güvenlik başlıkları (Helmet)',
      run: checkCorsHeaders,
      fixable: false,
    },
    {
      id: 'rate-limiting',
      name: 'Rate Limiting',
      description: 'Rate limiting yapılandırma kontrolü',
      run: checkRateLimiting,
      fixable: false,
    },
    {
      id: 'input-validation',
      name: 'Input Validation',
      description: 'SQL injection ve XSS korunma kontrolleri',
      run: checkInputValidation,
      fixable: false,
    },
    {
      id: 'env-security',
      name: 'Environment Güvenliği',
      description: '.env dosyaları ve environment variable güvenliği',
      run: checkEnvSecurity,
      fixable: false,
    },
  ],
};
