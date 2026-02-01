/**
 * Fiyat Scraping Servisi
 *
 * TZOB, ESK, Hal fiyatları ve diğer kaynaklardan
 * otomatik fiyat çekme servisi
 */

import { query } from '../database.js';
import logger from '../utils/logger.js';

// =====================================================
// TZOB - Türkiye Ziraat Odaları Birliği
// Haftalık sebze-meyve fiyatları
// https://www.tzob.org.tr/basin-odasi/tzob-tarafindan-hazirlanan-uretici-market-fiyatlari
// =====================================================

/**
 * TZOB fiyatlarını parse et (manuel girilen JSON veriden)
 * Not: TZOB direkt API sunmuyor, haftalık bülten PDF yayınlıyor
 * Bu fonksiyon manuel girilen veya OCR'dan çekilmiş veriyi işler
 */
export async function parseTZOBFiyatlari(veriJson) {
  const sonuclar = [];

  try {
    // Kaynak ID'yi al
    const kaynakResult = await query("SELECT id FROM fiyat_kaynaklari WHERE kod = 'TZOB'");
    const kaynakId = kaynakResult.rows[0]?.id;

    if (!kaynakId) {
      throw new Error('TZOB kaynak bulunamadı');
    }

    // veriJson formatı: [{urun_adi, uretici_fiyat, market_fiyat, birim}]
    for (const item of veriJson) {
      try {
        // Ürünü bul (normalize edilmiş isimle)
        const urunResult = await query(
          `
          SELECT id, kod, ad FROM urun_kartlari 
          WHERE aktif = true 
            AND (
              LOWER(ad) LIKE LOWER($1) 
              OR ad_normalized LIKE LOWER($2)
            )
          LIMIT 1
        `,
          [`%${item.urun_adi}%`, `%${normalizeText(item.urun_adi)}%`]
        );

        if (urunResult.rows.length === 0) {
          logger.debug('TZOB - Ürün bulunamadı', { urun_adi: item.urun_adi });
          continue;
        }

        const urun = urunResult.rows[0];
        const fiyat = parseFloat(item.market_fiyat || item.uretici_fiyat);

        if (Number.isNaN(fiyat) || fiyat <= 0) continue;

        // Fiyat geçmişine ekle
        await query(
          `
          INSERT INTO urun_fiyat_gecmisi (
            urun_kart_id, fiyat, kaynak_id, kaynak, birim, 
            min_fiyat, max_fiyat, tarih, ham_veri
          ) VALUES ($1, $2, $3, 'TZOB Haftalık Bülten', $4, $5, $6, CURRENT_DATE, $7)
        `,
          [
            urun.id,
            fiyat,
            kaynakId,
            item.birim || 'kg',
            item.uretici_fiyat ? parseFloat(item.uretici_fiyat) : null,
            item.market_fiyat ? parseFloat(item.market_fiyat) : null,
            JSON.stringify(item),
          ]
        );

        sonuclar.push({
          urun_id: urun.id,
          urun_kod: urun.kod,
          urun_ad: urun.ad,
          fiyat,
          kaynak: 'TZOB',
        });
      } catch (itemError) {
        logger.warn('TZOB fiyat işleme hatası', {
          error: itemError.message,
          item,
        });
      }
    }

    // Kaynak güncelleme zamanını kaydet
    await query(`
      UPDATE fiyat_kaynaklari 
      SET son_basarili_guncelleme = NOW()
      WHERE kod = 'TZOB'
    `);

    // Log kaydı
    await query(
      `
      INSERT INTO fiyat_scraping_log (kaynak_id, basarili, toplam_urun, guncellenen_urun)
      VALUES ($1, true, $2, $3)
    `,
      [kaynakId, veriJson.length, sonuclar.length]
    );

    return {
      success: true,
      toplam: veriJson.length,
      guncellenen: sonuclar.length,
      sonuclar,
    };
  } catch (error) {
    logger.error('TZOB fiyat parse hatası', { error: error.message });
    throw error;
  }
}

// =====================================================
// ESK - Et ve Süt Kurumu
// https://www.esk.gov.tr/tr/11861/Fiyatlarimiz
// =====================================================

/**
 * ESK fiyatlarını parse et
 * ESK statik fiyat listesi yayınlıyor
 */
export async function parseESKFiyatlari(veriJson) {
  const sonuclar = [];

  try {
    const kaynakResult = await query("SELECT id FROM fiyat_kaynaklari WHERE kod = 'ESK'");
    const kaynakId = kaynakResult.rows[0]?.id;

    if (!kaynakId) {
      throw new Error('ESK kaynak bulunamadı');
    }

    // veriJson formatı: [{urun_adi, fiyat, birim, kdv_dahil}]
    for (const item of veriJson) {
      try {
        // Et ve süt ürünlerini ara
        const urunResult = await query(
          `
          SELECT uk.id, uk.kod, uk.ad 
          FROM urun_kartlari uk
          JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
          WHERE uk.aktif = true 
            AND kat.ad IN ('Et & Tavuk', 'Süt Ürünleri')
            AND (
              LOWER(uk.ad) LIKE LOWER($1)
              OR uk.ad_normalized LIKE LOWER($2)
            )
          LIMIT 1
        `,
          [`%${item.urun_adi}%`, `%${normalizeText(item.urun_adi)}%`]
        );

        if (urunResult.rows.length === 0) {
          logger.debug('ESK - Ürün bulunamadı', { urun_adi: item.urun_adi });
          continue;
        }

        const urun = urunResult.rows[0];
        const fiyat = parseFloat(item.fiyat);

        if (Number.isNaN(fiyat) || fiyat <= 0) continue;

        await query(
          `
          INSERT INTO urun_fiyat_gecmisi (
            urun_kart_id, fiyat, kaynak_id, kaynak, birim, tarih, ham_veri
          ) VALUES ($1, $2, $3, 'ESK Resmi Fiyat', $4, CURRENT_DATE, $5)
        `,
          [urun.id, fiyat, kaynakId, item.birim || 'kg', JSON.stringify(item)]
        );

        sonuclar.push({
          urun_id: urun.id,
          urun_kod: urun.kod,
          urun_ad: urun.ad,
          fiyat,
          kaynak: 'ESK',
        });
      } catch (itemError) {
        logger.warn('ESK fiyat işleme hatası', { error: itemError.message, item });
      }
    }

    await query(`
      UPDATE fiyat_kaynaklari 
      SET son_basarili_guncelleme = NOW()
      WHERE kod = 'ESK'
    `);

    await query(
      `
      INSERT INTO fiyat_scraping_log (kaynak_id, basarili, toplam_urun, guncellenen_urun)
      VALUES ($1, true, $2, $3)
    `,
      [kaynakId, veriJson.length, sonuclar.length]
    );

    return {
      success: true,
      toplam: veriJson.length,
      guncellenen: sonuclar.length,
      sonuclar,
    };
  } catch (error) {
    logger.error('ESK fiyat parse hatası', { error: error.message });
    throw error;
  }
}

// =====================================================
// HAL FİYATLARI
// İstanbul, Ankara vb. toptancı hal fiyatları
// =====================================================

/**
 * Hal fiyatlarını parse et
 */
export async function parseHalFiyatlari(veriJson, bolge = 'istanbul') {
  const sonuclar = [];

  try {
    const kaynakResult = await query("SELECT id FROM fiyat_kaynaklari WHERE kod = 'HAL'");
    const kaynakId = kaynakResult.rows[0]?.id;

    if (!kaynakId) {
      throw new Error('HAL kaynak bulunamadı');
    }

    // veriJson formatı: [{urun_adi, min_fiyat, max_fiyat, ortalama_fiyat, birim}]
    for (const item of veriJson) {
      try {
        // Sebze-meyve kategorisinde ara
        const urunResult = await query(
          `
          SELECT uk.id, uk.kod, uk.ad 
          FROM urun_kartlari uk
          JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
          WHERE uk.aktif = true 
            AND kat.ad IN ('Sebzeler', 'Meyveler')
            AND (
              LOWER(uk.ad) LIKE LOWER($1)
              OR uk.ad_normalized LIKE LOWER($2)
            )
          LIMIT 1
        `,
          [`%${item.urun_adi}%`, `%${normalizeText(item.urun_adi)}%`]
        );

        if (urunResult.rows.length === 0) {
          logger.debug('HAL - Ürün bulunamadı', { urun_adi: item.urun_adi });
          continue;
        }

        const urun = urunResult.rows[0];
        const fiyat = parseFloat(item.ortalama_fiyat || item.max_fiyat);

        if (Number.isNaN(fiyat) || fiyat <= 0) continue;

        await query(
          `
          INSERT INTO urun_fiyat_gecmisi (
            urun_kart_id, fiyat, kaynak_id, kaynak, birim, 
            bolge, min_fiyat, max_fiyat, tarih, ham_veri
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE, $9)
        `,
          [
            urun.id,
            fiyat,
            kaynakId,
            `Hal Fiyatı (${bolge})`,
            item.birim || 'kg',
            bolge,
            item.min_fiyat ? parseFloat(item.min_fiyat) : null,
            item.max_fiyat ? parseFloat(item.max_fiyat) : null,
            JSON.stringify(item),
          ]
        );

        sonuclar.push({
          urun_id: urun.id,
          urun_kod: urun.kod,
          urun_ad: urun.ad,
          fiyat,
          bolge,
          kaynak: 'HAL',
        });
      } catch (itemError) {
        logger.warn('HAL fiyat işleme hatası', { error: itemError.message, item });
      }
    }

    await query(`
      UPDATE fiyat_kaynaklari 
      SET son_basarili_guncelleme = NOW()
      WHERE kod = 'HAL'
    `);

    await query(
      `
      INSERT INTO fiyat_scraping_log (kaynak_id, basarili, toplam_urun, guncellenen_urun)
      VALUES ($1, true, $2, $3)
    `,
      [kaynakId, veriJson.length, sonuclar.length]
    );

    return {
      success: true,
      toplam: veriJson.length,
      guncellenen: sonuclar.length,
      sonuclar,
    };
  } catch (error) {
    logger.error('HAL fiyat parse hatası', { error: error.message });
    throw error;
  }
}

// =====================================================
// TOPLU FİYAT GÜNCELLEME
// =====================================================

/**
 * Tüm kaynakların güven skorlarını yeniden hesapla
 */
export async function yenidenHesaplaGuvenSkorlari() {
  try {
    const urunlerResult = await query(`
      SELECT id FROM urun_kartlari WHERE aktif = true
    `);

    let guncellenen = 0;

    for (const urun of urunlerResult.rows) {
      await query(
        `
        UPDATE urun_kartlari
        SET fiyat_guven_skoru = hesapla_fiyat_guven_skoru($1)
        WHERE id = $1
      `,
        [urun.id]
      );
      guncellenen++;
    }

    logger.info('Güven skorları güncellendi', { guncellenen });

    return { success: true, guncellenen };
  } catch (error) {
    logger.error('Güven skoru güncelleme hatası', { error: error.message });
    throw error;
  }
}

/**
 * Eskimiş fiyat kontrolü çalıştır
 */
export async function eskimisFiyatKontrolu() {
  try {
    const result = await query('SELECT fiyat_eskime_kontrolu() as eklenen');

    logger.info('Eskimiş fiyat kontrolü tamamlandı', {
      yeniUyari: result.rows[0].eklenen,
    });

    return {
      success: true,
      yeniUyari: result.rows[0].eklenen,
    };
  } catch (error) {
    logger.error('Eskimiş fiyat kontrolü hatası', { error: error.message });
    throw error;
  }
}

// =====================================================
// MEVSİMSEL ANALİZ
// =====================================================

/**
 * Geçmiş verilerden mevsimsel katsayıları hesapla
 */
export async function hesaplaMevsimselKatsayilar(urunId) {
  try {
    // Son 2 yılın verilerini al
    const gecmisResult = await query(
      `
      SELECT 
        EXTRACT(MONTH FROM created_at)::INTEGER as ay,
        AVG(fiyat) as ortalama_fiyat,
        COUNT(*) as kayit_sayisi
      FROM urun_fiyat_gecmisi
      WHERE urun_kart_id = $1
        AND created_at > NOW() - INTERVAL '2 years'
        AND fiyat > 0
      GROUP BY EXTRACT(MONTH FROM created_at)
      ORDER BY ay
    `,
      [urunId]
    );

    if (gecmisResult.rows.length < 6) {
      return {
        success: false,
        message: 'Yeterli geçmiş veri yok (en az 6 aylık veri gerekli)',
      };
    }

    // Genel ortalamayı hesapla
    const toplamOrtalama =
      gecmisResult.rows.reduce((sum, row) => sum + parseFloat(row.ortalama_fiyat), 0) / gecmisResult.rows.length;

    // Her ay için katsayı hesapla ve kaydet
    const katsayilar = [];

    for (const row of gecmisResult.rows) {
      const katsayi = parseFloat(row.ortalama_fiyat) / toplamOrtalama;

      await query(
        `
        INSERT INTO mevsimsel_katsayilar (urun_kart_id, ay, katsayi, gecmis_ortalama)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (urun_kart_id, ay) 
        DO UPDATE SET 
          katsayi = $3, 
          gecmis_ortalama = $4,
          updated_at = NOW()
      `,
        [urunId, row.ay, Math.round(katsayi * 100) / 100, row.ortalama_fiyat]
      );

      katsayilar.push({
        ay: row.ay,
        katsayi: Math.round(katsayi * 100) / 100,
        ortalama: parseFloat(row.ortalama_fiyat).toFixed(2),
      });
    }

    // Ürünü mevsimsel olarak işaretle
    await query(
      `
      UPDATE urun_kartlari SET mevsimsel = true WHERE id = $1
    `,
      [urunId]
    );

    return {
      success: true,
      toplamOrtalama,
      katsayilar,
    };
  } catch (error) {
    logger.error('Mevsimsel katsayı hesaplama hatası', { error: error.message });
    throw error;
  }
}

// =====================================================
// YARDIMCI FONKSİYONLAR
// =====================================================

/**
 * Türkçe metin normalizasyonu
 */
function normalizeText(text) {
  if (!text) return '';

  return text
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/**
 * Fiyat scraping durumu
 */
export async function getScrapingDurumu() {
  try {
    const result = await query(`
      SELECT 
        fk.kod,
        fk.ad,
        fk.guvenilirlik_skoru,
        fk.son_basarili_guncelleme,
        fk.son_hata_mesaji,
        fk.aktif,
        (
          SELECT COUNT(*) 
          FROM urun_fiyat_gecmisi 
          WHERE kaynak_id = fk.id 
            AND created_at > NOW() - INTERVAL '7 days'
        ) as son_7_gun_kayit,
        (
          SELECT MAX(created_at) 
          FROM fiyat_scraping_log 
          WHERE kaynak_id = fk.id AND basarili = true
        ) as son_basarili_log
      FROM fiyat_kaynaklari fk
      WHERE fk.aktif = true
      ORDER BY fk.guvenilirlik_skoru DESC
    `);

    return result.rows;
  } catch (error) {
    logger.error('Scraping durumu hatası', { error: error.message });
    throw error;
  }
}

export default {
  parseTZOBFiyatlari,
  parseESKFiyatlari,
  parseHalFiyatlari,
  yenidenHesaplaGuvenSkorlari,
  eskimisFiyatKontrolu,
  hesaplaMevsimselKatsayilar,
  getScrapingDurumu,
};
