/**
 * Fiyat Motor - Aktif fiyat hesaplama servisi
 * =============================================
 * Ürün kartları için aktif fiyat hesaplaması.
 * Öncelik sırası: fatura (güncel) > piyasa > fatura (eski) > manuel > 0
 *
 * Kullanım:
 *   import { hesaplaAktifFiyat } from './fiyat-motor.js';
 *   const sonuc = await hesaplaAktifFiyat(urunId, { aiTahminiKullan: true });
 */

import { query } from '../database.js';
import logger from '../utils/logger.js';

// Fiyat geçerlilik süresi (gün)
const FIYAT_GECERLILIK_GUN = 90;

/**
 * Ürün kartı için aktif fiyatı hesapla
 *
 * @param {string|number} urunId - Ürün kartı ID
 * @param {Object} options - Seçenekler
 * @param {boolean} options.aiTahminiKullan - AI tahmini kullanılsın mı (şu an kullanılmıyor)
 * @returns {Promise<{fiyat: number|null, tip: string|null, tarih: string|null, guncel: boolean}>}
 */
export async function hesaplaAktifFiyat(urunId, options = {}) {
  const { aiTahminiKullan = false } = options;

  try {
    const result = await query(
      `SELECT
        id, ad, birim,
        son_alis_fiyati, son_alis_tarihi,
        aktif_fiyat, aktif_fiyat_tipi,
        manuel_fiyat, piyasa_fiyati, piyasa_fiyat_tarihi
      FROM urun_kartlari
      WHERE id = $1`,
      [urunId]
    );

    if (!result.rows.length) {
      return { fiyat: null, tip: null, tarih: null, guncel: false };
    }

    const urun = result.rows[0];

    // 1. Güncel fatura fiyatı (son 90 gün içinde)
    if (urun.son_alis_fiyati && urun.son_alis_fiyati > 0 && urun.son_alis_tarihi) {
      const gunFarki = gunHesapla(urun.son_alis_tarihi);
      if (gunFarki <= FIYAT_GECERLILIK_GUN) {
        return {
          fiyat: Number.parseFloat(urun.son_alis_fiyati),
          tip: 'FATURA',
          tarih: urun.son_alis_tarihi,
          guncel: true,
        };
      }
    }

    // 2. Piyasa fiyatı
    if (urun.piyasa_fiyati && urun.piyasa_fiyati > 0) {
      const guncel = urun.piyasa_fiyat_tarihi ? gunHesapla(urun.piyasa_fiyat_tarihi) <= FIYAT_GECERLILIK_GUN : false;
      return {
        fiyat: Number.parseFloat(urun.piyasa_fiyati),
        tip: 'PIYASA',
        tarih: urun.piyasa_fiyat_tarihi || null,
        guncel,
      };
    }

    // 3. Eski fatura fiyatı (süresi geçmiş ama var)
    if (urun.son_alis_fiyati && urun.son_alis_fiyati > 0) {
      return {
        fiyat: Number.parseFloat(urun.son_alis_fiyati),
        tip: 'FATURA_ESKI',
        tarih: urun.son_alis_tarihi,
        guncel: false,
      };
    }

    // 4. Manuel fiyat
    if (urun.manuel_fiyat && urun.manuel_fiyat > 0) {
      return {
        fiyat: Number.parseFloat(urun.manuel_fiyat),
        tip: 'MANUEL',
        tarih: null,
        guncel: false,
      };
    }

    // 5. Fiyat bulunamadı
    if (aiTahminiKullan) {
      logger.debug('[FiyatMotor] AI tahmini henüz implemente edilmedi', { urunId });
    }

    return { fiyat: null, tip: null, tarih: null, guncel: false };
  } catch (error) {
    logger.error('[FiyatMotor] Aktif fiyat hesaplama hatası', {
      urunId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Tarihten bugüne kaç gün geçtiğini hesapla
 * @param {Date|string} tarih
 * @returns {number}
 */
function gunHesapla(tarih) {
  if (!tarih) return Number.POSITIVE_INFINITY;
  const fark = Date.now() - new Date(tarih).getTime();
  return Math.floor(fark / (1000 * 60 * 60 * 24));
}
