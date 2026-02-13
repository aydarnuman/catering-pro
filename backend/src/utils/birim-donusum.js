/**
 * Birim Dönüşüm Yardımcı Fonksiyonları
 * Tüm birim işlemleri için merkezi modül
 *
 * TEK KAYNAK PRENSİBİ:
 * - Tüm birim normalize ve dönüşüm işlemleri bu modülden geçer
 * - DB tabloları: birim_eslestirme (normalize), birim_donusumleri (çarpanlar)
 * - Hardcoded dönüşüm YASAK — her yer bu modülü kullanmalı
 *
 * KURAL:
 * - Ürün kartı birimi: kg, lt, adet, demet, paket, porsiyon (gr/ml YASAK)
 * - Reçete birimi: gr, kg, ml, lt, adet, porsiyon, dilim, tutam (serbest)
 * - Fiyat her zaman ürün kartı birimi bazında (TL/kg, TL/lt, TL/adet)
 */

// Environment variable'ları yükle (test için gerekli)
import '../env-loader.js';
import { query } from '../database.js';
import logger from './logger.js';

// Önbellek (her sorgu için DB'ye gitmesin)
let birimEslestirmeCache = null;
let birimDonusumCache = null;

// Bilinen temel dönüşümler (DB'den yüklenemezse fallback)
const FALLBACK_DONUSUMLER = {
  'g:kg': 0.001,
  'kg:g': 1000,
  'ml:L': 0.001,
  'L:ml': 1000,
  'gr:kg': 0.001,
  'kg:gr': 1000,
  'ml:lt': 0.001,
  'lt:ml': 1000,
  'lt:L': 1,
  'L:lt': 1,
};

// Bilinen varyasyon → standart eşleştirmeleri (DB'den yüklenemezse fallback)
const FALLBACK_ESLESTIRME = {
  gr: 'g',
  gram: 'g',
  g: 'g',
  kg: 'kg',
  kilo: 'kg',
  kilogram: 'kg',
  ml: 'ml',
  mililitre: 'ml',
  lt: 'L',
  litre: 'L',
  l: 'L',
  adet: 'adet',
  ad: 'adet',
  porsiyon: 'porsiyon',
  prs: 'porsiyon',
  paket: 'paket',
  pkt: 'paket',
  demet: 'demet',
  dilim: 'dilim',
  tutam: 'tutam',
};

/**
 * Önbelleği yükle
 */
async function loadCache() {
  if (!birimEslestirmeCache) {
    try {
      const result = await query('SELECT varyasyon, standart FROM birim_eslestirme');
      birimEslestirmeCache = {};
      result.rows.forEach((row) => {
        birimEslestirmeCache[row.varyasyon.toLowerCase()] = row.standart;
      });
    } catch (err) {
      logger.warn(`birim_eslestirme tablosu okunamadı, fallback kullanılıyor: ${err.message}`);
      birimEslestirmeCache = { ...FALLBACK_ESLESTIRME };
    }
  }

  if (!birimDonusumCache) {
    try {
      const result = await query('SELECT kaynak_birim, hedef_birim, carpan FROM birim_donusumleri');
      birimDonusumCache = {};
      result.rows.forEach((row) => {
        const key = `${row.kaynak_birim}:${row.hedef_birim}`;
        birimDonusumCache[key] = parseFloat(row.carpan);
      });
    } catch (err) {
      logger.warn(`birim_donusumleri tablosu okunamadı, fallback kullanılıyor: ${err.message}`);
      birimDonusumCache = { ...FALLBACK_DONUSUMLER };
    }
  }
}

/**
 * Birim varyasyonunu standart forma çevir
 * @param {string} birim - 'gr', 'Gram', 'GR' gibi
 * @returns {string} - 'g' gibi standart form
 */
export async function standartBirimAl(birim) {
  if (!birim) return 'adet';

  await loadCache();

  const key = birim.toLowerCase().trim();
  return birimEslestirmeCache[key] || birim.toLowerCase();
}

/**
 * İki birim arası dönüşüm katsayısını al
 * Tanımsız dönüşümde uyarı loglar ve 1 döndürür (mevcut davranış korunuyor)
 *
 * @param {string} kaynakBirim - 'g', 'gr', 'ml' vb.
 * @param {string} hedefBirim - 'kg', 'lt', 'adet' vb.
 * @param {number|null} urunKartId - Ürün kartı ID (ürüne özel dönüşüm için, opsiyonel)
 * @returns {number} - çarpan (örn: g→kg = 0.001)
 */
export async function donusumCarpaniAl(kaynakBirim, hedefBirim, urunKartId = null) {
  await loadCache();

  const stdKaynak = await standartBirimAl(kaynakBirim);
  const stdHedef = await standartBirimAl(hedefBirim);

  // Aynı birimse
  if (stdKaynak === stdHedef) return 1;

  // Ürüne özel dönüşüm (varsa en öncelikli)
  if (urunKartId) {
    try {
      const result = await query(
        'SELECT carpan FROM urun_birim_donusumleri WHERE urun_kart_id = $1 AND kaynak_birim = $2 AND hedef_birim = $3 LIMIT 1',
        [urunKartId, stdKaynak, stdHedef]
      );
      if (result.rows.length > 0) return parseFloat(result.rows[0].carpan);

      // Ürüne özel ters dönüşüm
      const tersResult = await query(
        'SELECT carpan FROM urun_birim_donusumleri WHERE urun_kart_id = $1 AND kaynak_birim = $2 AND hedef_birim = $3 LIMIT 1',
        [urunKartId, stdHedef, stdKaynak]
      );
      if (tersResult.rows.length > 0) {
        const c = parseFloat(tersResult.rows[0].carpan);
        if (c > 0) return 1 / c;
      }
    } catch (_err) {
      // urun_birim_donusumleri tablosu yoksa sessizce devam et
    }
  }

  // Genel dönüşüm (cache'ten)
  const key = `${stdKaynak}:${stdHedef}`;
  const carpan = birimDonusumCache[key];
  if (carpan !== undefined) return carpan;

  // Ters dönüşüm
  const tersKey = `${stdHedef}:${stdKaynak}`;
  const tersCarpan = birimDonusumCache[tersKey];
  if (tersCarpan !== undefined && tersCarpan > 0) return 1 / tersCarpan;

  // Fallback'te var mı?
  const fallback = FALLBACK_DONUSUMLER[key];
  if (fallback !== undefined) return fallback;

  // Tanımsız dönüşüm — uyarı logla + DB log kuyruğuna ekle
  logger.warn(
    `Birim dönüşümü bulunamadı: ${kaynakBirim}(${stdKaynak}) → ${hedefBirim}(${stdHedef})${urunKartId ? ` [ürün:${urunKartId}]` : ''}. Çarpan 1 kullanılıyor.`
  );
  logFallbackKullanimi(stdKaynak, stdHedef, urunKartId);
  return 1;
}

// Fallback loglama kuyruğu (batch insert, performans için)
const fallbackLogQueue = [];
let fallbackLogTimer = null;

function logFallbackKullanimi(kaynakBirim, hedefBirim, urunKartId) {
  const key = `${kaynakBirim}:${hedefBirim}:${urunKartId || 'null'}`;
  // Aynı dönüşüm kuyrukta zaten varsa tekrar ekleme
  if (fallbackLogQueue.some((item) => item.key === key)) return;
  fallbackLogQueue.push({ key, kaynakBirim, hedefBirim, urunKartId });

  // 30 saniyede bir toplu yaz
  if (!fallbackLogTimer) {
    fallbackLogTimer = setTimeout(flushFallbackLog, 30000);
  }
}

async function flushFallbackLog() {
  fallbackLogTimer = null;
  if (fallbackLogQueue.length === 0) return;

  const batch = fallbackLogQueue.splice(0);
  try {
    for (const item of batch) {
      await query(
        `INSERT INTO birim_donusum_log (kaynak_birim, hedef_birim, urun_kart_id, urun_adi, sorun_tipi)
         SELECT $1, $2, $3, uk.ad, 'fallback'
         FROM (SELECT 1) x
         LEFT JOIN urun_kartlari uk ON uk.id = $3
         WHERE NOT EXISTS (
           SELECT 1 FROM birim_donusum_log 
           WHERE kaynak_birim = $1 AND hedef_birim = $2 AND COALESCE(urun_kart_id, 0) = COALESCE($3, 0) AND cozuldu = false
         )`,
        [item.kaynakBirim, item.hedefBirim, item.urunKartId || null]
      );
    }
  } catch (_err) {
    // Log tablosu yoksa veya hata olursa sessizce devam et
  }
}

/**
 * Miktarı bir birimden diğerine dönüştür
 * @param {number} miktar - 100
 * @param {string} kaynakBirim - 'g'
 * @param {string} hedefBirim - 'kg'
 * @returns {number} - 0.1
 */
export async function miktarDonustur(miktar, kaynakBirim, hedefBirim) {
  if (!miktar || miktar === 0) return 0;

  const carpan = await donusumCarpaniAl(kaynakBirim, hedefBirim);
  return miktar * carpan;
}

/**
 * Önbelleği temizle (test veya güncelleme sonrası)
 */
export function cacheTemizle() {
  birimEslestirmeCache = null;
  birimDonusumCache = null;
}

/**
 * Senkron versiyon - önbellek yüklüyse kullan
 * (Performans kritik yerlerde async/await overhead'i önlemek için)
 */
export function standartBirimAlSync(birim) {
  if (!birim) return 'adet';
  if (!birimEslestirmeCache) {
    const key = birim.toLowerCase().trim();
    return FALLBACK_ESLESTIRME[key] || birim.toLowerCase();
  }
  const key = birim.toLowerCase().trim();
  return birimEslestirmeCache[key] || birim.toLowerCase();
}

/**
 * Senkron dönüşüm çarpanı — önbellek yüklüyse kullan
 * (Frontend-benzeri senkron hesaplamalar için)
 */
export function donusumCarpaniAlSync(kaynakBirim, hedefBirim) {
  const stdKaynak = standartBirimAlSync(kaynakBirim);
  const stdHedef = standartBirimAlSync(hedefBirim);

  if (stdKaynak === stdHedef) return 1;

  const key = `${stdKaynak}:${stdHedef}`;

  // Önbellekten
  if (birimDonusumCache) {
    const carpan = birimDonusumCache[key];
    if (carpan !== undefined) return carpan;

    // Ters dönüşüm
    const tersKey = `${stdHedef}:${stdKaynak}`;
    const tersCarpan = birimDonusumCache[tersKey];
    if (tersCarpan !== undefined && tersCarpan > 0) return 1 / tersCarpan;
  }

  // Fallback
  return FALLBACK_DONUSUMLER[key] ?? 1;
}

// Test fonksiyonu
export async function testBirimDonusum() {}
