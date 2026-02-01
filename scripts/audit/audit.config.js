/**
 * Catering Pro - Denetim Yapılandırması
 * Eşik değerlerini, kuralları ve davranışları özelleştirin
 */

import path from 'path';
import fs from 'fs/promises';

const defaultConfig = {
  // Proje yolları
  paths: {
    backend: 'backend',
    frontend: 'frontend',
    migrations: 'supabase/migrations',  // Supabase CLI migration sistemi
    routes: 'backend/src/routes',
    logs: 'backend/logs',
  },

  // Kod Kalitesi Eşikleri
  codeQuality: {
    // Cyclomatic complexity eşiği (Express route'lar için gerçekçi)
    maxCyclomaticComplexity: 25,

    // Dosya başına maksimum satır (domain-driven dosyalar için)
    maxLinesPerFile: 2000,

    // Fonksiyon başına maksimum satır (middleware/handler için makul)
    maxLinesPerFunction: 150,

    // JSDoc kapsama minimum yüzdesi
    minJsDocCoverage: 10,

    // README güncellik eşiği (gün)
    readmeFreshnessThresholdDays: 90,

    // Kullanılmayan bağımlılık tespiti
    detectUnusedDependencies: true,

    // API adlandırma deseni
    apiNamingPattern: /^\/api\/[a-z-]+/,

    // Response format gereksinimleri
    apiResponseRequirements: {
      requireSuccessField: true,
      requireDataField: true,
      requireErrorField: true,
    },
  },

  // Güvenlik Eşikleri
  security: {
    // npm audit seviye filtreleme
    auditSeverityLevels: ['critical', 'high', 'moderate'],

    // Gizli anahtar tespit desenleri
    secretPatterns: [
      /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
      /(?:secret|password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi,
      /(?:token|bearer|auth)\s*[:=]\s*['"][^'"]{10,}['"]/gi,
      /sk-[a-zA-Z0-9]{20,}/g, // OpenAI/Anthropic keys
      /AIza[0-9A-Za-z-_]{35}/g, // Google API keys
      /ghp_[0-9A-Za-z]{36}/g, // GitHub Personal Access Tokens
      /-----BEGIN (?:RSA |DSA |EC )?PRIVATE KEY-----/g,
      /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"][^'"]+['"]/gi,
      /JWT_SECRET\s*[:=]\s*['"][^'"]+['"]/gi,
    ],

    // Gizli anahtar taramasından hariç tutulacak dosyalar
    secretScanExcludes: [
      '**/node_modules/**',
      '**/*.min.js',
      '**/dist/**',
      '**/.git/**',
      '.env.example',
      '**/README*.md',
      '**/package-lock.json',
      '**/yarn.lock',
    ],

    // Gerekli güvenlik başlıkları
    requiredSecurityHeaders: [
      'helmet',
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'X-Frame-Options',
    ],

    // Rate limiting gereksinimleri
    rateLimiting: {
      requiredEndpoints: ['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password'],
      maxRequestsPerWindow: 100,
      windowMs: 15 * 60 * 1000, // 15 dakika
    },

    // Input validation kontrolleri
    inputValidation: {
      checkSqlInjection: true,
      checkXss: true,
      requireParameterizedQueries: true,
    },

    // Ortam değişkenleri güvenliği
    env: {
      disallowedInCode: ['JWT_SECRET', 'DATABASE_URL', 'SUPABASE_SERVICE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
      requiredEnvVars: ['JWT_SECRET', 'DATABASE_URL', 'NODE_ENV'],
    },
  },

  // Altyapı Eşikleri
  infrastructure: {
    // Build sağlığı
    build: {
      maxBuildTime: 120000, // 2 dakika
      requiredScripts: ['build', 'start', 'dev'],
    },

    // Database sağlığı
    database: {
      maxMigrationGaps: 0, // Eksik migration yok
      requireIndexOnForeignKeys: true,
      detectN1Queries: true,
    },

    // Log analizi
    logs: {
      maxErrorsPerHour: 50,
      maxWarningsPerHour: 200,
      checkLogRotation: true,
      maxLogFileSizeMB: 100,
    },

    // Performans
    performance: {
      maxBundleSizeMB: 15,
      detectMemoryLeaks: true,
      checkAsyncDisposal: true,
    },
  },

  // Raporlama
  reporting: {
    includeFilePaths: true,
    includeLineNumbers: true,
    includeCodeSnippets: true,
    maxSnippetLength: 200,
  },

  // Atlanacak kategoriler
  skip: [],

  // Atlanacak kontroller
  skipChecks: [],
};

export async function loadConfig(projectRoot) {
  const customConfigPath = path.join(projectRoot, 'audit.config.js');

  try {
    const exists = await fs
      .access(customConfigPath)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      const customConfig = await import(customConfigPath);
      return deepMerge({ ...defaultConfig, projectRoot }, customConfig.default || customConfig);
    }
  } catch (error) {
    console.warn('Uyarı: Özel yapılandırma yüklenemedi, varsayılanlar kullanılıyor');
  }

  return { ...defaultConfig, projectRoot };
}

function deepMerge(target, source) {
  const output = { ...target };
  for (const key in source) {
    if (source[key] instanceof Object && key in target && target[key] instanceof Object && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

export default defaultConfig;
