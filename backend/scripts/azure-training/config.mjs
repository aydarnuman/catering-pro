/**
 * Azure Training - Ortak Yapılandırma
 * 
 * Tüm training script'leri bu dosyadan config alır.
 * Hassas key'ler .env dosyasından okunur; hardcode EDİLMEZ.
 * 
 * Gerekli .env değişkenleri:
 *   AZURE_DOC_AI_ENDPOINT     - Azure Document Intelligence endpoint
 *   AZURE_DOC_AI_KEY          - Azure Document Intelligence API key
 *   AZURE_STORAGE_ACCOUNT     - Azure Blob Storage hesap adı
 *   AZURE_STORAGE_KEY         - Azure Blob Storage hesap key'i
 *   AZURE_TRAINING_CONTAINER  - Blob container adı (varsayılan: ihale-training)
 *   ANTHROPIC_API_KEY         - Claude API key (etiketleme için)
 *   SUPABASE_URL              - Supabase proje URL'i
 *   SUPABASE_SERVICE_KEY      - Supabase service role key
 *   DATABASE_URL              - PostgreSQL bağlantı string'i
 *   BACKEND_URL               - Backend API URL'i (varsayılan: http://localhost:3001)
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env'), override: true });

// ═══════════════════════════════════════════════════════════════════════════
// YARDIMCI: Zorunlu env kontrolü
// ═══════════════════════════════════════════════════════════════════════════

function requireEnv(key, fallback) {
  const val = process.env[key];
  if (!val && fallback === undefined) {
    throw new Error(`❌ Eksik ortam değişkeni: ${key}\n   .env dosyasını kontrol edin.`);
  }
  return val || fallback;
}

/**
 * Lazy env okuyucu - sadece erişildiğinde kontrol eder.
 * Azure key'leri olmadan da Supabase-tabanlı script'ler çalışabilsin diye.
 */
function lazyEnv(key, fallback) {
  return { get value() { return requireEnv(key, fallback); } };
}

// ═══════════════════════════════════════════════════════════════════════════
// ANA CONFIG
// Lazy getter'lar: Azure/Anthropic key'leri sadece erişildiğinde kontrol edilir.
// Bu sayede fetch-data.mjs gibi script'ler Azure key olmadan da çalışabilir.
// ═══════════════════════════════════════════════════════════════════════════

const _azure = {
  endpoint: lazyEnv('AZURE_DOC_AI_ENDPOINT'),
  key: lazyEnv('AZURE_DOC_AI_KEY'),
};
const _storage = {
  account: lazyEnv('AZURE_STORAGE_ACCOUNT', 'cateringtr'),
  key: lazyEnv('AZURE_STORAGE_KEY'),
  container: lazyEnv('AZURE_TRAINING_CONTAINER', 'ihale-training'),
};
const _anthropic = {
  key: lazyEnv('ANTHROPIC_API_KEY'),
};

export const CONFIG = {
  azure: {
    get endpoint() { return _azure.endpoint.value; },
    get key() { return _azure.key.value; },
  },
  storage: {
    get account() { return _storage.account.value; },
    get key() { return _storage.key.value; },
    get container() { return _storage.container.value; },
    get connectionString() {
      return `DefaultEndpointsProtocol=https;AccountName=${this.account};AccountKey=${this.key};EndpointSuffix=core.windows.net`;
    },
  },
  anthropic: {
    get key() { return _anthropic.key.value; },
    model: 'claude-sonnet-4-20250514',
  },
  supabase: {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  },
  database: {
    get url() { return requireEnv('DATABASE_URL'); },
  },
  backend: {
    url: process.env.BACKEND_URL || 'http://localhost:3001',
  },
  paths: {
    root: __dirname,
    documents: path.join(__dirname, 'documents'),
    output: path.join(__dirname, 'output'),
    labels: path.join(__dirname, 'labels.json'),
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// KURUM KATEGORİLERİ (fetch-data ve analiz için ortak)
// ═══════════════════════════════════════════════════════════════════════════

export const CATEGORIES = {
  hastane: {
    label: 'Hastane / Sağlık',
    emoji: '🏥',
    keywords: [
      'hastane', 'sağlık', 'tıp fakültesi', 'tıp merkezi',
      'sağlık müdürlüğü', 'başhekimliği', 'tabip',
      'kızılay', 'ağız diş', 'toplum sağlığı',
    ],
  },
  universite: {
    label: 'Üniversite',
    emoji: '🎓',
    keywords: [
      'üniversite', 'rektörlüğü', 'fakülte', 'yüksekokul',
      'enstitü', 'sks daire', 'sağlık kültür spor',
      'akademi', 'meslek yüksek', 'polis akademisi',
    ],
  },
  okul: {
    label: 'Okul / Milli Eğitim',
    emoji: '🏫',
    keywords: [
      'milli eğitim', 'ilçe milli', 'il milli eğitim',
      'okul', 'lise', 'ilkokul', 'ortaokul',
      'imam hatip', 'meslek lisesi', 'öğretmenevi',
    ],
  },
  askeri: {
    label: 'Askeri Birimler',
    emoji: '⚔️',
    keywords: [
      'komutanlığı', 'tugay', 'alay', 'tabur',
      'jandarma', 'sahil güvenlik', 'kantin',
      'kışla', 'ordu', 'hava kuvvet', 'deniz kuvvet',
      'savunma', 'genelkurmay', 'asker',
    ],
  },
  belediye: {
    label: 'Belediye',
    emoji: '🏛️',
    keywords: [
      'belediye', 'büyükşehir', 'ilçe belediye',
    ],
  },
  sosyal: {
    label: 'Sosyal Hizmetler',
    emoji: '🤝',
    keywords: [
      'sosyal hizmet', 'sosyal yardım', 'aile ve sosyal',
      'göç idaresi', 'huzurevi', 'yurt müdürlüğü',
      'bakım merkezi', 'gençlik ve spor', 'vakıf',
      'kredi yurtlar', 'çocuk esirgeme',
    ],
  },
  cezaevi: {
    label: 'Ceza İnfaz / Adalet',
    emoji: '⚖️',
    keywords: [
      'ceza infaz', 'cezaevi', 'tutukevi', 'adalet', 'adliye',
    ],
  },
};

/**
 * Kurum adından kategori belirle
 */
export function categorize(orgName) {
  if (!orgName) return 'diger';
  const lower = orgName.toLowerCase();
  for (const [cat, conf] of Object.entries(CATEGORIES)) {
    if (conf.keywords.some(kw => lower.includes(kw))) return cat;
  }
  return 'diger';
}

// ═══════════════════════════════════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ═══════════════════════════════════════════════════════════════════════════

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function log(msg, type = 'info') {
  const icons = { info: '📋', success: '✅', warn: '⚠️', error: '❌', step: '▶' };
  console.log(`${icons[type] || '  '} ${msg}`);
}

export default CONFIG;
