/**
 * Fiyat Motor Servisi
 * Merkezi fiyat hesaplama ve yönetim servisi
 * Single Source of Truth - aktif_fiyat sistemi
 */

import { query } from '../database.js';
import logger from '../utils/logger.js';
import Anthropic from '@anthropic-ai/sdk';

// Claude API client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Fiyat tipi öncelikleri ve güven skorları
 */
export const FIYAT_ONCELIKLERI = {
  SOZLESME: { oncelik: 1, guven: 100, label: 'Tedarikçi Sözleşmesi' },
  FATURA: { oncelik: 2, guven: 95, label: 'Fatura (Son 30 gün)' },
  PIYASA: { oncelik: 3, guven: 80, label: 'Piyasa Verisi' },
  FATURA_ESKI: { oncelik: 4, guven: 60, label: 'Fatura (30-90 gün)' },
  MANUEL: { oncelik: 5, guven: 50, label: 'Manuel Giriş' },
  AI_TAHMINI: { oncelik: 6, guven: 40, label: 'AI Tahmini' },
};

/**
 * AI ile fiyat tahmini yap (Claude)
 * @param {Object} urun - Ürün bilgisi {id, ad, kategori_ad, varsayilan_birim}
 * @returns {Promise<{fiyat: number, aciklama: string, guven: number} | null>}
 */
export async function aiTahminiFiyat(urun) {
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.warn('AI fiyat tahmini için ANTHROPIC_API_KEY gerekli');
    return null;
  }

  const prompt = `Sen Türkiye gıda toptan piyasası uzmanısın. Ocak 2026 itibariyle aşağıdaki ürün için güncel TOPTAN (perakende değil!) birim fiyat tahmini yap.

ÜRÜN BİLGİSİ:
- Ad: ${urun.ad}
- Kategori: ${urun.kategori_ad || 'Genel Gıda'}
- Birim: ${urun.varsayilan_birim || 'kg'}

KURALLAR:
1. TOPTAN fiyat ver (market/perakende değil, toptancı/hal/çarşı fiyatı)
2. Birim fiyat ver (1 kg, 1 lt, 1 adet için)
3. Türkiye piyasası için TL cinsinden
4. Çok yüksek veya çok düşük verme, gerçekçi ol
5. Bilmiyorsan tahmin YAPMA, null döndür

JSON formatında yanıt ver:
{
  "fiyat": <number - TL cinsinden birim fiyat veya null>,
  "aciklama": "<fiyatı nasıl belirledin, hangi faktörleri değerlendirdin>",
  "guven": <0-100 arası güven skoru>
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      logger.warn('AI fiyat tahmini JSON parse hatası', { urunId: urun.id, content });
      return null;
    }

    const result = JSON.parse(jsonMatch[0]);

    // Fiyat null veya 0 ise tahmin yapılmadı
    if (!result.fiyat || result.fiyat <= 0) {
      logger.info('AI fiyat tahmini yapılamadı', { urunId: urun.id, urunAd: urun.ad });
      return null;
    }

    logger.info('AI fiyat tahmini başarılı', {
      urunId: urun.id,
      urunAd: urun.ad,
      fiyat: result.fiyat,
      guven: result.guven,
    });

    return {
      fiyat: parseFloat(result.fiyat),
      aciklama: (result.aciklama || '').substring(0, 450), // DB varchar(500) sınırı
      guven: result.guven || 40,
    };
  } catch (error) {
    logger.error('AI fiyat tahmini hatası', { urunId: urun.id, error: error.message });
    return null;
  }
}

/**
 * Tek ürün için aktif fiyatı hesapla (DB fonksiyonunu çağırır)
 * Eğer fiyat bulunamazsa AI tahmini yapar
 * @param {number} urunId - Ürün kart ID
 * @param {Object} options - Seçenekler
 * @param {boolean} options.aiTahminiKullan - AI tahmini kullanılsın mı (varsayılan: true)
 * @returns {Promise<{fiyat, tip, kaynak_id, guven}>}
 */
export async function hesaplaAktifFiyat(urunId, options = {}) {
  const { aiTahminiKullan = true } = options;

  try {
    const result = await query('SELECT * FROM recalc_urun_aktif_fiyat($1)', [urunId]);

    if (result.rows.length > 0) {
      const row = result.rows[0];

      // Fiyat varsa ve VARSAYILAN değilse direkt döndür
      if (row.fiyat && row.tip !== 'VARSAYILAN') {
        return {
          fiyat: parseFloat(row.fiyat),
          tip: row.tip,
          kaynak_id: row.kaynak_id,
          guven: row.guven || 0,
          tipLabel: FIYAT_ONCELIKLERI[row.tip]?.label,
        };
      }

      // Fiyat yok veya VARSAYILAN ise AI tahmini dene
      if (aiTahminiKullan) {
        const urunResult = await query(`
          SELECT uk.id, uk.ad, uk.varsayilan_birim, kat.ad as kategori_ad
          FROM urun_kartlari uk
          LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
          WHERE uk.id = $1
        `, [urunId]);

        if (urunResult.rows.length > 0) {
          const urun = urunResult.rows[0];
          const aiTahmin = await aiTahminiFiyat(urun);

          if (aiTahmin) {
            // AI tahminini kaydet
            const kaynakResult = await query("SELECT id FROM fiyat_kaynaklari WHERE kod = 'AI_TAHMINI'");
            const kaynakId = kaynakResult.rows[0]?.id;

            if (kaynakId) {
              await query(`
                INSERT INTO urun_fiyat_gecmisi (
                  urun_kart_id, fiyat, kaynak_id, kaynak, tarih, aciklama
                ) VALUES ($1, $2, $3, 'AI Tahmini', CURRENT_DATE, $4)
                ON CONFLICT DO NOTHING
              `, [urunId, aiTahmin.fiyat, kaynakId, aiTahmin.aciklama]);
            }

            // Aktif fiyatı güncelle
            await query(`
              UPDATE urun_kartlari SET
                aktif_fiyat = $2,
                aktif_fiyat_tipi = 'AI_TAHMINI',
                aktif_fiyat_guven = $3,
                aktif_fiyat_kaynagi_id = $4,
                aktif_fiyat_guncelleme = NOW()
              WHERE id = $1
            `, [urunId, aiTahmin.fiyat, aiTahmin.guven, kaynakId]);

            return {
              fiyat: aiTahmin.fiyat,
              tip: 'AI_TAHMINI',
              kaynak_id: kaynakId,
              guven: aiTahmin.guven,
              tipLabel: FIYAT_ONCELIKLERI.AI_TAHMINI.label,
              aciklama: aiTahmin.aciklama,
            };
          }
        }
      }

      // AI de yapamadıysa null döndür (sahte veri yok!)
      return { fiyat: null, tip: null, kaynak_id: null, guven: 0, tipLabel: null };
    }

    return { fiyat: null, tip: null, kaynak_id: null, guven: 0, tipLabel: null };
  } catch (error) {
    logger.error('Aktif fiyat hesaplama hatası', { urunId, error: error.message });
    throw error;
  }
}

/**
 * Birden fazla ürün için aktif fiyat hesapla
 * @param {number[]} urunIds - Ürün kart ID listesi
 * @returns {Promise<Map<number, {fiyat, tip, guven}>>}
 */
export async function hesaplaTopluAktifFiyat(urunIds) {
  const sonuclar = new Map();

  try {
    // Paralel hesaplama için Promise.all kullan
    const promises = urunIds.map(async (urunId) => {
      const sonuc = await hesaplaAktifFiyat(urunId);
      return { urunId, sonuc };
    });

    const results = await Promise.all(promises);
    results.forEach(({ urunId, sonuc }) => {
      sonuclar.set(urunId, sonuc);
    });

    logger.info(`Toplu fiyat hesaplandı: ${urunIds.length} ürün`);
    return sonuclar;
  } catch (error) {
    logger.error('Toplu fiyat hesaplama hatası', { error: error.message });
    throw error;
  }
}

/**
 * Ürünün fiyat detaylarını getir (tüm kaynaklar)
 * @param {number} urunId - Ürün kart ID
 * @returns {Promise<Object>}
 */
export async function getFiyatDetay(urunId) {
  try {
    // Aktif fiyat bilgisi
    const urunResult = await query(
      `
      SELECT 
        uk.id,
        uk.kod,
        uk.ad,
        uk.varsayilan_birim,
        uk.aktif_fiyat,
        uk.aktif_fiyat_tipi,
        uk.aktif_fiyat_guven,
        uk.aktif_fiyat_guncelleme,
        uk.manuel_fiyat,
        uk.son_alis_fiyati,
        fk.ad as kaynak_adi
      FROM urun_kartlari uk
      LEFT JOIN fiyat_kaynaklari fk ON fk.id = uk.aktif_fiyat_kaynagi_id
      WHERE uk.id = $1
    `,
      [urunId]
    );

    if (urunResult.rows.length === 0) {
      return null;
    }

    const urun = urunResult.rows[0];

    // Tedarikçi fiyatları
    const tedarikciResult = await query(
      `
      SELECT 
        tf.id,
        tf.fiyat,
        tf.birim,
        tf.gecerlilik_baslangic,
        tf.gecerlilik_bitis,
        tf.aktif,
        tf.sozlesme_no,
        c.unvan as tedarikci_adi
      FROM tedarikci_fiyatlari tf
      JOIN cariler c ON c.id = tf.cari_id
      WHERE tf.urun_kart_id = $1
      ORDER BY tf.aktif DESC, tf.fiyat ASC
    `,
      [urunId]
    );

    // Son fiyat geçmişi (son 90 gün)
    const gecmisResult = await query(
      `
      SELECT 
        ufg.id,
        ufg.fiyat,
        ufg.tarih,
        ufg.kaynak,
        fk.ad as kaynak_adi,
        fk.kod as kaynak_kodu
      FROM urun_fiyat_gecmisi ufg
      LEFT JOIN fiyat_kaynaklari fk ON fk.id = ufg.kaynak_id
      WHERE ufg.urun_kart_id = $1
        AND ufg.tarih >= CURRENT_DATE - INTERVAL '90 days'
      ORDER BY ufg.tarih DESC, ufg.id DESC
      LIMIT 50
    `,
      [urunId]
    );

    // Fiyat istatistikleri
    const statsResult = await query(
      `
      SELECT 
        MIN(fiyat) as min_fiyat,
        MAX(fiyat) as max_fiyat,
        AVG(fiyat) as ort_fiyat,
        COUNT(*) as kayit_sayisi
      FROM urun_fiyat_gecmisi
      WHERE urun_kart_id = $1
        AND tarih >= CURRENT_DATE - INTERVAL '90 days'
    `,
      [urunId]
    );

    return {
      urun: {
        ...urun,
        aktif_fiyat: urun.aktif_fiyat ? parseFloat(urun.aktif_fiyat) : null,
        manuel_fiyat: urun.manuel_fiyat ? parseFloat(urun.manuel_fiyat) : null,
        son_alis_fiyati: urun.son_alis_fiyati ? parseFloat(urun.son_alis_fiyati) : null,
        tipLabel: urun.aktif_fiyat_tipi ? FIYAT_ONCELIKLERI[urun.aktif_fiyat_tipi]?.label : null,
      },
      tedarikci_fiyatlari: tedarikciResult.rows.map((t) => ({
        ...t,
        fiyat: parseFloat(t.fiyat),
      })),
      fiyat_gecmisi: gecmisResult.rows.map((g) => ({
        ...g,
        fiyat: parseFloat(g.fiyat),
      })),
      istatistikler: statsResult.rows[0]
        ? {
            min_fiyat: parseFloat(statsResult.rows[0].min_fiyat) || null,
            max_fiyat: parseFloat(statsResult.rows[0].max_fiyat) || null,
            ort_fiyat: parseFloat(statsResult.rows[0].ort_fiyat) || null,
            kayit_sayisi: parseInt(statsResult.rows[0].kayit_sayisi, 10) || 0,
          }
        : null,
    };
  } catch (error) {
    logger.error('Fiyat detay getirme hatası', { urunId, error: error.message });
    throw error;
  }
}

/**
 * Fiyat dashboard özet istatistikleri
 * @returns {Promise<Object>}
 */
export async function getFiyatDashboard() {
  try {
    // Genel özet
    const ozetResult = await query('SELECT * FROM v_fiyat_ozet');
    const ozet = ozetResult.rows[0] || {};

    // Kategori bazlı
    const kategoriResult = await query(`
      SELECT * FROM v_kategori_fiyat_durumu
      ORDER BY urun_sayisi DESC
      LIMIT 20
    `);

    // Kaynak dağılımı
    const kaynakResult = await query(`
      SELECT 
        fk.kod,
        fk.ad,
        fk.guvenilirlik_skoru,
        COUNT(uk.id) as urun_sayisi,
        fk.son_basarili_guncelleme
      FROM fiyat_kaynaklari fk
      LEFT JOIN urun_kartlari uk ON uk.aktif_fiyat_kaynagi_id = fk.id AND uk.aktif = true
      WHERE fk.aktif = true
      GROUP BY fk.id, fk.kod, fk.ad, fk.guvenilirlik_skoru, fk.son_basarili_guncelleme
      ORDER BY urun_sayisi DESC
    `);

    // Kritik uyarılar
    const uyariResult = await query(`
      SELECT COUNT(*) as sayi, uyari_tipi
      FROM fiyat_uyarilari
      WHERE cozuldu = false
      GROUP BY uyari_tipi
    `);

    // Son 7 gün fiyat değişimleri
    const degisimResult = await query(`
      SELECT 
        COUNT(*) as degisim_sayisi,
        COUNT(*) FILTER (WHERE kaynak ILIKE '%fatura%') as fatura_kaynak,
        COUNT(*) FILTER (WHERE kaynak ILIKE '%manuel%') as manuel_kaynak
      FROM urun_fiyat_gecmisi
      WHERE tarih >= CURRENT_DATE - INTERVAL '7 days'
    `);

    return {
      ozet: {
        toplam_urun: parseInt(ozet.toplam_urun, 10) || 0,
        fiyatli_urun: parseInt(ozet.fiyatli_urun, 10) || 0,
        guncel_fiyat: parseInt(ozet.guncel_fiyat, 10) || 0,
        eski_fiyat: parseInt(ozet.eski_fiyat, 10) || 0,
        ortalama_guven: parseInt(ozet.ortalama_guven, 10) || 0,
        sozlesme_fiyatli: parseInt(ozet.sozlesme_fiyatli, 10) || 0,
        fatura_fiyatli: parseInt(ozet.fatura_fiyatli, 10) || 0,
        piyasa_fiyatli: parseInt(ozet.piyasa_fiyatli, 10) || 0,
        manuel_fiyatli: parseInt(ozet.manuel_fiyatli, 10) || 0,
        varsayilan_fiyatli: parseInt(ozet.varsayilan_fiyatli, 10) || 0,
      },
      kategoriler: kategoriResult.rows,
      kaynaklar: kaynakResult.rows,
      uyarilar: uyariResult.rows.reduce((acc, row) => {
        acc[row.uyari_tipi] = parseInt(row.sayi, 10);
        return acc;
      }, {}),
      son_hafta_degisim: degisimResult.rows[0] || {},
    };
  } catch (error) {
    logger.error('Dashboard istatistik hatası', { error: error.message });
    throw error;
  }
}

/**
 * Ürün listesi fiyat durumu ile
 * @param {Object} filters - Filtreler
 * @returns {Promise<Object[]>}
 */
export async function getUrunlerFiyatDurumu(filters = {}) {
  try {
    const { kategori_id, guncellik, tip, search, limit = 100, offset = 0 } = filters;

    const whereConditions = ['uk.aktif = true'];
    const params = [];
    let paramIndex = 1;

    if (kategori_id) {
      whereConditions.push(`uk.kategori_id = $${paramIndex++}`);
      params.push(kategori_id);
    }

    if (guncellik === 'guncel') {
      whereConditions.push(`uk.aktif_fiyat_guncelleme >= NOW() - INTERVAL '7 days'`);
    } else if (guncellik === 'eski') {
      whereConditions.push(
        `(uk.aktif_fiyat_guncelleme < NOW() - INTERVAL '30 days' OR uk.aktif_fiyat_guncelleme IS NULL)`
      );
    }

    if (tip) {
      whereConditions.push(`uk.aktif_fiyat_tipi = $${paramIndex++}`);
      params.push(tip);
    }

    if (search) {
      whereConditions.push(`(uk.ad ILIKE $${paramIndex} OR uk.kod ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    params.push(limit, offset);

    const result = await query(
      `
      SELECT 
        uk.id,
        uk.kod,
        uk.ad,
        uk.varsayilan_birim,
        uk.aktif_fiyat,
        uk.aktif_fiyat_tipi,
        uk.aktif_fiyat_guven,
        uk.aktif_fiyat_guncelleme,
        kat.ad as kategori_ad,
        fk.ad as kaynak_adi,
        CASE 
          WHEN uk.aktif_fiyat_guncelleme IS NULL THEN 'belirsiz'
          WHEN uk.aktif_fiyat_guncelleme >= NOW() - INTERVAL '7 days' THEN 'guncel'
          WHEN uk.aktif_fiyat_guncelleme >= NOW() - INTERVAL '30 days' THEN 'eski'
          ELSE 'cok_eski'
        END as guncellik_durumu,
        EXTRACT(DAY FROM NOW() - uk.aktif_fiyat_guncelleme)::INTEGER as gun_farki
      FROM urun_kartlari uk
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      LEFT JOIN fiyat_kaynaklari fk ON fk.id = uk.aktif_fiyat_kaynagi_id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY uk.ad
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `,
      params
    );

    // Toplam sayı
    const countParams = params.slice(0, -2); // limit ve offset hariç
    const countResult = await query(
      `
      SELECT COUNT(*) as total
      FROM urun_kartlari uk
      WHERE ${whereConditions.join(' AND ')}
    `,
      countParams
    );

    return {
      urunler: result.rows.map((u) => ({
        ...u,
        aktif_fiyat: u.aktif_fiyat ? parseFloat(u.aktif_fiyat) : null,
        tipLabel: u.aktif_fiyat_tipi ? FIYAT_ONCELIKLERI[u.aktif_fiyat_tipi]?.label : null,
      })),
      total: parseInt(countResult.rows[0]?.total, 10) || 0,
    };
  } catch (error) {
    logger.error('Ürün fiyat listesi hatası', { error: error.message });
    throw error;
  }
}

/**
 * Tedarikçi karşılaştırma
 * @param {number} urunId - Ürün kart ID
 * @returns {Promise<Object[]>}
 */
export async function getTedarikciKarsilastirma(urunId) {
  try {
    // Tedarikçi sözleşmeleri
    const sozlesmeResult = await query(
      `
      SELECT 
        tf.id,
        tf.fiyat,
        tf.birim,
        tf.gecerlilik_baslangic,
        tf.gecerlilik_bitis,
        tf.min_siparis_miktar,
        tf.teslim_suresi_gun,
        tf.aktif,
        tf.sozlesme_no,
        c.id as cari_id,
        c.unvan as tedarikci_adi,
        'sozlesme' as kaynak_tipi
      FROM tedarikci_fiyatlari tf
      JOIN cariler c ON c.id = tf.cari_id
      WHERE tf.urun_kart_id = $1
      ORDER BY tf.fiyat ASC
    `,
      [urunId]
    );

    // Fatura geçmişinden tedarikçiler
    const faturaResult = await query(
      `
      SELECT 
        c.id as cari_id,
        c.unvan as tedarikci_adi,
        COUNT(*) as fatura_sayisi,
        AVG(ufg.fiyat) as ort_fiyat,
        MIN(ufg.fiyat) as min_fiyat,
        MAX(ufg.fiyat) as max_fiyat,
        MAX(ufg.tarih) as son_alis_tarihi,
        'fatura' as kaynak_tipi
      FROM urun_fiyat_gecmisi ufg
      JOIN cariler c ON c.id = ufg.cari_id
      WHERE ufg.urun_kart_id = $1
        AND ufg.cari_id IS NOT NULL
      GROUP BY c.id, c.unvan
      ORDER BY MAX(ufg.tarih) DESC
    `,
      [urunId]
    );

    return {
      sozlesmeler: sozlesmeResult.rows.map((s) => ({
        ...s,
        fiyat: parseFloat(s.fiyat),
      })),
      fatura_gecmisi: faturaResult.rows.map((f) => ({
        ...f,
        ort_fiyat: parseFloat(f.ort_fiyat),
        min_fiyat: parseFloat(f.min_fiyat),
        max_fiyat: parseFloat(f.max_fiyat),
      })),
    };
  } catch (error) {
    logger.error('Tedarikçi karşılaştırma hatası', { urunId, error: error.message });
    throw error;
  }
}

/**
 * Manuel fiyat girişi
 * @param {number} urunId - Ürün kart ID
 * @param {number} fiyat - Yeni fiyat
 * @param {Object} options - Ek seçenekler
 * @returns {Promise<Object>}
 */
export async function manuelFiyatGir(urunId, fiyat, options = {}) {
  try {
    const { birim, aciklama, kullanici_id } = options;

    // Manuel kaynak ID
    const kaynakResult = await query("SELECT id FROM fiyat_kaynaklari WHERE kod = 'MANUEL'");
    const kaynakId = kaynakResult.rows[0]?.id;

    // Fiyat geçmişine ekle
    const result = await query(
      `
      INSERT INTO urun_fiyat_gecmisi (
        urun_kart_id, fiyat, birim, kaynak_id, kaynak, 
        aciklama, tarih, dogrulanmis, dogrulayan_kullanici_id
      ) VALUES ($1, $2, $3, $4, 'manuel', $5, CURRENT_DATE, true, $6)
      RETURNING *
    `,
      [urunId, fiyat, birim, kaynakId, aciklama, kullanici_id]
    );

    // Trigger otomatik aktif_fiyat'ı hesaplayacak
    // Ama sonucu dönelim
    const aktifFiyat = await hesaplaAktifFiyat(urunId);

    logger.info('Manuel fiyat girildi', { urunId, fiyat, kullanici_id });

    return {
      gecmis_kayit: result.rows[0],
      aktif_fiyat: aktifFiyat,
    };
  } catch (error) {
    logger.error('Manuel fiyat giriş hatası', { urunId, fiyat, error: error.message });
    throw error;
  }
}

/**
 * Tüm ürünlerin aktif fiyatını yeniden hesapla
 * @returns {Promise<{basarili: number, hatali: number}>}
 */
export async function tumFiyatlariYenidenHesapla() {
  try {
    const result = await query(`
      SELECT id FROM urun_kartlari WHERE aktif = true
    `);

    let basarili = 0;
    let hatali = 0;

    for (const row of result.rows) {
      try {
        await hesaplaAktifFiyat(row.id);
        basarili++;
      } catch (err) {
        hatali++;
        logger.warn('Ürün fiyat hesaplama hatası', { urunId: row.id, error: err.message });
      }
    }

    logger.info('Toplu fiyat yeniden hesaplama tamamlandı', { basarili, hatali });
    return { basarili, hatali };
  } catch (error) {
    logger.error('Toplu fiyat hesaplama hatası', { error: error.message });
    throw error;
  }
}

/**
 * Batch AI fiyat tahmini - tek prompt'ta birden fazla ürün
 * @param {Array} urunler - Ürün listesi [{id, ad, kategori_ad, varsayilan_birim}]
 * @returns {Promise<Array<{urun_id, fiyat, guven}>>}
 */
async function batchAiTahmini(urunler) {
  if (!process.env.ANTHROPIC_API_KEY || urunler.length === 0) return [];

  const urunListesi = urunler.map((u, i) => 
    `${i + 1}. "${u.ad}" (Kategori: ${u.kategori_ad || 'Genel'}, Birim: ${u.varsayilan_birim || 'kg'})`
  ).join('\n');

  const prompt = `Sen Türkiye gıda toptan piyasası uzmanısın. Ocak 2026 için aşağıdaki ürünlerin TOPTAN birim fiyatlarını tahmin et.

ÜRÜNLER:
${urunListesi}

KURALLAR:
1. TOPTAN fiyat (toptancı/hal fiyatı, market değil)
2. TL cinsinden birim fiyat (1 kg, 1 lt, 1 adet)
3. Bilmiyorsan null yaz, uydurma
4. Kısa açıklama (max 100 karakter)

JSON array formatında yanıt ver:
[
  {"sira": 1, "fiyat": <number|null>, "guven": <0-100>, "aciklama": "<kısa>"},
  ...
]`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].text;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const results = JSON.parse(jsonMatch[0]);
    return results.map((r, i) => ({
      urun_id: urunler[r.sira - 1]?.id || urunler[i]?.id,
      fiyat: r.fiyat,
      guven: r.guven || 40,
      aciklama: (r.aciklama || '').substring(0, 200),
    })).filter(r => r.fiyat && r.fiyat > 0);
  } catch (error) {
    logger.error('Batch AI tahmini hatası', { error: error.message });
    return [];
  }
}

/**
 * Fiyatsız ürünler için toplu AI tahmini (HIZLI - batch mode)
 * @param {number} limit - Maksimum işlenecek ürün sayısı
 * @returns {Promise<{basarili: number, hatali: number, detaylar: Array}>}
 */
export async function topluAiTahmini(limit = 50) {
  const sonuclar = { basarili: 0, hatali: 0, detaylar: [] };

  try {
    // Fiyatı olmayan aktif ürünleri al
    const result = await query(`
      SELECT uk.id, uk.ad, uk.varsayilan_birim, kat.ad as kategori_ad
      FROM urun_kartlari uk
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      WHERE uk.aktif = true
        AND (uk.aktif_fiyat IS NULL OR uk.aktif_fiyat = 0)
      ORDER BY uk.ad
      LIMIT $1
    `, [limit]);

    if (result.rows.length === 0) {
      return { ...sonuclar, message: 'Fiyatsız ürün bulunamadı' };
    }

    logger.info('Toplu AI fiyat tahmini başlatıldı (batch mode)', { urunSayisi: result.rows.length });

    // Kaynak ID al
    const kaynakResult = await query("SELECT id FROM fiyat_kaynaklari WHERE kod = 'AI_TAHMINI'");
    const kaynakId = kaynakResult.rows[0]?.id;

    // 10'arlı batch'ler halinde işle
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < result.rows.length; i += BATCH_SIZE) {
      batches.push(result.rows.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const tahminler = await batchAiTahmini(batch);

      for (const tahmin of tahminler) {
        try {
          if (kaynakId) {
            await query(`
              INSERT INTO urun_fiyat_gecmisi (
                urun_kart_id, fiyat, kaynak_id, kaynak, tarih, aciklama
              ) VALUES ($1, $2, $3, 'AI Tahmini', CURRENT_DATE, $4)
              ON CONFLICT DO NOTHING
            `, [tahmin.urun_id, tahmin.fiyat, kaynakId, tahmin.aciklama]);

            await query(`
              UPDATE urun_kartlari SET
                aktif_fiyat = $2,
                aktif_fiyat_tipi = 'AI_TAHMINI',
                aktif_fiyat_guven = $3,
                aktif_fiyat_kaynagi_id = $4,
                aktif_fiyat_guncelleme = NOW()
              WHERE id = $1
            `, [tahmin.urun_id, tahmin.fiyat, tahmin.guven, kaynakId]);
          }

          sonuclar.basarili++;
          sonuclar.detaylar.push(tahmin);
        } catch (err) {
          sonuclar.hatali++;
          logger.warn('AI kayıt hatası', { urunId: tahmin.urun_id, error: err.message });
        }
      }

      // Batch'ler arası kısa bekleme
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    logger.info('Toplu AI fiyat tahmini tamamlandı', sonuclar);
    return sonuclar;
  } catch (error) {
    logger.error('Toplu AI tahmini hatası', { error: error.message });
    throw error;
  }
}

export default {
  FIYAT_ONCELIKLERI,
  hesaplaAktifFiyat,
  hesaplaTopluAktifFiyat,
  aiTahminiFiyat,
  topluAiTahmini,
  getFiyatDetay,
  getFiyatDashboard,
  getUrunlerFiyatDurumu,
  getTedarikciKarsilastirma,
  manuelFiyatGir,
  tumFiyatlariYenidenHesapla,
};
