#!/usr/bin/env node
/**
 * Catering Pro - Environment Validator
 * Environment değişkenlerini ve dosyalarını doğrular
 */

import fs from 'fs/promises';
import path from 'path';
import { paths, requiredEnvVars, colors, icons } from './config.js';

const c = colors;

/**
 * Environment validation sonucu
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Tüm zorunlu değişkenler mevcut mu
 * @property {Array} errors - Kritik hatalar
 * @property {Array} warnings - Uyarılar
 * @property {Array} missing - Eksik zorunlu değişkenler
 * @property {Array} missingOptional - Eksik opsiyonel değişkenler
 * @property {Object} envFiles - .env dosyalarının durumu
 */

/**
 * Dosyanın var olup olmadığını kontrol et
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * .env dosyasını parse et
 */
async function parseEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const env = {};

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Tırnak işaretlerini kaldır
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        env[key] = value;
      }
    }

    return env;
  } catch (error) {
    return null;
  }
}

/**
 * Değişken değerini pattern'e göre doğrula
 */
function validateValue(value, config) {
  if (!value) return { valid: false, reason: 'Değer boş' };

  if (config.pattern && !config.pattern.test(value)) {
    return { valid: false, reason: 'Format geçersiz' };
  }

  if (config.minLength && value.length < config.minLength) {
    return { valid: false, reason: `En az ${config.minLength} karakter olmalı` };
  }

  return { valid: true };
}

/**
 * Backend environment'ını doğrula
 */
async function validateBackendEnv() {
  const result = {
    errors: [],
    warnings: [],
    missing: [],
    found: [],
  };

  // .env dosyasını kontrol et
  const envPath = path.join(paths.backend, '.env');
  const envExists = await fileExists(envPath);

  if (!envExists) {
    result.errors.push({
      type: 'file',
      message: 'backend/.env dosyası bulunamadı',
      path: envPath,
    });
    return result;
  }

  const env = await parseEnvFile(envPath);
  if (!env) {
    result.errors.push({
      type: 'file',
      message: 'backend/.env dosyası okunamadı',
      path: envPath,
    });
    return result;
  }

  // Zorunlu değişkenleri kontrol et
  for (const varConfig of requiredEnvVars.backend.required) {
    const value = env[varConfig.name] || process.env[varConfig.name];

    if (!value) {
      result.missing.push({
        name: varConfig.name,
        description: varConfig.description,
        required: true,
      });
      result.errors.push({
        type: 'env',
        message: `${varConfig.name} tanımlı değil`,
        description: varConfig.description,
      });
    } else {
      const validation = validateValue(value, varConfig);
      if (!validation.valid) {
        result.errors.push({
          type: 'env',
          message: `${varConfig.name}: ${validation.reason}`,
          description: varConfig.description,
        });
      } else {
        result.found.push({
          name: varConfig.name,
          description: varConfig.description,
          masked: value.substring(0, 8) + '...',
        });
      }
    }
  }

  // Opsiyonel değişkenleri kontrol et
  for (const varConfig of requiredEnvVars.backend.optional) {
    const value = env[varConfig.name] || process.env[varConfig.name];

    if (!value && !varConfig.default) {
      result.warnings.push({
        type: 'env',
        message: `${varConfig.name} tanımlı değil (opsiyonel)`,
        description: varConfig.description,
      });
    }
  }

  return result;
}

/**
 * Frontend environment'ını doğrula
 */
async function validateFrontendEnv() {
  const result = {
    errors: [],
    warnings: [],
    missing: [],
    found: [],
  };

  // .env.local dosyasını kontrol et
  const envLocalPath = path.join(paths.frontend, '.env.local');
  const envPath = path.join(paths.frontend, '.env');

  let envExists = await fileExists(envLocalPath);
  let usedPath = envLocalPath;

  if (!envExists) {
    envExists = await fileExists(envPath);
    usedPath = envPath;
  }

  if (!envExists) {
    result.errors.push({
      type: 'file',
      message: 'frontend/.env.local veya .env dosyası bulunamadı',
      path: envLocalPath,
    });
    return result;
  }

  const env = await parseEnvFile(usedPath);
  if (!env) {
    result.errors.push({
      type: 'file',
      message: 'Frontend .env dosyası okunamadı',
      path: usedPath,
    });
    return result;
  }

  // Zorunlu değişkenleri kontrol et
  for (const varConfig of requiredEnvVars.frontend.required) {
    const value = env[varConfig.name] || process.env[varConfig.name];

    if (!value) {
      result.missing.push({
        name: varConfig.name,
        description: varConfig.description,
        required: true,
      });
      result.errors.push({
        type: 'env',
        message: `${varConfig.name} tanımlı değil`,
        description: varConfig.description,
      });
    } else {
      const validation = validateValue(value, varConfig);
      if (!validation.valid) {
        result.errors.push({
          type: 'env',
          message: `${varConfig.name}: ${validation.reason}`,
          description: varConfig.description,
        });
      } else {
        result.found.push({
          name: varConfig.name,
          description: varConfig.description,
          masked: value.substring(0, 8) + '...',
        });
      }
    }
  }

  // Opsiyonel değişkenleri kontrol et
  for (const varConfig of requiredEnvVars.frontend.optional) {
    const value = env[varConfig.name] || process.env[varConfig.name];

    if (!value && !varConfig.default) {
      result.warnings.push({
        type: 'env',
        message: `${varConfig.name} tanımlı değil (opsiyonel)`,
        description: varConfig.description,
      });
    }
  }

  return result;
}

/**
 * Node.js versiyonunu kontrol et
 */
function validateNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);

  return {
    valid: major >= 18,
    version,
    major,
    required: '>=18.0.0',
  };
}

/**
 * Tüm environment'ı doğrula
 */
export async function validateEnvironment(options = {}) {
  const { verbose = false } = options;

  const result = {
    valid: true,
    errors: [],
    warnings: [],
    missing: [],
    missingOptional: [],
    envFiles: {},
    nodeVersion: null,
    backend: null,
    frontend: null,
  };

  // Node.js versiyonu
  result.nodeVersion = validateNodeVersion();
  if (!result.nodeVersion.valid) {
    result.valid = false;
    result.errors.push({
      type: 'system',
      message: `Node.js ${result.nodeVersion.required} gerekli, mevcut: ${result.nodeVersion.version}`,
    });
  }

  // .env dosyalarının varlığı
  result.envFiles = {
    backendEnv: await fileExists(path.join(paths.backend, '.env')),
    frontendEnvLocal: await fileExists(path.join(paths.frontend, '.env.local')),
    frontendEnv: await fileExists(path.join(paths.frontend, '.env')),
  };

  // Backend validation
  result.backend = await validateBackendEnv();
  if (result.backend.errors.length > 0) {
    result.valid = false;
    result.errors.push(...result.backend.errors);
  }
  result.warnings.push(...result.backend.warnings);
  result.missing.push(...result.backend.missing);

  // Frontend validation
  result.frontend = await validateFrontendEnv();
  if (result.frontend.errors.length > 0) {
    result.valid = false;
    result.errors.push(...result.frontend.errors);
  }
  result.warnings.push(...result.frontend.warnings);
  result.missing.push(...result.frontend.missing);

  return result;
}

/**
 * Validation sonuçlarını yazdır
 */
export function printValidationResult(result) {
  console.log(`\n${c.cyan}${c.bold}═══════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.cyan}${c.bold}           ${icons.info} ENVIRONMENT VALIDATION REPORT${c.reset}`);
  console.log(`${c.cyan}${c.bold}═══════════════════════════════════════════════════════════════${c.reset}\n`);

  // Node.js
  const nodeIcon = result.nodeVersion.valid ? icons.success : icons.error;
  const nodeColor = result.nodeVersion.valid ? c.green : c.red;
  console.log(`${nodeIcon} ${c.bold}Node.js:${c.reset} ${nodeColor}${result.nodeVersion.version}${c.reset} (gerekli: ${result.nodeVersion.required})`);

  // .env dosyaları
  console.log(`\n${c.bold}.env Dosyaları:${c.reset}`);
  console.log(`  ${result.envFiles.backendEnv ? icons.success : icons.error} backend/.env`);
  console.log(`  ${result.envFiles.frontendEnvLocal ? icons.success : (result.envFiles.frontendEnv ? icons.warning : icons.error)} frontend/.env.local`);

  // Backend
  if (result.backend) {
    console.log(`\n${c.bold}Backend Environment:${c.reset}`);
    if (result.backend.found.length > 0) {
      for (const v of result.backend.found) {
        console.log(`  ${icons.success} ${c.green}${v.name}${c.reset} ${c.dim}(${v.masked})${c.reset}`);
      }
    }
    for (const err of result.backend.errors) {
      console.log(`  ${icons.error} ${c.red}${err.message}${c.reset}`);
    }
  }

  // Frontend
  if (result.frontend) {
    console.log(`\n${c.bold}Frontend Environment:${c.reset}`);
    if (result.frontend.found.length > 0) {
      for (const v of result.frontend.found) {
        console.log(`  ${icons.success} ${c.green}${v.name}${c.reset} ${c.dim}(${v.masked})${c.reset}`);
      }
    }
    for (const err of result.frontend.errors) {
      console.log(`  ${icons.error} ${c.red}${err.message}${c.reset}`);
    }
  }

  // Uyarılar
  if (result.warnings.length > 0) {
    console.log(`\n${c.yellow}${c.bold}Uyarılar:${c.reset}`);
    for (const warn of result.warnings) {
      console.log(`  ${icons.warning} ${c.yellow}${warn.message}${c.reset}`);
    }
  }

  // Özet
  console.log(`\n${c.cyan}───────────────────────────────────────────────────────────────${c.reset}`);
  if (result.valid) {
    console.log(`${icons.success} ${c.green}${c.bold}Environment doğrulaması başarılı!${c.reset}`);
  } else {
    console.log(`${icons.error} ${c.red}${c.bold}Environment doğrulaması başarısız!${c.reset}`);
    console.log(`${c.red}   ${result.errors.length} hata, ${result.warnings.length} uyarı${c.reset}`);
  }
  console.log('');

  return result.valid;
}

/**
 * Eksik değişkenler için örnek .env oluştur
 */
export async function generateEnvTemplate(target = 'both') {
  const templates = {
    backend: `# Catering Pro - Backend Environment
# Bu dosyayı backend/.env olarak kaydedin

# DATABASE (Zorunlu)
DATABASE_URL=postgresql://user:password@localhost:5432/catering_db

# JWT (Zorunlu - en az 32 karakter)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars

# SUPABASE (Zorunlu)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key

# Opsiyonel
PORT=3001
NODE_ENV=development
UYUMSOFT_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
`,
    frontend: `# Catering Pro - Frontend Environment
# Bu dosyayı frontend/.env.local olarak kaydedin

# SUPABASE (Zorunlu)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key

# API (Zorunlu)
NEXT_PUBLIC_API_URL=http://localhost:3001

# Opsiyonel
NEXT_PUBLIC_ENABLE_REALTIME=true
`,
  };

  if (target === 'both' || target === 'backend') {
    const backendPath = path.join(paths.backend, '.env.example');
    await fs.writeFile(backendPath, templates.backend);
    console.log(`${icons.success} Backend .env.example oluşturuldu: ${backendPath}`);
  }

  if (target === 'both' || target === 'frontend') {
    const frontendPath = path.join(paths.frontend, '.env.example');
    await fs.writeFile(frontendPath, templates.frontend);
    console.log(`${icons.success} Frontend .env.example oluşturuldu: ${frontendPath}`);
  }
}

// CLI olarak çalıştırıldığında
const isMain = process.argv[1]?.endsWith('env-validator.js');
if (isMain) {
  const args = process.argv.slice(2);
  const generateTemplate = args.includes('--template');

  if (generateTemplate) {
    const target = args.includes('--backend') ? 'backend' :
                   args.includes('--frontend') ? 'frontend' : 'both';
    await generateEnvTemplate(target);
  } else {
    const result = await validateEnvironment({ verbose: args.includes('--verbose') });
    const valid = printValidationResult(result);
    process.exit(valid ? 0 : 1);
  }
}

export default {
  validateEnvironment,
  printValidationResult,
  generateEnvTemplate,
  validateNodeVersion,
};
