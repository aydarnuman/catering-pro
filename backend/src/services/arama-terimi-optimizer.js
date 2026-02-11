/**
 * Arama Terimi Optimizer
 *
 * Her ürün kartı için Camgöz'de en iyi sonuç verecek arama terimini
 * otomatik bulur ve sabitler. Yeni ürün eklendiğinde veya mevcut
 * terimlerin kalitesi düşükse çalışır.
 *
 * Strateji:
 *  1. Ürün adından aday terimler türet (orijinal, sadeleştirilmiş, alternatifler)
 *  2. Her adayı Camgöz'de dene
 *  3. Sonuçları alakalılık + gıda doğruluğu ile filtrele
 *  4. En çok kaliteli sonuç getiren terimi seç
 *  5. DB'ye kaydet
 */

import { query } from '../database.js';
import logger from '../utils/logger.js';
import { isRelevantProduct, searchMarketPrices } from './market-scraper.js';

// ─── GIDA DIŞI ÜRÜN FİLTRESİ ─────────────────────────────

const NON_FOOD_PATTERNS =
  /zeytin.*dolg|dolg.*zeytin|biber\s*sos|sos.*biber|felix|whiskas|purina|pedigree|mama|collagen|bıçak|bıçağ|aparat|deterjan|şampuan|kozmetik|saç\s*boya|palette|cips.*soğan|soğan.*cips/i;

function isGidaUrunu(urunAdi) {
  return !NON_FOOD_PATTERNS.test(urunAdi || '');
}

// ─── ADAY TERİM ÜRETME ──────────────────────────────────

/**
 * Catering ürünleri için bilinen eşleştirme tablosu.
 * Camgöz'de doğrudan aranamayan ürünler için alternatif terimler.
 */
const BILINEN_ESLESTIRMELER = {
  // Et ürünleri (kuşbaşı/kıyma gibi kesim tipleri Camgöz'de yok)
  'dana kuşbaşı': ['dana but', 'dana et', 'dana kemiksiz'],
  'kuzu kuşbaşı': ['kuzu but', 'kuzu et', 'kuzu incik'],
  'dana kıyma': ['dana kıyma', 'kıyma dana', 'dana et'],
  'kuzu kıyma': ['kuzu kıyma', 'kıyma kuzu', 'kuzu et'],
  'tavuk göğüs': ['tavuk göğüs', 'tavuk but', 'tavuk'],
  'tavuk but': ['tavuk but', 'tavuk bütün'],
  'tavuk bütün': ['tavuk bütün', 'tavuk'],

  // Yeşillik (taze ürünler Camgöz'de sınırlı)
  maydanoz: ['maydanoz demet', 'maydanoz'],
  dereotu: ['dereotu demet', 'dereotu'],
  nane: ['nane taze', 'nane kuru'],
  roka: ['roka', 'roka demet'],
  'taze soğan': ['taze soğan', 'yeşil soğan'],

  // Sebzeler (Camgöz'de kg bazlı)
  'yeşil biber': ['çarliston biber', 'sivri biber'],
  biber: ['çarliston biber', 'sivri biber', 'biber dolmalık'],
  soğan: ['kuru soğan', 'soğan kuru'],
  'kuru soğan': ['kuru soğan'],

  // İçecekler
  su: ['erikli su', 'hayat su', 'içme suyu'],
  'içme suyu': ['erikli su', 'hayat su'],

  // Ekmek/hamur
  'lavaş ekmeği': ['lavaş ekmek', 'lavaş'],
  lavaş: ['lavaş ekmek', 'lavaş'],
  ekmek: ['ekmek', 'ekmek beyaz'],
  pide: ['pide', 'ramazan pidesi'],
};

/**
 * Ürün adından aday arama terimleri üret
 * @param {string} urunAdi - Ürün kartı adı
 * @returns {string[]} Denenecek terimler listesi (max 5)
 */
function generateCandidateTerms(urunAdi) {
  if (!urunAdi) return [];

  const ad = urunAdi.trim();
  const lower = ad.toLowerCase();
  const candidates = new Set();

  // 1. Bilinen eşleştirme tablosundan bak (tam kelime eşleşmesi)
  for (const [key, alts] of Object.entries(BILINEN_ESLESTIRMELER)) {
    // Tam eşleşme veya kelimenin başında/sonunda boşlukla ayrılmış olmalı
    // "susam" ≠ "su", ama "kuru soğan" = "soğan"
    const keyWords = key.split(/\s+/);
    const adWords = lower.split(/\s+/);

    const isExactMatch = lower === key;
    const isWordMatch = keyWords.every((kw) => adWords.some((aw) => aw === kw || aw.startsWith(kw)));

    if (isExactMatch || isWordMatch) {
      for (const alt of alts) candidates.add(alt);
    }
  }

  // 2. Parantez içini çıkar: "Biber (Yeşil)" → "Yeşil Biber"
  const parantezMatch = ad.match(/^(.+?)\s*\((.+?)\)$/);
  if (parantezMatch) {
    const base = parantezMatch[1].trim();
    const detail = parantezMatch[2].trim();
    candidates.add(`${detail} ${base}`); // "Yeşil Biber"
    candidates.add(base); // "Biber"
    candidates.add(`${base} ${detail}`); // "Biber Yeşil"

    // Detay + bilinen eşleştirme
    const combinedLower = `${detail} ${base}`.toLowerCase();
    for (const [key, alts] of Object.entries(BILINEN_ESLESTIRMELER)) {
      if (combinedLower.includes(key) || key.includes(combinedLower)) {
        for (const alt of alts) candidates.add(alt);
      }
    }
  }

  // 3. Orijinal ad
  candidates.add(ad);

  // 4. Ambalaj/birim bilgisini temizle
  const temiz = ad
    .replace(/\d+[.,]?\d*\s*(kg|kilo|gr|gram|g|lt|litre|l|ml|cl|adet|ad)\b/gi, '')
    .replace(/[x×]\s*\d+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (temiz.length >= 2 && temiz !== ad) candidates.add(temiz);

  // 5. Gereksiz ekleri temizle
  const temiz2 = temiz
    .replace(/\b(yerli|ithal|organik|ekonomik|taze|kuru|dondurulmuş|süzme|tam yağlı|yarım yağlı|light)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (temiz2.length >= 2 && temiz2 !== temiz) candidates.add(temiz2);

  return [...candidates].slice(0, 6);
}

// ─── TEK ÜRÜN İÇİN EN İYİ TERİMİ BUL ───────────────────

/**
 * Bir ürün için Camgöz'de en iyi sonuç veren arama terimini bul
 *
 * @param {string} urunAdi - Ürün kartı adı
 * @param {string|null} varsayilanBirim - kg, lt, adet vs.
 * @param {string|null} mevcutTerim - Mevcut piyasa_arama_terimi
 * @returns {Promise<{terim: string, sonucSayisi: number, kalite: string} | null>}
 */
async function findBestSearchTerm(urunAdi, varsayilanBirim = null, mevcutTerim = null) {
  const candidates = generateCandidateTerms(urunAdi);

  // Mevcut terimi de dene (ilk sırada)
  if (mevcutTerim && mevcutTerim !== urunAdi) {
    candidates.unshift(mevcutTerim);
  }

  const targetUnit = (() => {
    if (!varsayilanBirim) return null;
    const b = varsayilanBirim.toLowerCase();
    if (['kg', 'kilo'].includes(b)) return 'kg';
    if (['gr', 'gram', 'g'].includes(b)) return 'kg';
    if (['lt', 'litre', 'l'].includes(b)) return 'L';
    if (['ml'].includes(b)) return 'L';
    return null;
  })();

  let bestTerm = null;
  let bestScore = -1;
  let bestCount = 0;

  for (const term of candidates) {
    try {
      const result = await searchMarketPrices(term, { targetUnit });
      if (!result.success || !result.fiyatlar?.length) continue;

      // Gıda ürünü filtresi: sonuçlardan gıda olmayanları çıkar
      const validResults = result.fiyatlar.filter(
        (f) => isGidaUrunu(f.urun || '') && isRelevantProduct(term, f.urun || '', 45)
      );

      if (validResults.length === 0) continue;

      // Skor: alakalı sonuç sayısı × medyan/min fiyat tutarlılığı
      const prices = validResults.map((f) => f.birimFiyat).sort((a, b) => a - b);
      const median = prices[Math.floor(prices.length / 2)];
      const spread = median > 0 ? (prices[prices.length - 1] - prices[0]) / median : 999;

      // Tutarlılık bonusu: fiyatlar birbirine yakınsa daha güvenilir
      const tutarlilikBonus = spread <= 0.3 ? 2 : spread <= 0.6 ? 1 : 0;

      const score = validResults.length * 3 + tutarlilikBonus;

      if (score > bestScore) {
        bestScore = score;
        bestTerm = term;
        bestCount = validResults.length;
      }
    } catch {
      // Arama hatası, sonraki adaya geç
    }
  }

  if (!bestTerm) return null;

  const kalite = bestCount >= 10 ? 'yuksek' : bestCount >= 3 ? 'orta' : 'dusuk';
  return { terim: bestTerm, sonucSayisi: bestCount, kalite };
}

// ─── TOPLU OPTİMİZASYON ────────────────────────────────

/**
 * Tüm aktif ürünler için arama terimlerini optimize et.
 * Sadece kalitesi düşük veya hiç terimi olmayan ürünleri işler.
 *
 * @param {object} options
 * @param {boolean} options.sadeceBoslar - Sadece terimi boş olanları mı işle
 * @param {boolean} options.yenidenHepsini - Tüm ürünleri yeniden optimize et
 * @param {number} options.limit - Max kaç ürün işlensin
 * @returns {Promise<{islemSayisi: number, guncellemeSayisi: number, hatalar: string[]}>}
 */
export async function optimizeAllSearchTerms(options = {}) {
  const { sadeceBoslar = false, yenidenHepsini = false, limit = 50 } = options;

  let sql = `
    SELECT uk.id, uk.ad, uk.varsayilan_birim, uk.piyasa_arama_terimi,
           ufo.confidence, ufo.kaynak_sayisi
    FROM urun_kartlari uk
    LEFT JOIN urun_fiyat_ozet ufo ON ufo.urun_kart_id = uk.id
    WHERE uk.aktif = true
  `;

  if (sadeceBoslar) {
    sql += ` AND (uk.piyasa_arama_terimi IS NULL OR uk.piyasa_arama_terimi = '' OR uk.piyasa_arama_terimi = uk.ad)`;
  } else if (!yenidenHepsini) {
    // Düşük kaliteli olanları öncelikle işle
    sql += ` AND (ufo.confidence IS NULL OR ufo.confidence < 0.65 OR ufo.kaynak_sayisi < 3 OR uk.piyasa_arama_terimi = uk.ad)`;
  }

  sql += ` ORDER BY ufo.confidence ASC NULLS FIRST LIMIT $1`;

  const products = await query(sql, [limit]);

  let islemSayisi = 0;
  let guncellemeSayisi = 0;
  const hatalar = [];

  for (const urun of products.rows) {
    islemSayisi++;

    try {
      const result = await findBestSearchTerm(urun.ad, urun.varsayilan_birim, urun.piyasa_arama_terimi);

      if (result && result.terim !== urun.piyasa_arama_terimi) {
        await query('UPDATE urun_kartlari SET piyasa_arama_terimi = $1 WHERE id = $2', [result.terim, urun.id]);
        guncellemeSayisi++;
        logger.info(
          `[AramaOptimizer] ${urun.ad}: "${urun.piyasa_arama_terimi}" → "${result.terim}" (${result.sonucSayisi} sonuç, ${result.kalite})`
        );
      }
    } catch (err) {
      hatalar.push(`${urun.ad}: ${err.message}`);
    }

    // Rate limiting: Camgöz'e çok hızlı istek atma
    await new Promise((r) => setTimeout(r, 1500));
  }

  return { islemSayisi, guncellemeSayisi, hatalar };
}

/**
 * Tek ürün için arama terimini optimize et (yeni ürün eklendiğinde)
 */
export async function optimizeSingleProduct(urunKartId) {
  const result = await query('SELECT id, ad, varsayilan_birim, piyasa_arama_terimi FROM urun_kartlari WHERE id = $1', [
    urunKartId,
  ]);

  if (result.rows.length === 0) return null;

  const urun = result.rows[0];
  const best = await findBestSearchTerm(urun.ad, urun.varsayilan_birim, urun.piyasa_arama_terimi);

  if (best) {
    await query('UPDATE urun_kartlari SET piyasa_arama_terimi = $1 WHERE id = $2', [best.terim, urunKartId]);
    return best;
  }

  // Camgöz'de hiç sonuç bulunamazsa en azından temizlenmiş adı kaydet
  const temiz = urun.ad
    .replace(/\(.*?\)/g, '')
    .replace(/\d+[.,]?\d*\s*(kg|gr|lt|ml|adet)\b/gi, '')
    .trim();
  if (temiz !== urun.piyasa_arama_terimi) {
    await query('UPDATE urun_kartlari SET piyasa_arama_terimi = $1 WHERE id = $2', [temiz, urunKartId]);
  }

  return null;
}

export { findBestSearchTerm, generateCandidateTerms };

export default { optimizeAllSearchTerms, optimizeSingleProduct, generateCandidateTerms, findBestSearchTerm };
