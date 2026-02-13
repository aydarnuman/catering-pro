/**
 * Environment Variable Validator
 * Startup'ta gerekli environment variable'ları kontrol eder
 */

import logger from './logger.js';

// Zorunlu environment variable'lar
const REQUIRED_ENV_VARS = {
  // Database (her zaman zorunlu)
  DATABASE_URL: {
    required: true,
    description: 'PostgreSQL connection string (Supabase)',
  },

  // Authentication (her zaman zorunlu)
  JWT_SECRET: {
    required: true,
    description: 'JWT secret key (minimum 32 karakter)',
    validate: (value) => {
      if (value.length < 32) {
        throw new Error('JWT_SECRET en az 32 karakter olmalı');
      }
    },
  },
};

// Production'da zorunlu, development'ta opsiyonel
const PRODUCTION_REQUIRED_ENV_VARS = {
  NODE_ENV: {
    required: true,
    description: 'Node environment (production/development)',
    validate: (value) => {
      if (!['production', 'development', 'test'].includes(value)) {
        throw new Error('NODE_ENV production, development veya test olmalı');
      }
    },
  },
};

// Opsiyonel ama önerilen environment variable'lar
const OPTIONAL_ENV_VARS = {
  PORT: {
    description: 'Server port (default: 3001)',
    default: '3001',
  },
  ANTHROPIC_API_KEY: {
    description: 'Anthropic Claude API key (AI asistan için)',
  },
  IHALEBUL_USERNAME: {
    description: 'ihalebul.com kullanıcı adı (scraper için)',
  },
  IHALEBUL_PASSWORD: {
    description: 'ihalebul.com şifre (scraper için)',
  },
};

/**
 * Environment variable'ları validate et
 */
export function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing = [];
  const warnings = [];

  // Zorunlu değişkenleri kontrol et
  for (const [key, config] of Object.entries(REQUIRED_ENV_VARS)) {
    const value = process.env[key];

    if (!value) {
      missing.push({ key, description: config.description });
    } else if (config.validate) {
      try {
        config.validate(value);
      } catch (error) {
        throw new Error(`${key} validation hatası: ${error.message}`);
      }
    }
  }

  // Production'da ek kontroller
  if (isProduction) {
    for (const [key, config] of Object.entries(PRODUCTION_REQUIRED_ENV_VARS)) {
      const value = process.env[key];

      if (!value) {
        missing.push({ key, description: config.description });
      } else if (config.validate) {
        try {
          config.validate(value);
        } catch (error) {
          throw new Error(`${key} validation hatası: ${error.message}`);
        }
      }
    }
  }

  // Eksik zorunlu değişkenler varsa hata ver
  if (missing.length > 0) {
    logger.error("Eksik environment variable'lar tespit edildi:", { missing });
    throw new Error(
      `Eksik environment variable'lar:\n${missing.map((m) => `  - ${m.key}: ${m.description}`).join('\n')}`
    );
  }

  // Opsiyonel değişkenler için uyarı ver
  for (const [key, config] of Object.entries(OPTIONAL_ENV_VARS)) {
    if (!process.env[key]) {
      warnings.push({ key, description: config.description });
    }
  }

  if (warnings.length > 0 && isProduction) {
    logger.warn("Opsiyonel environment variable'lar eksik (bazı özellikler çalışmayabilir):", {
      warnings: warnings.map((w) => `${w.key}: ${w.description}`),
    });
  }

  // Başarılı
  logger.info('Environment variable validation başarılı', {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: process.env.PORT || '3001',
  });
}
