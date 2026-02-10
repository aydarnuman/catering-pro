/**
 * Piyasa Fiyat Writer — TEK MERKEZİ YAZIM NOKTASI
 *
 * Tüm piyasa fiyat kayıtları bu servis üzerinden yapılır.
 * Birim düzeltme, anomali filtreleme, özet hesaplama ve
 * varyant cascade burada merkezi olarak yönetilir.
 *
 * Kullanan dosyalar:
 *  - piyasa-sync-scheduler.js (otomatik cron)
 *  - ai-tools/piyasa-tools.js (AI agent araştırması)
 *  - routes/planlama.js (kullanıcı arayüzü)
 */

import { query } from '../database.js';
import logger from '../utils/logger.js';
import { parseProductName } from './market-scraper.js';

// ─── SABİTLER ─────────────────────────────────────────────

/** Birim fiyat üst limitleri (TL/birim) — üstü anomali */
const BIRIM_FIYAT_MAX = {
  kg: 5000,
  L: 2000,
  adet: 1000,
};

// ─── BİRİM DÜZELTME ──────────────────────────────────────

/**
 * Birim tipini düzelt.
 * Scraper/Tavily ambalaj bilgisi bulamadığında 'adet' döner.
 * Ürün kartında varsayılan birim kg/L ise 'adet'i override eder.
 *
 * @param {string} birimTipi - Scraper'dan gelen birim ('kg', 'L', 'adet')
 * @param {string|null} dominantBirim - Ürün kartının varsayılan birimi ('kg', 'L', null)
 * @param {number|null} ambalajMiktar - Tespit edilen ambalaj miktarı
 * @returns {string} Düzeltilmiş birim tipi
 */
function fixBirimTipi(birimTipi, dominantBirim, ambalajMiktar) {
  if (!birimTipi) return dominantBirim || 'adet';

  // Zaten kg/L ise doğrudur
  if (birimTipi === 'kg' || birimTipi === 'L') return birimTipi;

  // Ürün kartı birimi normalize: gr/gram/g → kg, ml → L
  const normalizedDominant = (() => {
    if (!dominantBirim) return null;
    const d = dominantBirim.toLowerCase();
    if (['kg', 'kilo'].includes(d)) return 'kg';
    if (['gr', 'gram', 'g'].includes(d)) return 'kg';
    if (['lt', 'litre', 'l'].includes(d)) return 'L';
    if (['ml'].includes(d)) return 'L';
    return null;
  })();

  // 'adet' ama ürün kartı kg/L ve ambalaj yok = muhtemelen birim fiyat
  if (birimTipi === 'adet' && normalizedDominant) {
    if (!ambalajMiktar) {
      return normalizedDominant;
    }
  }

  return birimTipi;
}

// ─── TEK KAYIT YAZMA ─────────────────────────────────────

/**
 * Tek bir piyasa fiyat kaydı yazar.
 *
 * @param {object} params
 * @param {number|null} params.urunKartId
 * @param {number|null} params.stokKartId
 * @param {string} params.urunAdi
 * @param {string} params.marketAdi
 * @param {string|null} params.marka
 * @param {number} params.paketFiyat - Ham paket fiyatı (piyasa_fiyat_ort kolonuna yazılır)
 * @param {number} params.birimFiyat - Normalize edilmiş birim fiyat (TL/kg veya TL/L)
 * @param {string} params.birimTipi - 'kg', 'L', 'adet'
 * @param {number|null} params.ambalajMiktar
 * @param {object|null} params.kaynaklar - JSONB olarak kaydedilecek metadata
 * @param {string|null} params.aiOneri
 * @param {string} params.tarih - ISO timestamp
 * @param {number|null} params.eslestirmeSkor
 * @param {string|null} params.aramaTermi
 * @param {string|null} params.dominantBirim - Ürün kartının varsayılan birimi (birim düzeltme için)
 * @returns {Promise<boolean>} Başarılı mı
 */
async function writeSinglePrice({
  urunKartId = null,
  stokKartId = null,
  urunAdi,
  marketAdi = 'Piyasa',
  marka = null,
  paketFiyat,
  birimFiyat,
  birimTipi = 'adet',
  ambalajMiktar = null,
  kaynaklar = null,
  aiOneri = null,
  tarih = null,
  eslestirmeSkor = null,
  aramaTermi = null,
  dominantBirim = null,
}) {
  // Birim düzeltme
  const fixedBirim = fixBirimTipi(birimTipi, dominantBirim, ambalajMiktar);

  // Anomali kontrolü
  const maxAllowed = BIRIM_FIYAT_MAX[fixedBirim] || BIRIM_FIYAT_MAX.adet;
  if (birimFiyat > maxAllowed) {
    logger.debug('[PiyasaWriter] Anomali fiyat atlandı', {
      urunAdi, birimFiyat, fixedBirim, maxAllowed, marketAdi,
    });
    return false;
  }

  if (birimFiyat <= 0) return false;

  const now = tarih || new Date().toISOString();

  try {
    await query(
      `INSERT INTO piyasa_fiyat_gecmisi 
       (urun_kart_id, stok_kart_id, urun_adi, market_adi, marka, 
        piyasa_fiyat_ort, birim_fiyat, birim_tipi, ambalaj_miktar, 
        kaynaklar, ai_oneri, arastirma_tarihi, eslestirme_skoru, arama_terimi)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        urunKartId,
        stokKartId,
        urunAdi,
        marketAdi,
        marka,
        paketFiyat || 0,
        birimFiyat,
        fixedBirim,
        ambalajMiktar,
        kaynaklar ? JSON.stringify(kaynaklar) : null,
        aiOneri,
        now,
        eslestirmeSkor,
        aramaTermi,
      ]
    );
    return true;
  } catch (err) {
    logger.debug('[PiyasaWriter] Insert hatası', { urunAdi, error: err.message });
    return false;
  }
}

// ─── TOPLU YAZMA + ÖZET ──────────────────────────────────

/**
 * Birden fazla fiyat kaydı yazar, ardından özet tablosunu günceller.
 *
 * @param {object} params
 * @param {number|null} params.urunKartId - Ürün kartı ID
 * @param {number|null} params.stokKartId - Stok kartı ID
 * @param {string} params.urunAdi - Ürün adı
 * @param {Array} params.fiyatlar - Fiyat kayıtları dizisi
 * @param {string} params.kaynakTip - 'market', 'tavily_referans', 'market+tavily_ai'
 * @param {string|null} params.dominantBirim - Ürün kartının varsayılan birimi
 * @param {string|null} params.aramaTermi - Arama terimi
 * @param {string|null} params.aiOneri - AI önerisi
 * @param {boolean} params.eskiKayitlariTemizle - Bugünkü kayıtları sil (varsayılan: true)
 * @param {number} params.maxKayit - Maksimum kayıt sayısı (varsayılan: 20)
 * @returns {Promise<{savedCount: number, skippedCount: number}>}
 */
export async function savePiyasaFiyatlar({
  urunKartId = null,
  stokKartId = null,
  urunAdi,
  fiyatlar,
  kaynakTip = 'market',
  dominantBirim = null,
  aramaTermi = null,
  aiOneri = null,
  eskiKayitlariTemizle = true,
  maxKayit = 20,
}) {
  if (!fiyatlar || fiyatlar.length === 0) {
    return { savedCount: 0, skippedCount: 0 };
  }

  const now = new Date().toISOString();

  // Eski kayıtları temizle
  if (eskiKayitlariTemizle && urunKartId) {
    await query(
      `DELETE FROM piyasa_fiyat_gecmisi 
       WHERE urun_kart_id = $1 AND arastirma_tarihi::date = CURRENT_DATE`,
      [urunKartId]
    ).catch(() => {});
  }

  let savedCount = 0;
  let skippedCount = 0;

  const topFiyatlar = fiyatlar.slice(0, maxKayit);

  for (const fiyat of topFiyatlar) {
    const parsed = parseProductName(fiyat.urun || urunAdi);

    const saved = await writeSinglePrice({
      urunKartId,
      stokKartId,
      urunAdi: fiyat.urun || urunAdi,
      marketAdi: fiyat.market || 'Piyasa',
      marka: parsed.marka || fiyat.marka || null,
      paketFiyat: fiyat.fiyat || 0,
      birimFiyat: fiyat.birimFiyat || fiyat.fiyat || 0,
      birimTipi: fiyat.birimTipi || 'adet',
      ambalajMiktar: parsed.ambalajMiktar || fiyat.ambalajMiktar || null,
      kaynaklar: {
        barkod: fiyat.barkod || null,
        birimTipi: fiyat.birimTipi || 'adet',
        kaynak: kaynakTip,
        kaynakTip: kaynakTip,
      },
      aiOneri,
      tarih: now,
      eslestirmeSkor: fiyat.alakaSkor || fiyat.alaka || null,
      aramaTermi: fiyat.aramaTermi || aramaTermi || null,
      dominantBirim,
    });

    if (saved) {
      savedCount++;
    } else {
      skippedCount++;
    }
  }

  // Özet tablosunu güncelle
  if (savedCount > 0 && urunKartId) {
    await refreshOzet(urunKartId);
  }

  return { savedCount, skippedCount };
}

// ─── ÖZET YENİLEME ──────────────────────────────────────

/**
 * Tek ürün için fiyat özetini yeniler ve gerekirse
 * parent ürünün özetini de cascade günceller.
 */
export async function refreshOzet(urunKartId) {
  if (!urunKartId) return;

  try {
    await query('SELECT refresh_urun_fiyat_ozet($1)', [urunKartId]);

    // Varyant cascade: parent varsa parent'ın özetini de güncelle
    const parentCheck = await query(
      'SELECT ana_urun_id FROM urun_kartlari WHERE id = $1 AND ana_urun_id IS NOT NULL',
      [urunKartId]
    ).catch(() => ({ rows: [] }));

    if (parentCheck.rows[0]?.ana_urun_id) {
      await query('SELECT refresh_parent_fiyat_ozet($1)', [parentCheck.rows[0].ana_urun_id]).catch(() => {});
    }
  } catch (err) {
    logger.debug('[PiyasaWriter] Özet güncelleme hatası', { urunKartId, error: err.message });
  }
}

// ─── FATURA ANOMALİ TESPİT & DÜZELTME ───────────────────

/**
 * Fatura birim dönüşüm anomalisi tespiti ve düzeltme.
 *
 * Sorun: Fatura kalemlerinden gelen birim_fiyat bazen paket/koli fiyatı
 * olarak kaydediliyor (ör: 5L bidon zeytinyağı 1393 TL → kg fiyatı gibi).
 * Bu, aktif_fiyat'ın piyasa fiyatından 3x+ yüksek olmasına neden oluyor.
 *
 * Çözüm: Piyasa özeti ile karşılaştır, %300+ sapma varsa ve piyasa
 * confidence >= 0.5 ise, aktif_fiyat'ı piyasa özetiyle değiştir.
 *
 * @param {object} options
 * @param {number} options.maxSapmaOrani - Üst sapma eşiği (varsayılan: 3.0 = %300)
 * @param {number} options.minConfidence - Min piyasa confidence (varsayılan: 0.5)
 * @returns {Promise<{duzeltilen: number, detaylar: Array}>}
 */
export async function detectAndFixPriceAnomalies(options = {}) {
  const { maxSapmaOrani = 3.0, minConfidence = 0.5 } = options;

  try {
    const result = await query(
      `UPDATE urun_kartlari uk
       SET 
         aktif_fiyat = ufo.birim_fiyat_ekonomik,
         aktif_fiyat_tipi = 'PIYASA',
         son_fiyat_guncelleme = NOW()
       FROM urun_fiyat_ozet ufo
       WHERE ufo.urun_kart_id = uk.id
         AND uk.aktif = true
         AND uk.aktif_fiyat > 0
         AND ufo.birim_fiyat_ekonomik > 0
         AND ufo.confidence >= $1
         AND (uk.aktif_fiyat / ufo.birim_fiyat_ekonomik) > $2
       RETURNING uk.id, uk.ad, uk.aktif_fiyat as yeni_fiyat, uk.aktif_fiyat_tipi`,
      [minConfidence, maxSapmaOrani]
    );

    const duzeltilen = result.rows.length;
    if (duzeltilen > 0) {
      logger.info(`[PiyasaWriter] ${duzeltilen} fatura anomalisi düzeltildi`, {
        urunler: result.rows.map(r => r.ad).join(', '),
      });
    }

    return { duzeltilen, detaylar: result.rows };
  } catch (err) {
    logger.error('[PiyasaWriter] Anomali düzeltme hatası', { error: err.message });
    return { duzeltilen: 0, detaylar: [] };
  }
}

export default { savePiyasaFiyatlar, refreshOzet, detectAndFixPriceAnomalies };
