/**
 * Birim Dönüşüm Yardımcı Fonksiyonları
 * Tüm birim işlemleri için merkezi modül
 */

// Environment variable'ları yükle (test için gerekli)
import '../env-loader.js';
import { query } from '../database.js';

// Önbellek (her sorgu için DB'ye gitmesin)
let birimEslestirmeCache = null;
let birimDonusumCache = null;

/**
 * Önbelleği yükle
 */
async function loadCache() {
  if (!birimEslestirmeCache) {
    const result = await query('SELECT varyasyon, standart FROM birim_eslestirme');
    birimEslestirmeCache = {};
    result.rows.forEach(row => {
      birimEslestirmeCache[row.varyasyon.toLowerCase()] = row.standart;
    });
  }
  
  if (!birimDonusumCache) {
    const result = await query('SELECT kaynak_birim, hedef_birim, carpan FROM birim_donusumleri');
    birimDonusumCache = {};
    result.rows.forEach(row => {
      const key = `${row.kaynak_birim}:${row.hedef_birim}`;
      birimDonusumCache[key] = parseFloat(row.carpan);
    });
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
 * @param {string} kaynakBirim - 'g'
 * @param {string} hedefBirim - 'kg'
 * @returns {number} - 0.001
 */
export async function donusumCarpaniAl(kaynakBirim, hedefBirim) {
  await loadCache();
  
  const stdKaynak = await standartBirimAl(kaynakBirim);
  const stdHedef = await standartBirimAl(hedefBirim);
  
  // Aynı birimse
  if (stdKaynak === stdHedef) return 1;
  
  const key = `${stdKaynak}:${stdHedef}`;
  const carpan = birimDonusumCache[key];
  
  if (carpan !== undefined) return carpan;
  
  // Dönüşüm bulunamadı - uyarı logla
  console.warn(`Birim dönüşümü bulunamadı: ${kaynakBirim} -> ${hedefBirim}`);
  return 1;
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
    console.warn('Birim cache yüklenmemiş, async versiyon kullanın');
    return birim.toLowerCase();
  }
  const key = birim.toLowerCase().trim();
  return birimEslestirmeCache[key] || birim.toLowerCase();
}

// Test fonksiyonu
export async function testBirimDonusum() {
  console.log('=== Birim Dönüşüm Testi ===');
  console.log('gram -> standart:', await standartBirimAl('gram')); // 'g'
  console.log('GR -> standart:', await standartBirimAl('GR'));     // 'g'
  console.log('g -> kg çarpan:', await donusumCarpaniAl('g', 'kg')); // 0.001
  console.log('100g -> kg:', await miktarDonustur(100, 'g', 'kg')); // 0.1
  console.log('=== Test Tamamlandı ===');
}
