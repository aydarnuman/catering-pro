/**
 * Merkezi Eşleştirme Servisi
 *
 * Tüm eşleştirme işlemlerini tek noktadan yönetir:
 * 1. Mapping tablosundan ara (en hızlı, en güvenilir)
 * 2. Fuzzy match dene (PostgreSQL pg_trgm)
 * 3. AI eşleştirme yap (Claude)
 * 4. Bulamazsa kuyruğa ekle
 *
 * @module services/eslestirme-merkezi
 */

import { query } from '../database.js';
import logger from '../utils/logger.js';
import { aiEslestirTekKalem } from './ai-eslestirme.js';

/**
 * Eşleştirme öncelik sabitleri
 */
export const ESLESTIRME_YONTEMLERI = {
  MAPPING_KOD: { kod: 'mapping_kod', guven: 100, label: 'Mapping (Kod)' },
  MAPPING_AD: { kod: 'mapping_ad', guven: 95, label: 'Mapping (Ad)' },
  FUZZY_YUKSEK: { kod: 'fuzzy_80', guven: 85, label: 'Fuzzy Match (>80%)' },
  FUZZY_ORTA: { kod: 'fuzzy_60', guven: 70, label: 'Fuzzy Match (>60%)' },
  AI: { kod: 'ai', guven: 75, label: 'AI Eşleştirme' },
  MANUEL: { kod: 'manuel', guven: 100, label: 'Manuel' },
};

/**
 * Mapping tablosundan eşleştirme ara
 * @param {Object} kalem - Fatura kalemi
 * @returns {Promise<Object|null>}
 */
async function bulMappingEslestirme(kalem) {
  try {
    // 1. Önce kod eşleşmesi (en güvenilir)
    if (kalem.orijinal_urun_kodu) {
      const kodResult = await query(
        `
        SELECT 
          tum.id as mapping_id,
          tum.urun_kart_id,
          uk.kod as urun_kod,
          uk.ad as urun_ad,
          tum.birim_carpani,
          tum.standart_birim,
          100 as guven_skoru
        FROM tedarikci_urun_mapping tum
        JOIN urun_kartlari uk ON uk.id = tum.urun_kart_id AND uk.aktif = true
        WHERE tum.aktif = true
          AND tum.tedarikci_vkn = $1
          AND tum.fatura_urun_kodu = $2
        LIMIT 1
      `,
        [kalem.tedarikci_vkn || 'GENEL', kalem.orijinal_urun_kodu]
      );

      if (kodResult.rows.length > 0) {
        return {
          ...kodResult.rows[0],
          yontem: 'mapping_kod',
        };
      }
    }

    // 2. Ad eşleşmesi (tam)
    const adResult = await query(
      `
      SELECT 
        tum.id as mapping_id,
        tum.urun_kart_id,
        uk.kod as urun_kod,
        uk.ad as urun_ad,
        tum.birim_carpani,
        tum.standart_birim,
        95 as guven_skoru
      FROM tedarikci_urun_mapping tum
      JOIN urun_kartlari uk ON uk.id = tum.urun_kart_id AND uk.aktif = true
      WHERE tum.aktif = true
        AND tum.tedarikci_vkn = $1
        AND UPPER(TRIM(tum.fatura_urun_adi)) = UPPER(TRIM($2))
      LIMIT 1
    `,
      [kalem.tedarikci_vkn || 'GENEL', kalem.orijinal_urun_adi]
    );

    if (adResult.rows.length > 0) {
      return {
        ...adResult.rows[0],
        yontem: 'mapping_ad',
      };
    }

    // 3. Genel mapping (tedarikçi bağımsız)
    const genelResult = await query(
      `
      SELECT 
        tum.id as mapping_id,
        tum.urun_kart_id,
        uk.kod as urun_kod,
        uk.ad as urun_ad,
        tum.birim_carpani,
        tum.standart_birim,
        90 as guven_skoru
      FROM tedarikci_urun_mapping tum
      JOIN urun_kartlari uk ON uk.id = tum.urun_kart_id AND uk.aktif = true
      WHERE tum.aktif = true
        AND tum.tedarikci_vkn = 'GENEL'
        AND UPPER(TRIM(tum.fatura_urun_adi)) = UPPER(TRIM($1))
      LIMIT 1
    `,
      [kalem.orijinal_urun_adi]
    );

    if (genelResult.rows.length > 0) {
      return {
        ...genelResult.rows[0],
        yontem: 'mapping_genel',
      };
    }

    return null;
  } catch (error) {
    logger.error('Mapping eşleştirme hatası', { error: error.message });
    return null;
  }
}

/**
 * Fuzzy match ile eşleştirme ara (PostgreSQL pg_trgm)
 * @param {Object} kalem - Fatura kalemi
 * @returns {Promise<Object|null>}
 */
async function bulFuzzyEslestirme(kalem) {
  try {
    const result = await query(
      `
      SELECT 
        uk.id as urun_kart_id,
        uk.kod as urun_kod,
        uk.ad as urun_ad,
        kat.ad as kategori_ad,
        uk.varsayilan_birim,
        similarity(
          normalize_urun_adi(uk.ad), 
          normalize_urun_adi($1)
        ) as benzerlik
      FROM urun_kartlari uk
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      WHERE uk.aktif = true
        AND similarity(normalize_urun_adi(uk.ad), normalize_urun_adi($1)) > 0.4
      ORDER BY benzerlik DESC
      LIMIT 5
    `,
      [kalem.orijinal_urun_adi]
    );

    if (result.rows.length > 0) {
      const best = result.rows[0];
      const benzerlik = parseFloat(best.benzerlik);

      return {
        urun_kart_id: best.urun_kart_id,
        urun_kod: best.urun_kod,
        urun_ad: best.urun_ad,
        kategori_ad: best.kategori_ad,
        benzerlik: benzerlik,
        guven_skoru: Math.round(benzerlik * 100),
        yontem: benzerlik >= 0.8 ? 'fuzzy_80' : 'fuzzy_60',
        alternatifler: result.rows.slice(1), // Diğer öneriler
      };
    }

    return null;
  } catch (error) {
    logger.error('Fuzzy eşleştirme hatası', { error: error.message });
    return null;
  }
}

/**
 * Mapping tablosuna kaydet (öğrenme)
 * @param {Object} kalem - Fatura kalemi
 * @param {Object} eslestirme - Eşleştirme sonucu
 */
async function kaydetMapping(kalem, eslestirme) {
  try {
    await query(
      `
      INSERT INTO tedarikci_urun_mapping (
        tedarikci_vkn, tedarikci_ad,
        fatura_urun_kodu, fatura_urun_adi, fatura_birimi,
        urun_kart_id, birim_carpani, standart_birim,
        eslestirme_sayisi, son_fiyat
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9)
      ON CONFLICT (tedarikci_vkn, fatura_urun_kodu) 
      DO UPDATE SET 
        urun_kart_id = EXCLUDED.urun_kart_id,
        birim_carpani = EXCLUDED.birim_carpani,
        fatura_urun_adi = EXCLUDED.fatura_urun_adi,
        eslestirme_sayisi = tedarikci_urun_mapping.eslestirme_sayisi + 1,
        son_fiyat = EXCLUDED.son_fiyat,
        updated_at = NOW()
    `,
      [
        kalem.tedarikci_vkn || 'GENEL',
        kalem.tedarikci_ad || 'Bilinmeyen',
        kalem.orijinal_urun_kodu || kalem.orijinal_urun_adi,
        kalem.orijinal_urun_adi,
        kalem.birim,
        eslestirme.urun_kart_id,
        eslestirme.birim_carpan || eslestirme.birim_carpani || 1,
        eslestirme.standart_birim || 'KG',
        kalem.birim_fiyat,
      ]
    );

    logger.info('Mapping kaydedildi', {
      tedarikci: kalem.tedarikci_vkn,
      faturaUrun: kalem.orijinal_urun_adi,
      urunKart: eslestirme.urun_ad,
    });
  } catch (error) {
    logger.error('Mapping kaydetme hatası', { error: error.message });
  }
}

/**
 * Kuyruğa ekle (manuel onay bekleyecek)
 * @param {Object} kalem - Fatura kalemi
 * @param {Object} oneri - AI/Fuzzy önerisi (varsa)
 */
async function kuyruğaEkle(kalem, oneri = null) {
  try {
    await query(
      `
      INSERT INTO eslestirme_kuyrugu (
        kaynak_tip, kaynak_id,
        orijinal_ad, orijinal_kod,
        tedarikci_vkn, tedarikci_ad,
        birim, fiyat,
        onerilen_urun_id, onerilen_guven, oneri_yontemi,
        durum
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'bekliyor')
      ON CONFLICT DO NOTHING
    `,
      [
        'fatura',
        kalem.id,
        kalem.orijinal_urun_adi,
        kalem.orijinal_urun_kodu,
        kalem.tedarikci_vkn,
        kalem.tedarikci_ad,
        kalem.birim,
        kalem.birim_fiyat,
        oneri?.urun_kart_id || null,
        oneri?.guven_skoru || null,
        oneri?.yontem || null,
      ]
    );
  } catch (error) {
    logger.error('Kuyruğa ekleme hatası', { error: error.message });
  }
}

/**
 * Standart birim fiyatı hesapla
 * @param {Object} kalem - Fatura kalemi
 * @param {Object} eslestirme - Eşleştirme sonucu
 * @returns {number}
 */
function hesaplaStandartFiyat(kalem, eslestirme) {
  const birimCarpan = parseFloat(eslestirme.birim_carpan || eslestirme.birim_carpani || 1);
  const fiyat = parseFloat(kalem.birim_fiyat) || 0;

  // Standart fiyat = Fatura fiyatı / birim çarpanı
  // Örn: 5 KG koli 100 TL ise, kg fiyatı = 100 / 5 = 20 TL/kg
  return birimCarpan > 0 ? fiyat / birimCarpan : fiyat;
}

/**
 * Fiyat geçmişine kaydet
 * @param {Object} params - Fiyat parametreleri
 */
async function kaydetFiyatGecmisi(params) {
  try {
    const { urun_kart_id, fiyat, fatura_ettn, aciklama, cari_id } = params;

    // Fiyat kaynağı ID'si
    const kaynakResult = await query("SELECT id FROM fiyat_kaynaklari WHERE kod = 'FATURA'");
    const kaynakId = kaynakResult.rows[0]?.id;

    await query(
      `
      INSERT INTO urun_fiyat_gecmisi (
        urun_kart_id, fiyat, kaynak_id, kaynak, tarih, 
        fatura_ettn, cari_id, aciklama, dogrulanmis
      ) VALUES ($1, $2, $3, 'Fatura - Otomatik', CURRENT_DATE, $4, $5, $6, true)
      ON CONFLICT DO NOTHING
    `,
      [urun_kart_id, fiyat, kaynakId, fatura_ettn, cari_id, aciklama]
    );

    // Trigger otomatik olarak aktif_fiyat'ı güncelleyecek
    logger.info('Fiyat geçmişine kaydedildi', { urun_kart_id, fiyat });
  } catch (error) {
    logger.error('Fiyat geçmişi kaydetme hatası', { error: error.message });
  }
}

/**
 * ANA FONKSİYON: Tek kalem eşleştir
 *
 * Sırasıyla dener:
 * 1. Mapping tablosu
 * 2. Fuzzy match
 * 3. AI eşleştirme
 * 4. Kuyruğa ekle
 *
 * @param {Object} kalem - Fatura kalemi
 * @returns {Promise<Object|null>} Eşleştirme sonucu
 */
export async function eslestirKalem(kalem) {
  if (!kalem.orijinal_urun_adi) {
    return null;
  }

  // 1. Mapping tablosundan ara (en hızlı)
  const mapping = await bulMappingEslestirme(kalem);
  if (mapping && mapping.guven_skoru >= 90) {
    logger.debug('Mapping eşleştirme bulundu', {
      kalem: kalem.orijinal_urun_adi,
      urun: mapping.urun_ad,
      guven: mapping.guven_skoru,
    });
    return mapping;
  }

  // 2. Fuzzy match dene
  const fuzzy = await bulFuzzyEslestirme(kalem);
  if (fuzzy && fuzzy.benzerlik >= 0.7) {
    logger.debug('Fuzzy eşleştirme bulundu', {
      kalem: kalem.orijinal_urun_adi,
      urun: fuzzy.urun_ad,
      benzerlik: fuzzy.benzerlik,
    });

    // Yüksek benzerlik ise kabul et ve mapping'e kaydet
    if (fuzzy.benzerlik >= 0.8) {
      await kaydetMapping(kalem, fuzzy);
      return fuzzy;
    }

    // Orta benzerlik - AI ile doğrula veya kuyruğa ekle
    // Şimdilik kuyruğa ekle
    await kuyruğaEkle(kalem, fuzzy);
    return null;
  }

  // 3. AI eşleştirme dene (rate limiting için kontrol)
  try {
    const urunKartlariResult = await query(`
      SELECT id, kod, ad, varsayilan_birim, kategori_id,
             (SELECT ad FROM urun_kategorileri WHERE id = uk.kategori_id) as kategori_ad
      FROM urun_kartlari uk
      WHERE aktif = true
      ORDER BY ad
      LIMIT 200
    `);

    const ai = await aiEslestirTekKalem(kalem, urunKartlariResult.rows);

    if (ai?.urun_kart_id && ai.guven_skoru >= 70) {
      logger.debug('AI eşleştirme bulundu', {
        kalem: kalem.orijinal_urun_adi,
        urun: ai.urun_kart_adi,
        guven: ai.guven_skoru,
      });

      // Mapping'e kaydet (öğrenme)
      await kaydetMapping(kalem, {
        urun_kart_id: ai.urun_kart_id,
        urun_ad: ai.urun_kart_adi,
        birim_carpan: ai.birim_carpan,
        standart_birim: ai.standart_birim,
      });

      return {
        urun_kart_id: ai.urun_kart_id,
        urun_ad: ai.urun_kart_adi,
        guven_skoru: ai.guven_skoru,
        birim_carpan: ai.birim_carpan,
        standart_birim: ai.standart_birim,
        yontem: 'ai',
        aciklama: ai.aciklama,
      };
    } else if (ai && ai.guven_skoru < 70) {
      // Düşük güven - kuyruğa ekle
      await kuyruğaEkle(kalem, {
        urun_kart_id: ai.urun_kart_id,
        guven_skoru: ai.guven_skoru,
        yontem: 'ai',
      });
    }
  } catch (aiError) {
    logger.warn('AI eşleştirme atlandı', { error: aiError.message });
  }

  // 4. Hiçbiri bulunamadı - kuyruğa ekle
  await kuyruğaEkle(kalem, fuzzy);
  return null;
}

/**
 * ANA FONKSİYON: Eşleştir ve fiyat kaydet
 *
 * @param {Object} kalem - Fatura kalemi
 * @returns {Promise<Object|null>} Eşleştirme sonucu
 */
export async function eslestirVeFiyatKaydet(kalem) {
  const eslestirme = await eslestirKalem(kalem);

  if (eslestirme?.urun_kart_id) {
    // Standart fiyat hesapla
    const standartFiyat = hesaplaStandartFiyat(kalem, eslestirme);

    // Fiyat geçmişine kaydet (trigger aktif_fiyat'ı güncelleyecek)
    if (standartFiyat > 0) {
      await kaydetFiyatGecmisi({
        urun_kart_id: eslestirme.urun_kart_id,
        fiyat: standartFiyat,
        fatura_ettn: kalem.fatura_ettn,
        cari_id: kalem.cari_id,
        aciklama: `${kalem.tedarikci_ad}: ${kalem.orijinal_urun_adi}`,
      });
    }

    // Fatura kalemini güncelle
    await query(
      `
      UPDATE fatura_kalemleri 
      SET urun_id = $1, 
          eslestirme_tarihi = NOW(),
          birim_fiyat_standart = $3
      WHERE id = $2
    `,
      [eslestirme.urun_kart_id, kalem.id, standartFiyat]
    );

    logger.info('Kalem eşleştirildi ve fiyat kaydedildi', {
      kalem: kalem.orijinal_urun_adi,
      urun: eslestirme.urun_ad,
      yontem: eslestirme.yontem,
      guven: eslestirme.guven_skoru,
      fiyat: standartFiyat,
    });

    return eslestirme;
  }

  return null;
}

/**
 * Toplu eşleştirme - Eşleşmemiş tüm kalemleri işle
 * @param {number} limit - Maksimum kalem sayısı
 * @returns {Promise<Object>} Sonuç özeti
 */
export async function topluEslestir(limit = 50) {
  const sonuc = { basarili: 0, hatali: 0, kuyruk: 0 };

  try {
    // Eşleşmemiş kalemleri al
    const kalemlerResult = await query(
      `
      SELECT 
        fk.id,
        fk.fatura_ettn,
        fk.orijinal_urun_adi,
        fk.orijinal_urun_kodu,
        fk.birim,
        fk.birim_fiyat,
        fk.miktar,
        fk.tedarikci_vkn,
        fk.tedarikci_ad,
        f.cari_id
      FROM fatura_kalemleri fk
      LEFT JOIN invoices f ON f.ettn = fk.fatura_ettn
      WHERE fk.urun_id IS NULL
        AND fk.orijinal_urun_adi IS NOT NULL
      ORDER BY fk.created_at DESC
      LIMIT $1
    `,
      [limit]
    );

    for (const kalem of kalemlerResult.rows) {
      try {
        const eslestirme = await eslestirVeFiyatKaydet(kalem);

        if (eslestirme) {
          sonuc.basarili++;
        } else {
          sonuc.kuyruk++;
        }

        // Rate limiting (AI için)
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        sonuc.hatali++;
        logger.error('Kalem eşleştirme hatası', {
          kalem: kalem.orijinal_urun_adi,
          error: error.message,
        });
      }
    }

    logger.info('Toplu eşleştirme tamamlandı', sonuc);
    return sonuc;
  } catch (error) {
    logger.error('Toplu eşleştirme hatası', { error: error.message });
    throw error;
  }
}

/**
 * Kuyruktan manuel onaylı eşleştirme
 * @param {number} kuyrukId - Kuyruk kaydı ID
 * @param {number} urunKartId - Seçilen ürün kartı ID
 * @param {number} birimCarpan - Birim çarpanı
 */
export async function kuyrukOnayla(kuyrukId, urunKartId, birimCarpan = 1) {
  try {
    // Kuyruk kaydını al
    const kuyrukResult = await query('SELECT * FROM eslestirme_kuyrugu WHERE id = $1', [kuyrukId]);

    if (kuyrukResult.rows.length === 0) {
      throw new Error('Kuyruk kaydı bulunamadı');
    }

    const kayit = kuyrukResult.rows[0];

    // Ürün kartını al
    const urunResult = await query('SELECT id, ad FROM urun_kartlari WHERE id = $1', [urunKartId]);

    if (urunResult.rows.length === 0) {
      throw new Error('Ürün kartı bulunamadı');
    }

    const urun = urunResult.rows[0];

    // Mapping'e kaydet
    await kaydetMapping(
      {
        tedarikci_vkn: kayit.tedarikci_vkn,
        tedarikci_ad: kayit.tedarikci_ad,
        orijinal_urun_adi: kayit.orijinal_ad,
        orijinal_urun_kodu: kayit.orijinal_kod,
        birim: kayit.birim,
        birim_fiyat: kayit.fiyat,
      },
      {
        urun_kart_id: urunKartId,
        urun_ad: urun.ad,
        birim_carpan: birimCarpan,
      }
    );

    // Fatura kalemini güncelle (varsa)
    if (kayit.kaynak_id && kayit.kaynak_tip === 'fatura') {
      const standartFiyat = kayit.fiyat / birimCarpan;

      await query(
        `
        UPDATE fatura_kalemleri 
        SET urun_id = $1, eslestirme_tarihi = NOW(), birim_fiyat_standart = $3
        WHERE id = $2
      `,
        [urunKartId, kayit.kaynak_id, standartFiyat]
      );

      // Fiyat geçmişine kaydet
      if (standartFiyat > 0) {
        await kaydetFiyatGecmisi({
          urun_kart_id: urunKartId,
          fiyat: standartFiyat,
          aciklama: `Manuel onay: ${kayit.orijinal_ad}`,
        });
      }
    }

    // Kuyruktan kaldır
    await query(
      `
      UPDATE eslestirme_kuyrugu 
      SET durum = 'onaylandi', islem_tarihi = NOW()
      WHERE id = $1
    `,
      [kuyrukId]
    );

    logger.info('Kuyruk onaylandı', { kuyrukId, urunKartId });
    return { success: true };
  } catch (error) {
    logger.error('Kuyruk onaylama hatası', { error: error.message });
    throw error;
  }
}

export default {
  eslestirKalem,
  eslestirVeFiyatKaydet,
  topluEslestir,
  kuyrukOnayla,
  ESLESTIRME_YONTEMLERI,
};
