/**
 * Sektör Gündem Aggregator
 * ────────────────────────
 * Hibrit pipeline: Tavily (açık web) + Puppeteer/DB (login gerektiren) + Claude AI (özet)
 *
 * İki bağlam:
 *   1. İhale Merkezi — ihale duyuruları, KİK kararları, mevzuat
 *   2. İstihbarat    — sektör trendleri, fiyat istihbaratı, firma haberleri
 *
 * Her güncelleme:
 *   a) Paralel: Tavily araması + DB sorgusu
 *   b) Birleştirme + dedup
 *   c) Claude AI ile özet
 *   d) Cache (sync_logs)
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../database.js';
import logger from '../utils/logger.js';
import { isTavilyConfigured, tavilySearch } from './tavily-service.js';

// ─── CLAUDE CLIENT ───────────────────────────────────────

let _claude = null;
function getClaude() {
  if (!_claude && process.env.ANTHROPIC_API_KEY) {
    _claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _claude;
}

// ─── KONU TANIMLARI ──────────────────────────────────────

const YILI = new Date().getFullYear();

/**
 * İhale Merkezi kategorileri
 * Her kategori: Tavily sorgusu + opsiyonel DB sorgusu
 */
const IHALE_KATEGORILERI = [
  {
    id: 'ihale_duyuru',
    baslik: 'Yeni İhale Duyuruları',
    tavily: {
      sorgu: `kamu ihale yemek hizmeti catering ihale duyurusu ilanı ${YILI}`,
      domainler: ['ekap.kik.gov.tr', 'ihale.gov.tr', 'ihalebul.com'],
      days: 14,
    },
    db: {
      query: `SELECT t.id, t.title, t.institution, t.tender_date, t.estimated_cost, t.source_url
              FROM tenders t
              WHERE t.created_at > NOW() - INTERVAL '7 days'
              ORDER BY t.created_at DESC LIMIT 10`,
      mapFn: (rows) =>
        rows.map((r) => ({
          baslik: `${r.institution || 'Kurum belirtilmemiş'} - ${r.title}`,
          url: r.source_url || '',
          ozet: r.estimated_cost ? `Yaklaşık maliyet: ${Number(r.estimated_cost).toLocaleString('tr-TR')} TL` : null,
          tarih: r.tender_date,
          kaynak_tipi: 'ihalebul',
        })),
    },
  },
  {
    id: 'kik_karar',
    baslik: 'KİK Kararları',
    tavily: {
      sorgu: `kamu ihale kurumu kurul kararı yemek catering iptal ${YILI}`,
      domainler: ['kik.gov.tr', 'ekap.kik.gov.tr'],
      days: 14,
    },
    db: null, // KİK kararları şimdilik sadece Tavily
  },
  {
    id: 'zeyilname',
    baslik: 'Zeyilname ve Değişiklikler',
    tavily: {
      sorgu: `ihale zeyilname düzeltme yemek hizmeti catering ${YILI}`,
      domainler: ['ekap.kik.gov.tr'],
      days: 14,
    },
    db: null,
  },
  {
    id: 'mevzuat',
    baslik: 'Mevzuat Değişiklikleri',
    tavily: {
      sorgu: `kamu ihale mevzuat değişiklik tebliğ yönetmelik ${YILI}`,
      domainler: ['mevzuat.gov.tr', 'resmigazete.gov.tr'],
      days: 30,
    },
    db: null,
  },
  {
    id: 'sektor_haber',
    baslik: 'Catering Sektör Haberleri',
    tavily: {
      sorgu: `catering toplu yemek sektör haber ihale trend ${YILI}`,
      domainler: [],
      days: 14,
    },
    db: null,
  },
];

/**
 * İstihbarat kategorileri
 */
const ISTIHBARAT_KATEGORILERI = [
  {
    id: 'sektor_trend',
    baslik: 'Sektör Trendleri',
    tavily: {
      sorgu: `toplu yemek catering sektörü büyüme trend analiz ${YILI}`,
      domainler: [],
      days: 30,
    },
    db: {
      query: `SELECT
                COUNT(*) as toplam_ihale,
                SUM(CASE WHEN tender_date > NOW() THEN 1 ELSE 0 END) as aktif_ihale,
                AVG(estimated_cost::numeric) FILTER (WHERE estimated_cost IS NOT NULL AND estimated_cost::numeric > 0) as ort_maliyet
              FROM tenders
              WHERE created_at > NOW() - INTERVAL '30 days'`,
      mapFn: (rows) => {
        if (!rows.length) return [];
        const r = rows[0];
        return [
          {
            baslik: `Son 30 Gün İhale İstatistikleri`,
            url: '',
            ozet: `${r.toplam_ihale} ihale, ${r.aktif_ihale} aktif. Ortalama yaklaşık maliyet: ${r.ort_maliyet ? `${Number(r.ort_maliyet).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL` : 'Veri yok'}`,
            tarih: new Date().toISOString(),
            kaynak_tipi: 'db',
          },
        ];
      },
    },
  },
  {
    id: 'fiyat_istihbarat',
    baslik: 'Gıda Fiyat İstihbaratı',
    tavily: {
      sorgu: `gıda fiyatları enflasyon artış toptan catering maliyet ${YILI}`,
      domainler: [],
      days: 14,
    },
    db: {
      query: `SELECT
                urun_adi, birim, fiyat, kaynak, tarih
              FROM piyasa_fiyat_gecmisi
              WHERE tarih > NOW() - INTERVAL '7 days'
              ORDER BY tarih DESC LIMIT 15`,
      mapFn: (rows) => {
        if (!rows.length) return [];
        // Fiyat verilerini özet olarak döndür
        const urunSayisi = new Set(rows.map((r) => r.urun_adi)).size;
        const kaynaklar = [...new Set(rows.map((r) => r.kaynak))];
        return [
          {
            baslik: 'Güncel Piyasa Fiyatları (DB)',
            url: '',
            ozet: `Son 7 günde ${urunSayisi} farklı üründe fiyat verisi mevcut. Kaynaklar: ${kaynaklar.join(', ')}`,
            tarih: rows[0]?.tarih,
            kaynak_tipi: 'db',
            ekVeri: rows.slice(0, 10).map((r) => ({
              urun: r.urun_adi,
              fiyat: r.fiyat,
              birim: r.birim,
              kaynak: r.kaynak,
            })),
          },
        ];
      },
    },
  },
  {
    id: 'sirket_haber',
    baslik: 'Şirket Haberleri',
    tavily: {
      sorgu: `catering yemek şirketi ihale kazanan haberleri ${YILI}`,
      domainler: [],
      days: 14,
    },
    db: {
      query: `SELECT y.unvan, y.toplam_sozlesme_tutari, y.kazanma_orani, y.durum_puani
              FROM yukleniciler y
              WHERE y.updated_at > NOW() - INTERVAL '14 days'
              ORDER BY y.toplam_sozlesme_tutari DESC NULLS LAST LIMIT 5`,
      mapFn: (rows) =>
        rows.map((r) => ({
          baslik: `${r.unvan} - Son güncelleme`,
          url: '',
          ozet: r.toplam_sozlesme_tutari
            ? `Toplam sözleşme: ${Number(r.toplam_sozlesme_tutari).toLocaleString('tr-TR')} TL, Kazanma: %${r.kazanma_orani || 0}`
            : `Durum puanı: ${r.durum_puani || '-'}`,
          tarih: null,
          kaynak_tipi: 'db',
        })),
    },
  },
  {
    id: 'sgk_hukuk',
    baslik: 'SGK ve İş Hukuku',
    tavily: {
      sorgu: `SGK prim asgari ücret iş kanunu değişiklik catering ${YILI}`,
      domainler: ['sgk.gov.tr', 'resmigazete.gov.tr'],
      days: 30,
    },
    db: null,
  },
  {
    id: 'gida_guvenlik',
    baslik: 'Gıda Güvenliği',
    tavily: {
      sorgu: `gıda güvenliği denetim ceza yemek hizmeti hijyen ${YILI}`,
      domainler: ['tarimorman.gov.tr'],
      days: 30,
    },
    db: null,
  },
];

// ─── YARDIMCI FONKSİYONLAR ──────────────────────────────

/**
 * Tavily sonuçlarını standart formata dönüştür
 */
function mapTavilyResults(tavilyResult) {
  if (!tavilyResult?.success) return { haberler: [], ozet: null };
  return {
    ozet: tavilyResult.answer || null,
    haberler: (tavilyResult.results || []).map((r) => ({
      baslik: r.title,
      url: r.url,
      ozet: r.content?.substring(0, 200) || null,
      tarih: r.publishedDate || null,
      kaynak_tipi: 'tavily',
    })),
  };
}

/**
 * DB sonuçlarını çek (hata durumunda boş dön)
 */
async function fetchDbData(dbConfig) {
  if (!dbConfig) return [];
  try {
    const result = await query(dbConfig.query);
    return dbConfig.mapFn(result.rows);
  } catch (err) {
    logger.warn(`[SektorGundem] DB sorgu hatası: ${err.message}`);
    return [];
  }
}

/**
 * İki kaynağın haberlerini birleştir, duplicate URL'leri kaldır
 */
function mergeHaberler(tavilyHaberler, dbHaberler) {
  const all = [...dbHaberler, ...tavilyHaberler]; // DB öncelikli
  const seen = new Set();
  return all.filter((h) => {
    if (!h.url || h.url === '') return true; // URL'siz DB sonuçlarını her zaman dahil et
    if (seen.has(h.url)) return false;
    seen.add(h.url);
    return true;
  });
}

/**
 * Claude AI ile birleşik özet oluştur
 */
async function generateAiSummary(kategoriBaslik, tavilyOzet, haberler) {
  const claude = getClaude();
  if (!claude) return tavilyOzet || null; // Claude yoksa Tavily özetini kullan

  // Çok az veri varsa AI'ya gerek yok
  if (haberler.length <= 1 && !tavilyOzet) return null;

  try {
    const haberListesi = haberler
      .slice(0, 8)
      .map((h) => `- ${h.baslik}${h.ozet ? ` (${h.ozet})` : ''}${h.kaynak_tipi ? ` [${h.kaynak_tipi}]` : ''}`)
      .join('\n');

    const message = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Sen bir catering sektörü analistisin. "${kategoriBaslik}" konusunda aşağıdaki bilgileri 2-3 cümlelik kısa bir özet haline getir. Türkçe yaz. Sadece özeti yaz, başka bir şey ekleme.

${tavilyOzet ? `Web özeti: ${tavilyOzet}\n` : ''}
Haberler:
${haberListesi}`,
        },
      ],
    });

    return message.content[0]?.text || tavilyOzet || null;
  } catch (err) {
    logger.warn(`[SektorGundem] AI özet hatası: ${err.message}`);
    return tavilyOzet || null; // Fallback: Tavily özeti
  }
}

// ─── ANA AGGREGATOR FONKSİYONLARI ───────────────────────

/**
 * Tek bir kategori için hibrit veri çek
 */
async function fetchKategori(kategori) {
  const { id, baslik, tavily: tavilyConfig, db: dbConfig } = kategori;

  // Paralel: Tavily + DB
  const [tavilyResult, dbHaberler] = await Promise.all([
    isTavilyConfigured()
      ? tavilySearch(tavilyConfig.sorgu, {
          searchDepth: 'basic',
          maxResults: 5,
          includeAnswer: true,
          includeDomains: tavilyConfig.domainler?.length > 0 ? tavilyConfig.domainler : undefined,
          days: tavilyConfig.days || 14,
        })
      : Promise.resolve(null),
    fetchDbData(dbConfig),
  ]);

  const tavilyData = mapTavilyResults(tavilyResult);
  const birlesikHaberler = mergeHaberler(tavilyData.haberler, dbHaberler);

  // AI özet (paralel olarak çalışmaz, sıralı)
  const aiOzet = await generateAiSummary(baslik, tavilyData.ozet, birlesikHaberler);

  // Kaynak dağılımı
  const kaynaklar = {
    tavily: tavilyData.haberler.length,
    db: dbHaberler.length,
    toplam: birlesikHaberler.length,
  };

  return {
    konu: id,
    baslik,
    ai_ozet: aiOzet,
    haberler: birlesikHaberler.slice(0, 8), // Max 8 haber per kategori
    kaynaklar,
  };
}

/**
 * İhale Merkezi gündemini getir (5 kategori)
 */
export async function fetchIhaleGundem() {
  logger.info('[SektorGundem] İhale gündem aggregation başlıyor...');
  const konular = [];

  for (const kategori of IHALE_KATEGORILERI) {
    try {
      const result = await fetchKategori(kategori);
      konular.push(result);
      // Rate limit: Tavily istekleri arası 500ms
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      logger.warn(`[SektorGundem] İhale kategori hatası (${kategori.id}): ${err.message}`);
    }
  }

  logger.info(`[SektorGundem] İhale gündem tamamlandı: ${konular.length}/${IHALE_KATEGORILERI.length} kategori`);
  return konular;
}

/**
 * İstihbarat gündemini getir (5 kategori)
 */
export async function fetchIstihbaratGundem() {
  logger.info('[SektorGundem] İstihbarat gündem aggregation başlıyor...');
  const konular = [];

  for (const kategori of ISTIHBARAT_KATEGORILERI) {
    try {
      const result = await fetchKategori(kategori);
      konular.push(result);
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      logger.warn(`[SektorGundem] İstihbarat kategori hatası (${kategori.id}): ${err.message}`);
    }
  }

  logger.info(
    `[SektorGundem] İstihbarat gündem tamamlandı: ${konular.length}/${ISTIHBARAT_KATEGORILERI.length} kategori`
  );
  return konular;
}

/**
 * Firma bazlı hibrit haber araması
 */
export async function fetchFirmaHaberleri(firmaAdi) {
  if (!firmaAdi || firmaAdi.length < 3) {
    return { success: false, error: 'Firma adı çok kısa' };
  }

  logger.info(`[SektorGundem] Firma haberleri: "${firmaAdi}"`);

  const [tavilyResult, dbResult] = await Promise.all([
    // Tavily: Açık web haberleri
    isTavilyConfigured()
      ? tavilySearch(`"${firmaAdi}" ihale haber ${YILI}`, {
          searchDepth: 'basic',
          maxResults: 5,
          includeAnswer: true,
          days: 90,
        })
      : Promise.resolve(null),
    // DB: İhale geçmişi + şirket bilgisi
    (async () => {
      try {
        const yukleniciResult = await query(
          `SELECT y.id, y.unvan, y.toplam_sozlesme_tutari, y.tamamlanan_ihale, y.katildigi_ihale,
                  y.kazanma_orani, y.durum_puani, y.updated_at
           FROM yukleniciler y
           WHERE y.unvan ILIKE $1
           LIMIT 1`,
          [`%${firmaAdi}%`]
        );

        if (!yukleniciResult.rows.length) return { firma: null, ihaleler: [] };

        const firma = yukleniciResult.rows[0];

        // Son ihaleleri çek
        const ihaleResult = await query(
          `SELECT yig.ihale_adi, yig.kurum, yig.sonuc, yig.toplam_tutar, yig.ihale_tarihi
           FROM yuklenici_ihale_gecmisi yig
           WHERE yig.yuklenici_id = $1
           ORDER BY yig.ihale_tarihi DESC LIMIT 5`,
          [firma.id]
        );

        return { firma, ihaleler: ihaleResult.rows };
      } catch {
        return { firma: null, ihaleler: [] };
      }
    })(),
  ]);

  const tavilyData = mapTavilyResults(tavilyResult);

  // DB'den gelen ihaleleri haber formatına dönüştür
  const dbHaberler = [];
  if (dbResult.firma) {
    const f = dbResult.firma;
    dbHaberler.push({
      baslik: `${f.unvan} - Firma Profili`,
      url: '',
      ozet: `Katıldığı: ${f.katildigi_ihale || '-'}, Tamamladığı: ${f.tamamlanan_ihale || '-'}, Kazanma: %${f.kazanma_orani || 0}, Toplam: ${f.toplam_sozlesme_tutari ? `${Number(f.toplam_sozlesme_tutari).toLocaleString('tr-TR')} TL` : '-'}`,
      kaynak_tipi: 'db',
    });

    for (const ih of dbResult.ihaleler) {
      dbHaberler.push({
        baslik: `${ih.kurum || ''} - ${ih.ihale_adi || 'İhale'}`,
        url: '',
        ozet: `Sonuç: ${ih.sonuc || '-'}, Tutar: ${ih.toplam_tutar ? `${Number(ih.toplam_tutar).toLocaleString('tr-TR')} TL` : '-'}`,
        tarih: ih.ihale_tarihi,
        kaynak_tipi: 'ihalebul',
      });
    }
  }

  const birlesikHaberler = mergeHaberler(tavilyData.haberler, dbHaberler);
  const aiOzet = await generateAiSummary(`${firmaAdi} Firma İstihbaratı`, tavilyData.ozet, birlesikHaberler);

  return {
    success: true,
    firma_adi: firmaAdi,
    ai_ozet: aiOzet,
    haberler: birlesikHaberler.slice(0, 10),
    kaynaklar: {
      tavily: tavilyData.haberler.length,
      db: dbHaberler.length,
      toplam: birlesikHaberler.length,
    },
    firma_profil: dbResult.firma || null,
  };
}

// ─── CACHE YARDIMCILARI ──────────────────────────────────

/**
 * Cache'den oku
 * @param {string} syncType - Cache key (sektor_gundem_ihale, sektor_gundem_istihbarat, vs.)
 * @param {number} maxAgeHours - Max cache yaşı (saat)
 */
export async function readCache(syncType, maxAgeHours) {
  try {
    const result = await query(
      `SELECT details, finished_at FROM sync_logs
       WHERE sync_type = $1 AND status = 'success'
       AND finished_at > NOW() - INTERVAL '${maxAgeHours} hours'
       ORDER BY finished_at DESC LIMIT 1`,
      [syncType]
    );
    if (result.rows.length > 0) {
      const details =
        typeof result.rows[0].details === 'string' ? JSON.parse(result.rows[0].details) : result.rows[0].details;
      return { hit: true, data: details, guncelleme: result.rows[0].finished_at };
    }
  } catch (err) {
    logger.warn(`[SektorGundem] Cache okuma hatası: ${err.message}`);
  }
  return { hit: false };
}

/**
 * Cache'e yaz
 */
export async function writeCache(syncType, data) {
  try {
    await query(
      `INSERT INTO sync_logs (sync_type, status, started_at, finished_at, details)
       VALUES ($1, 'success', NOW() - INTERVAL '10 seconds', NOW(), $2)`,
      [syncType, JSON.stringify(data)]
    );
  } catch (err) {
    logger.warn(`[SektorGundem] Cache yazma hatası: ${err.message}`);
  }
}

export default {
  fetchIhaleGundem,
  fetchIstihbaratGundem,
  fetchFirmaHaberleri,
  readCache,
  writeCache,
};
