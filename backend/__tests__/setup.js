/**
 * Vitest Test Setup
 * Tüm testlerden önce çalışır
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test environment variables yükle
dotenv.config({ path: path.join(__dirname, '../.env.test') });

// Fallback to main .env if .env.test doesn't exist
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, '../.env') });
}

// Test utilities (globalThis üzerinden)
globalThis.testUtils = {
  // Para formatı kontrolü
  isValidMoney: (value) => {
    return typeof value === 'number' && !Number.isNaN(value) && Number.isFinite(value);
  },

  // Tarih formatı kontrolü
  isValidDate: (dateString) => {
    const date = new Date(dateString);
    return date instanceof Date && !Number.isNaN(date.getTime());
  },

  // Yuvarlama helper (2 decimal)
  round2: (num) => Math.round(num * 100) / 100,

  // Test data generators
  generatePersonel: (overrides = {}) => ({
    tc_kimlik: '12345678901',
    ad: 'Test',
    soyad: 'Personel',
    maas: 25000,
    ise_giris_tarihi: '2020-01-15',
    medeni_durum: 'bekar',
    es_calisiyor_mu: false,
    cocuk_sayisi: 0,
    ...overrides,
  }),

  generateCari: (overrides = {}) => ({
    tip: 'musteri',
    unvan: 'Test Şirketi',
    vergi_no: '1234567890',
    telefon: '0312 123 45 67',
    il: 'Ankara',
    ...overrides,
  }),
};

console.log('🧪 Test ortamı hazır (Vitest)');
