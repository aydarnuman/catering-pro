/**
 * Catering Pro - Servis Konfigürasyonu
 * Tüm servis tanımları, bağımlılıklar ve environment değişkenleri
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Proje kök dizini
export const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Dizin yolları
export const paths = {
  root: PROJECT_ROOT,
  backend: path.join(PROJECT_ROOT, 'backend'),
  frontend: path.join(PROJECT_ROOT, 'frontend'),
  services: path.join(PROJECT_ROOT, 'services'),
  whatsapp: path.join(PROJECT_ROOT, 'services/whatsapp'),
  instagram: path.join(PROJECT_ROOT, 'services/instagram'),
  logs: path.join(PROJECT_ROOT, 'backend/logs'),
};

// Port tanımları
export const ports = {
  frontend: 3000,
  backend: 3001,
  whatsapp: 3002,
  instagram: 3003,
  postgres: 5432,
};

// Servis tanımları ve bağımlılık grafiği
export const services = {
  postgres: {
    name: 'PostgreSQL',
    type: 'docker',
    container: 'catering_postgres',
    port: ports.postgres,
    healthCheck: {
      type: 'tcp',
      timeout: 5000,
    },
    required: true,
    startOrder: 1,
    description: 'Ana veritabanı (Supabase)',
  },
  backend: {
    name: 'Backend API',
    type: 'node',
    port: ports.backend,
    cwd: paths.backend,
    command: 'npm',
    args: ['start'],
    devCommand: 'npm',
    devArgs: ['run', 'dev'],
    healthCheck: {
      type: 'http',
      url: `http://localhost:${ports.backend}/health`,
      timeout: 10000,
      retries: 3,
      retryDelay: 2000,
    },
    dependencies: ['postgres'],
    required: true,
    startOrder: 2,
    description: 'Express.js API sunucusu',
  },
  frontend: {
    name: 'Frontend',
    type: 'node',
    port: ports.frontend,
    cwd: paths.frontend,
    command: 'npm',
    args: ['run', 'start'],
    devCommand: 'npm',
    devArgs: ['run', 'dev'],
    healthCheck: {
      type: 'http',
      url: `http://localhost:${ports.frontend}`,
      timeout: 15000,
      retries: 5,
      retryDelay: 3000,
    },
    dependencies: ['backend'],
    required: true,
    startOrder: 3,
    description: 'Next.js web uygulaması',
  },
  whatsapp: {
    name: 'WhatsApp Service',
    type: 'docker',
    container: 'catering_whatsapp',
    port: ports.whatsapp,
    healthCheck: {
      type: 'http',
      url: `http://localhost:${ports.whatsapp}/health`,
      timeout: 5000,
    },
    dependencies: [],
    required: false,
    startOrder: 4,
    description: 'WhatsApp entegrasyonu',
  },
  instagram: {
    name: 'Instagram Service',
    type: 'docker',
    container: 'catering_instagram',
    port: ports.instagram,
    healthCheck: {
      type: 'http',
      url: `http://localhost:${ports.instagram}/health`,
      timeout: 5000,
    },
    dependencies: [],
    required: false,
    startOrder: 5,
    description: 'Instagram entegrasyonu',
  },
};

// Gerekli environment değişkenleri
export const requiredEnvVars = {
  backend: {
    required: [
      {
        name: 'DATABASE_URL',
        description: 'PostgreSQL bağlantı URL\'i',
        pattern: /^postgres(ql)?:\/\/.+/,
      },
      {
        name: 'JWT_SECRET',
        description: 'JWT token şifreleme anahtarı',
        minLength: 32,
      },
      {
        name: 'SUPABASE_URL',
        description: 'Supabase proje URL\'i',
        pattern: /^https:\/\/.+\.supabase\.co$/,
      },
    ],
    optional: [
      {
        name: 'SUPABASE_SERVICE_ROLE_KEY',
        description: 'Supabase service role key (admin işlemleri için)',
        pattern: /^eyJ.+/,
      },
      {
        name: 'PORT',
        description: 'Backend port (varsayılan: 3001)',
        default: '3001',
      },
      {
        name: 'NODE_ENV',
        description: 'Ortam (development/production)',
        default: 'development',
      },
      {
        name: 'UYUMSOFT_API_KEY',
        description: 'Uyumsoft API anahtarı',
      },
      {
        name: 'ANTHROPIC_API_KEY',
        description: 'Claude AI API anahtarı',
      },
      {
        name: 'OPENAI_API_KEY',
        description: 'OpenAI API anahtarı',
      },
    ],
  },
  frontend: {
    required: [
      {
        name: 'NEXT_PUBLIC_SUPABASE_URL',
        description: 'Supabase proje URL\'i (public)',
        pattern: /^https:\/\/.+\.supabase\.co$/,
      },
      {
        name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        description: 'Supabase anonymous key',
        pattern: /^eyJ.+/,
      },
    ],
    optional: [
      {
        name: 'NEXT_PUBLIC_API_URL',
        description: 'Backend API URL\'i (deprecated - config.ts otomatik belirler)',
        pattern: /^https?:\/\/.+/,
      },
      {
        name: 'NEXT_PUBLIC_ENABLE_REALTIME',
        description: 'Realtime özelliği (true/false)',
        default: 'true',
      },
    ],
  },
};

// Scheduler tanımları
export const schedulers = {
  syncScheduler: {
    name: 'Sync Scheduler',
    description: 'Uyumsoft fatura senkronizasyonu',
    apiEndpoint: '/api/system/schedulers/sync',
    triggerEndpoint: '/api/system/schedulers/sync/trigger',
  },
  tenderScheduler: {
    name: 'Tender Scheduler',
    description: 'İhale scraper ve döküman işleme',
    apiEndpoint: '/api/system/schedulers/tender',
    triggerEndpoint: '/api/system/schedulers/tender/trigger',
  },
  documentQueue: {
    name: 'Document Queue',
    description: 'Döküman işleme kuyruğu',
    apiEndpoint: '/api/system/schedulers/document-queue',
  },
};

// Realtime tabloları
export const realtimeTables = [
  'invoices',
  'cariler',
  'cari_hareketler',
  'stok',
  'stok_hareketler',
  'tenders',
  'notifications',
  'personel',
  'kasa_banka_hareketler',
  'bordro',
  'projeler',
  'demirbas',
  'urunler',
  'menu_items',
  'satin_alma',
];

// ANSI renk kodları
export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

// Durum ikonları
export const icons = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  running: '🟢',
  stopped: '🔴',
  loading: '⏳',
  docker: '🐳',
  node: '📦',
  database: '🗄️',
  api: '🔌',
  web: '🌐',
  realtime: '📡',
  scheduler: '⏱️',
  queue: '📋',
};

// Varsayılan ayarlar
export const defaults = {
  healthCheckTimeout: 5000,
  healthCheckRetries: 3,
  healthCheckRetryDelay: 2000,
  startupTimeout: 30000,
  shutdownTimeout: 10000,
  logRotationDays: 7,
};

export default {
  PROJECT_ROOT,
  paths,
  ports,
  services,
  requiredEnvVars,
  schedulers,
  realtimeTables,
  colors,
  icons,
  defaults,
};
