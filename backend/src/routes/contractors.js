/**
 * @swagger
 * tags:
 *   name: Yukleniciler
 *   description: Yüklenici (rakip firma) kütüphanesi yönetimi
 */

import express from 'express';
import { query } from '../database.js';
import { logAPI, logError } from '../utils/logger.js';
import { normalizeAnalyzData } from '../scraper/analyze-page-scraper.js';

const router = express.Router();

// ─── Scrape Progress Tracking (in-memory) ────────────────────────
const scrapeState = {
  running: false,
  type: null, // 'list' | 'participants' | 'tender-history'
  progress: { current: 0, total: 0, newCount: 0, updated: 0, errors: 0 },
  startedAt: null,
  lastLog: [],
  _activePage: null, // Puppeteer page ref - stop icin kapatilir
};

function updateScrapeState(update) {
  Object.assign(scrapeState, update);
}

function addScrapeLog(message, type = 'info') {
  scrapeState.lastLog.push({ time: new Date().toISOString(), message, type });
  if (scrapeState.lastLog.length > 100) {
    scrapeState.lastLog = scrapeState.lastLog.slice(-100);
  }
}

function resetScrapeState() {
  scrapeState.running = false;
  scrapeState._activePage = null;
}

// Auth kaldırıldı — yüklenici kütüphanesi public endpoint

/**
 * @swagger
 * /api/contractors:
 *   get:
 *     summary: Yüklenici listesi (sayfalama, arama, filtre, sıralama)
 *     tags: [Yukleniciler]
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      sehir,
      takipte,
      etiket,
      min_sozlesme,
      max_sozlesme,
      sort = 'toplam_sozlesme_bedeli',
      order = 'DESC',
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];
    let paramIndex = 1;
    const conditions = [];

    // Arama
    if (search) {
      conditions.push(`(y.unvan ILIKE $${paramIndex} OR y.kisa_ad ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Şehir filtresi
    if (sehir) {
      conditions.push(`y.aktif_sehirler @> $${paramIndex}::jsonb`);
      params.push(JSON.stringify([sehir]));
      paramIndex++;
    }

    // Takipte filtresi
    if (takipte === 'true') {
      conditions.push('y.takipte = true');
    }

    // Etiket filtresi
    if (etiket) {
      conditions.push(`$${paramIndex} = ANY(y.etiketler)`);
      params.push(etiket);
      paramIndex++;
    }

    // Sözleşme bedeli aralığı
    if (min_sozlesme) {
      conditions.push(`y.toplam_sozlesme_bedeli >= $${paramIndex}`);
      params.push(parseFloat(min_sozlesme));
      paramIndex++;
    }
    if (max_sozlesme) {
      conditions.push(`y.toplam_sozlesme_bedeli <= $${paramIndex}`);
      params.push(parseFloat(max_sozlesme));
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Sıralama güvenliği
    const allowedSorts = [
      'toplam_sozlesme_bedeli',
      'kazanma_orani',
      'katildigi_ihale_sayisi',
      'tamamlanan_is_sayisi',
      'devam_eden_is_sayisi',
      'son_ihale_tarihi',
      'puan',
      'unvan',
      'created_at',
    ];
    const safeSort = allowedSorts.includes(sort) ? sort : 'toplam_sozlesme_bedeli';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Toplam sayı
    const countResult = await query(
      `SELECT COUNT(*) FROM yukleniciler y ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Yüklenici listesi + aktif ihale sayısı
    const listResult = await query(
      `
      SELECT 
        y.*,
        (SELECT COUNT(*) FROM tenders t WHERE t.yuklenici_id = y.id) as bizim_db_ihale_sayisi,
        (SELECT COUNT(*) FROM tenders t WHERE t.yuklenici_id = y.id AND t.status = 'active') as aktif_ihale_sayisi
      FROM yukleniciler y
      ${whereClause}
      ORDER BY ${safeSort} ${safeOrder} NULLS LAST
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `,
      [...params, parseInt(limit, 10), offset]
    );

    res.json({
      success: true,
      data: listResult.rows,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (error) {
    logError('Yüklenici Liste', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/contractors/stats:
 *   get:
 *     summary: Genel yüklenici istatistikleri
 *     tags: [Yukleniciler]
 */
router.get('/stats', async (_req, res) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as toplam_yuklenici,
        COUNT(*) FILTER (WHERE takipte = true) as takipte_olan,
        COUNT(*) FILTER (WHERE devam_eden_is_sayisi > 0) as aktif_yuklenici,
        SUM(toplam_sozlesme_bedeli) as toplam_pazar_buyuklugu,
        AVG(kazanma_orani) FILTER (WHERE kazanma_orani > 0) as ortalama_kazanma_orani,
        AVG(ortalama_indirim_orani) FILTER (WHERE ortalama_indirim_orani IS NOT NULL) as ortalama_indirim
      FROM yukleniciler
    `);

    // Top 10 sözleşme bedeline göre
    const top10 = await query(`
      SELECT id, unvan, kisa_ad, toplam_sozlesme_bedeli, kazanma_orani, 
             katildigi_ihale_sayisi, tamamlanan_is_sayisi, devam_eden_is_sayisi, puan, takipte
      FROM yukleniciler
      ORDER BY toplam_sozlesme_bedeli DESC NULLS LAST
      LIMIT 10
    `);

    // Şehir dağılımı (yuklenici_ihaleleri'nden)
    const sehirDagilimi = await query(`
      SELECT sehir, COUNT(DISTINCT yuklenici_id) as yuklenici_sayisi, COUNT(*) as ihale_sayisi
      FROM yuklenici_ihaleleri
      WHERE sehir IS NOT NULL
      GROUP BY sehir
      ORDER BY yuklenici_sayisi DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      data: {
        genel: result.rows[0],
        top10: top10.rows,
        sehirDagilimi: sehirDagilimi.rows,
      },
    });
  } catch (error) {
    logError('Yüklenici Stats', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/contractors/:id:
 *   get:
 *     summary: Yüklenici detay + ihaleleri
 *     tags: [Yukleniciler]
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Yüklenici bilgileri
    const ykResult = await query('SELECT * FROM yukleniciler WHERE id = $1', [id]);
    if (ykResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Yüklenici bulunamadı' });
    }

    // Yüklenicinin ihaleleri (yuklenici_ihaleleri tablosundan)
    const ihalelerResult = await query(
      `
      SELECT yi.*, t.url as tender_url, t.document_links
      FROM yuklenici_ihaleleri yi
      LEFT JOIN tenders t ON yi.tender_id = t.id
      WHERE yi.yuklenici_id = $1
      ORDER BY yi.sozlesme_tarihi DESC NULLS LAST, yi.created_at DESC
      LIMIT 100
    `,
      [id]
    );

    // Ayrıca tenders tablosundan bu yüklenicinin kazandığı ihaleler
    const kazanilanResult = await query(
      `
      SELECT id, external_id, title, city, location, organization_name, 
             sozlesme_bedeli, indirim_orani, sozlesme_tarihi, 
             work_start_date, is_bitis_tarihi, status, url, tender_date
      FROM tenders 
      WHERE yuklenici_id = $1
      ORDER BY tender_date DESC NULLS LAST
      LIMIT 50
    `,
      [id]
    );

    // Şehir dağılımı
    const sehirResult = await query(
      `
      SELECT city as sehir, COUNT(*) as ihale_sayisi, 
             SUM(sozlesme_bedeli) as toplam_bedel
      FROM tenders
      WHERE yuklenici_id = $1 AND city IS NOT NULL
      GROUP BY city
      ORDER BY ihale_sayisi DESC
    `,
      [id]
    );

    const yk = ykResult.rows[0];

    // analiz_verisi'ni frontend TS tiplerine normalize et (eski kayıtlarla uyum)
    if (yk.analiz_verisi) {
      normalizeAnalyzData(yk.analiz_verisi);
      // kik_sikayet_sayisi'ni ozet'e enjekte et
      if (yk.analiz_verisi.ozet && yk.kik_sikayet_sayisi != null) {
        yk.analiz_verisi.ozet.kik_kararlari = yk.kik_sikayet_sayisi;
      }
    }

    res.json({
      success: true,
      data: {
        yuklenici: yk,
        ihaleler: ihalelerResult.rows,
        kazanilanIhaleler: kazanilanResult.rows,
        sehirDagilimi: sehirResult.rows,
      },
    });
  } catch (error) {
    logError('Yüklenici Detay', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/contractors/:id:
 *   patch:
 *     summary: Yüklenici güncelle (puan, not, etiket)
 *     tags: [Yukleniciler]
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { puan, notlar, etiketler, kisa_ad } = req.body;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (puan !== undefined) {
      updates.push(`puan = $${paramIndex}`);
      params.push(Math.min(5, Math.max(0, parseInt(puan, 10))));
      paramIndex++;
    }
    if (notlar !== undefined) {
      updates.push(`notlar = $${paramIndex}`);
      params.push(notlar);
      paramIndex++;
    }
    if (etiketler !== undefined) {
      updates.push(`etiketler = $${paramIndex}`);
      params.push(etiketler);
      paramIndex++;
    }
    if (kisa_ad !== undefined) {
      updates.push(`kisa_ad = $${paramIndex}`);
      params.push(kisa_ad);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Güncellenecek alan yok' });
    }

    params.push(id);
    const result = await query(
      `UPDATE yukleniciler SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Yüklenici bulunamadı' });
    }

    logAPI('Yüklenici Güncellendi', { id, updates: Object.keys(req.body) });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logError('Yüklenici Güncelle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/contractors/:id/toggle-follow:
 *   post:
 *     summary: Takibe al/çıkar
 *     tags: [Yukleniciler]
 */
router.post('/:id/toggle-follow', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'UPDATE yukleniciler SET takipte = NOT takipte WHERE id = $1 RETURNING id, unvan, takipte',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Yüklenici bulunamadı' });
    }

    const yk = result.rows[0];
    logAPI('Yüklenici Takip', { id, takipte: yk.takipte });

    res.json({
      success: true,
      data: yk,
      message: yk.takipte ? 'Takibe alındı' : 'Takipten çıkarıldı',
    });
  } catch (error) {
    logError('Yüklenici Takip Toggle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/contractors/:id/toggle-istihbarat:
 *   post:
 *     summary: İstihbarat takibine al/çıkar — ON olunca ihale geçmişi otomatik çekilir
 *     tags: [Yukleniciler]
 */
router.post('/:id/toggle-istihbarat', async (req, res) => {
  try {
    const { id } = req.params;

    // Aynı anda scrape varsa ve bu yüklenici için değilse engelleme
    const result = await query(
      `UPDATE yukleniciler SET 
        istihbarat_takibi = NOT COALESCE(istihbarat_takibi, false),
        takipte = CASE WHEN NOT COALESCE(istihbarat_takibi, false) THEN true ELSE takipte END
       WHERE id = $1 RETURNING id, unvan, istihbarat_takibi, takipte`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Yüklenici bulunamadı' });
    }

    const yk = result.rows[0];
    logAPI('Yüklenici İstihbarat Toggle', { id, istihbarat: yk.istihbarat_takibi });

    // İstihbarat ON olunca → arka planda ihale geçmişi scrape başlat
    let scrapeStarted = false;
    if (yk.istihbarat_takibi && !scrapeState.running) {
      scrapeStarted = true;

      updateScrapeState({
        running: true,
        type: 'istihbarat',
        progress: { current: 0, total: 1, newCount: 0, updated: 0, errors: 0 },
        startedAt: new Date().toISOString(),
        lastLog: [],
      });
      addScrapeLog(`İstihbarat: "${yk.unvan}" ihale geçmişi çekiliyor...`);

      // Arka planda çalıştır
      (async () => {
        let page;
        try {
          const { default: browserManager } = await import('../scraper/browser-manager.js');
          const { scrapeContractorTenders } = await import('../scraper/contractor-tender-scraper.js');

          page = await browserManager.createPage();
          scrapeState._activePage = page;

          // ── ADIM 1: İhale geçmişi çek ──
          addScrapeLog('Adım 1/4: İhale geçmişi çekiliyor...', 'info');
          const scrapeResult = await scrapeContractorTenders(page, { id: parseInt(id), unvan: yk.unvan }, {
            maxPages: 15,
            onPageComplete: (pageNum, tenders, stats) => {
              if (!scrapeState.running) { page.close().catch(() => {}); return; }
              updateScrapeState({
                progress: {
                  current: pageNum,
                  total: 15,
                  newCount: stats.tenders_saved,
                  updated: 0,
                  errors: stats.errors,
                },
              });
              addScrapeLog(`Sayfa ${pageNum}: ${tenders.length} ihale (toplam ${stats.tenders_saved})`, 'info');
            },
          });

          if (scrapeState.running) {
            // Fesih sayısını güncelle
            const fesihResult = await query(
              `SELECT COUNT(*) as cnt FROM yuklenici_ihaleleri 
               WHERE yuklenici_id = $1 AND durum = 'iptal'`,
              [id]
            );
            const fesihCount = parseInt(fesihResult.rows[0].cnt, 10);
            await query(
              'UPDATE yukleniciler SET fesih_sayisi = $1 WHERE id = $2',
              [fesihCount, id]
            );

            addScrapeLog(`İhale geçmişi: ${scrapeResult.stats.tenders_saved} ihale, ${fesihCount} fesih`, 'success');

            // ── ADIM 2: Analiz verisi çek (yıllık trend, rakipler, şehirler vs.) ──
            addScrapeLog('Adım 2/4: Analiz verisi çekiliyor...', 'info');
            try {
              const { scrapeAnalyzePage } = await import('../scraper/analyze-page-scraper.js');
              const analyzeResult = await scrapeAnalyzePage(page, { id: parseInt(id), unvan: yk.unvan }, {
                onProgress: (msg) => addScrapeLog(`Analiz: ${msg}`, 'info'),
              });

              if (analyzeResult.success) {
                addScrapeLog(`Analiz: ${analyzeResult.stats.sections_scraped} bölüm, ${analyzeResult.stats.total_rows} satır`, 'success');
              } else {
                addScrapeLog(`Analiz: ${analyzeResult.error || 'veri alınamadı'}`, 'warn');
              }
            } catch (analyzeError) {
              addScrapeLog(`Analiz hatası: ${analyzeError.message}`, 'warn');
            }

            // ── ADIM 3: Katılımcı / teklif detayları (son 10 ihale) ──
            if (scrapeState.running) {
              addScrapeLog('Adım 3/4: Katılımcı detayları çekiliyor...', 'info');
              try {
                const recentTenders = await query(
                  `SELECT t.id, t.external_id, t.document_links
                   FROM yuklenici_ihaleleri yi
                   JOIN tenders t ON t.id = yi.tender_id
                   WHERE yi.yuklenici_id = $1 AND yi.tender_id IS NOT NULL
                     AND t.document_links IS NOT NULL
                     AND t.document_links ? 'probable_participants'
                     AND NOT EXISTS (
                       SELECT 1 FROM yuklenici_ihaleleri yi2
                       WHERE yi2.tender_id = t.id AND yi2.rol = 'katilimci'
                     )
                   ORDER BY yi.sozlesme_tarihi DESC NULLS LAST LIMIT 10`,
                  [id]
                );

                if (recentTenders.rows.length > 0) {
                  const { batchScrapeParticipants } = await import('../scraper/participant-scraper.js');
                  const partResult = await batchScrapeParticipants(page, recentTenders.rows, {
                    maxTenders: 10,
                    onProgress: (stats) => addScrapeLog(`Katılımcı: ${stats.processed}/${stats.total} ihale (${stats.total_participants} katılımcı)`, 'info'),
                  });
                  addScrapeLog(`Katılımcı: ${partResult.stats.total_participants} katılımcı, ${partResult.stats.new_contractors} yeni firma`, 'success');
                } else {
                  addScrapeLog('Katılımcı: Uygun ihale bulunamadı (katılımcı linki yok veya zaten çekilmiş)', 'info');
                }
              } catch (partError) {
                addScrapeLog(`Katılımcı hatası: ${partError.message}`, 'warn');
              }
            }

            // ── ADIM 4: KIK kararları ──
            if (scrapeState.running) {
              addScrapeLog('Adım 4/4: KIK kararları çekiliyor...', 'info');
              try {
                const { scrapeKikDecisions } = await import('../scraper/contractor-tender-scraper.js');
                const kikResult = await scrapeKikDecisions(page, { id: parseInt(id), unvan: yk.unvan }, {
                  maxPages: 3,
                  onProgress: (msg) => addScrapeLog(`KIK: ${msg}`, 'info'),
                });

                // KIK şikayet sayısını güncelle + analiz_verisi.ozet'e enjekte et
                if (kikResult.stats.tenders_saved > 0) {
                  await query(
                    `UPDATE yukleniciler SET 
                      kik_sikayet_sayisi = $1,
                      analiz_verisi = jsonb_set(
                        COALESCE(analiz_verisi, '{}'::jsonb),
                        '{ozet,kik_kararlari}',
                        to_jsonb($1::int)
                      )
                    WHERE id = $2`,
                    [kikResult.stats.tenders_saved, id]
                  );
                }
                addScrapeLog(`KIK: ${kikResult.stats.tenders_saved} karar bulundu`, 'success');
              } catch (kikError) {
                addScrapeLog(`KIK hatası: ${kikError.message}`, 'warn');
              }
            }

            updateScrapeState({
              progress: { current: 1, total: 1, newCount: scrapeResult.stats.tenders_saved, updated: 0, errors: scrapeResult.stats.errors },
            });
            addScrapeLog(`Tamamlandı: ${scrapeResult.stats.tenders_saved} ihale, ${fesihCount} fesih`, 'success');
            logAPI('İstihbarat Scrape', { yukleniciId: id, ...scrapeResult.stats, fesihCount });
          }
        } catch (error) {
          if (scrapeState.running) {
            addScrapeLog(`Hata: ${error.message}`, 'error');
            logError('İstihbarat Scrape', error);
          }
        } finally {
          if (page && !page.isClosed()) await page.close().catch(() => {});
          resetScrapeState();
        }
      })();
    }

    res.json({
      success: true,
      data: yk,
      scrapeStarted,
      message: yk.istihbarat_takibi
        ? `İstihbarat takibine alındı${scrapeStarted ? ' — ihale geçmişi çekiliyor' : ''}`
        : 'İstihbarat takibinden çıkarıldı',
    });
  } catch (error) {
    logError('Yüklenici İstihbarat Toggle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/contractors/:id/tenders:
 *   get:
 *     summary: Yüklenicinin ihale geçmişi (filtreli)
 *     tags: [Yukleniciler]
 */
router.get('/:id/tenders', async (req, res) => {
  try {
    const { id } = req.params;
    const { durum, sehir, yil, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const conditions = ['t.yuklenici_id = $1'];
    const params = [id];
    let paramIndex = 2;

    if (durum) {
      conditions.push(`t.status = $${paramIndex}`);
      params.push(durum);
      paramIndex++;
    }
    if (sehir) {
      conditions.push(`t.city = $${paramIndex}`);
      params.push(sehir);
      paramIndex++;
    }
    if (yil) {
      conditions.push(`EXTRACT(YEAR FROM t.tender_date) = $${paramIndex}`);
      params.push(parseInt(yil, 10));
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await query(
      `SELECT COUNT(*) FROM tenders t WHERE ${whereClause}`,
      params
    );

    const result = await query(
      `
      SELECT id, external_id, title, city, location, organization_name, 
             sozlesme_bedeli, estimated_cost, indirim_orani, 
             sozlesme_tarihi, work_start_date, is_bitis_tarihi, 
             tender_date, status, url, work_duration
      FROM tenders t
      WHERE ${whereClause}
      ORDER BY tender_date DESC NULLS LAST
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `,
      [...params, parseInt(limit, 10), offset]
    );

    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  } catch (error) {
    logError('Yüklenici İhaleleri', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/contractors/tender/:tenderId/competitors:
 *   get:
 *     summary: Bir ihalenin muhtemel rakipleri
 *     tags: [Yukleniciler]
 */
router.get('/tender/:tenderId/competitors', async (req, res) => {
  try {
    const { tenderId } = req.params;

    // İhale bilgilerini al
    const tenderResult = await query(
      'SELECT id, city, category_id, yuklenici_id, yuklenici_adi FROM tenders WHERE id = $1',
      [tenderId]
    );

    if (tenderResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'İhale bulunamadı' });
    }

    const tender = tenderResult.rows[0];

    // 1. Bu ihalenin katılımcıları (yuklenici_ihaleleri'nden)
    const katilimcilar = await query(
      `
      SELECT y.id, y.unvan, y.kisa_ad, y.toplam_sozlesme_bedeli, y.kazanma_orani, y.puan, y.takipte,
             yi.rol, yi.sozlesme_bedeli as teklif_bedeli
      FROM yuklenici_ihaleleri yi
      JOIN yukleniciler y ON yi.yuklenici_id = y.id
      WHERE yi.tender_id = $1
      ORDER BY yi.rol, y.toplam_sozlesme_bedeli DESC
    `,
      [tenderId]
    );

    // 2. Aynı şehirdeki aktif yükleniciler (geçmişte orada iş yapmış)
    let bolgeRakipleri = [];
    if (tender.city) {
      const bolgeResult = await query(
        `
        SELECT DISTINCT y.id, y.unvan, y.kisa_ad, y.toplam_sozlesme_bedeli, y.kazanma_orani, 
               y.puan, y.takipte, COUNT(t.id) as bolge_ihale_sayisi
        FROM yukleniciler y
        JOIN tenders t ON t.yuklenici_id = y.id
        WHERE t.city = $1 AND y.id != COALESCE($2, 0)
        GROUP BY y.id, y.unvan, y.kisa_ad, y.toplam_sozlesme_bedeli, y.kazanma_orani, y.puan, y.takipte
        ORDER BY bolge_ihale_sayisi DESC
        LIMIT 20
      `,
        [tender.city, tender.yuklenici_id]
      );
      bolgeRakipleri = bolgeResult.rows;
    }

    res.json({
      success: true,
      data: {
        katilimcilar: katilimcilar.rows,
        bolgeRakipleri,
      },
    });
  } catch (error) {
    logError('İhale Rakipleri', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/contractors/scrape:
 *   post:
 *     summary: Manuel yüklenici scrape tetikle (arka planda çalışır)
 *     tags: [Yukleniciler]
 */
router.post('/scrape', async (req, res) => {
  if (scrapeState.running) {
    return res.json({
      success: false,
      error: 'Zaten bir scrape işlemi çalışıyor',
      scrapeState: { running: true, type: scrapeState.type, progress: scrapeState.progress },
    });
  }

  const { maxPages = 20 } = req.body;

  // State başlat
  updateScrapeState({
    running: true,
    type: 'list',
    progress: { current: 0, total: maxPages, newCount: 0, updated: 0, errors: 0 },
    startedAt: new Date().toISOString(),
    lastLog: [],
  });
  addScrapeLog(`Yüklenici liste scrape başlatıldı (max ${maxPages} sayfa)`);

  // Arka planda çalıştır
  (async () => {
    let page;
    try {
      const { default: browserManager } = await import('../scraper/browser-manager.js');
      const { scrapeContractorList } = await import('../scraper/contractor-list-scraper.js');

      addScrapeLog('Browser açılıyor...');
      page = await browserManager.createPage();
      scrapeState._activePage = page;

      const result = await scrapeContractorList(page, {
        maxPages,
        onPageComplete: (pageNum, contractors, stats) => {
          // Stop kontrolu: running false ise page'i kapat, scraper hata atar ve durur
          if (!scrapeState.running) {
            page.close().catch(() => {});
            return;
          }
          updateScrapeState({
            progress: {
              current: stats.pages_scraped,
              total: maxPages,
              newCount: stats.contractors_new,
              updated: stats.contractors_updated,
              errors: stats.errors,
            },
          });
          addScrapeLog(`Sayfa ${pageNum}: ${contractors.length} yüklenici (${stats.contractors_new} yeni)`, 'success');
        },
      });

      if (scrapeState.running) {
        addScrapeLog(`Tamamlandı: ${result.stats.contractors_found} bulundu, ${result.stats.contractors_new} yeni`, 'success');
        logAPI('Yüklenici Scrape', result.stats);
      }
    } catch (error) {
      if (scrapeState.running) {
        addScrapeLog(`Hata: ${error.message}`, 'error');
        logError('Yüklenici Scrape', error);
      }
    } finally {
      if (page && !page.isClosed()) await page.close().catch(() => {});
      resetScrapeState();
    }
  })();

  // Hemen yanıt dön
  res.json({ success: true, message: 'Scrape başlatıldı', type: 'list' });
});

/**
 * @swagger
 * /api/contractors/scrape/status:
 *   get:
 *     summary: Scrape ilerleme durumu
 *     tags: [Yukleniciler]
 */
router.get('/scrape/status', (_req, res) => {
  const { _activePage, ...publicState } = scrapeState;
  res.json({
    ...publicState,
    elapsedSeconds: scrapeState.startedAt
      ? Math.round((Date.now() - new Date(scrapeState.startedAt).getTime()) / 1000)
      : 0,
  });
});

/**
 * @swagger
 * /api/contractors/scrape/stop:
 *   post:
 *     summary: Çalışan scrape işlemini durdur
 *     tags: [Yukleniciler]
 */
router.post('/scrape/stop', (_req, res) => {
  if (scrapeState.running) {
    addScrapeLog('İşlem kullanıcı tarafından durduruldu', 'warn');
    // running=false yap, sonraki callback iterasyonunda page kapatilacak
    scrapeState.running = false;
    // Ek guvenlik: page'i dogrudan kapat (scraper hata atar ve finally'den cikar)
    if (scrapeState._activePage && !scrapeState._activePage.isClosed()) {
      scrapeState._activePage.close().catch(() => {});
    }
    res.json({ success: true, message: 'Scrape durduruldu' });
  } else {
    res.json({ success: true, message: 'Çalışan scrape yok' });
  }
});

/**
 * @swagger
 * /api/contractors/etiketler:
 *   get:
 *     summary: Kullanılan tüm etiketleri listele
 *     tags: [Yukleniciler]
 */
router.get('/meta/etiketler', async (_req, res) => {
  try {
    const result = await query(`
      SELECT DISTINCT unnest(etiketler) as etiket, COUNT(*) as kullanim
      FROM yukleniciler
      WHERE array_length(etiketler, 1) > 0
      GROUP BY etiket
      ORDER BY kullanim DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logError('Yüklenici Etiketler', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/contractors/meta/sehirler:
 *   get:
 *     summary: Yüklenicilerin bulunduğu şehirleri listele
 *     tags: [Yukleniciler]
 */
router.get('/meta/sehirler', async (_req, res) => {
  try {
    const result = await query(`
      SELECT city as sehir, COUNT(DISTINCT yuklenici_id) as yuklenici_sayisi
      FROM tenders
      WHERE yuklenici_id IS NOT NULL AND city IS NOT NULL
      GROUP BY city
      ORDER BY yuklenici_sayisi DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logError('Yüklenici Şehirler', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/contractors/analytics/pazar:
 *   get:
 *     summary: Pazar analizi - şehir bazlı rekabet, fiyat dağılımı
 *     tags: [Yukleniciler]
 */
router.get('/analytics/pazar', async (req, res) => {
  try {
    const { sehir } = req.query;

    // Şehir bazlı yüklenici yoğunluğu
    const sehirYogunluk = await query(`
      SELECT 
        t.city as sehir,
        COUNT(DISTINCT t.yuklenici_id) as yuklenici_sayisi,
        COUNT(*) as ihale_sayisi,
        AVG(t.sozlesme_bedeli) FILTER (WHERE t.sozlesme_bedeli IS NOT NULL) as ort_sozlesme,
        AVG(t.indirim_orani) FILTER (WHERE t.indirim_orani IS NOT NULL) as ort_indirim,
        MIN(t.sozlesme_bedeli) FILTER (WHERE t.sozlesme_bedeli IS NOT NULL) as min_sozlesme,
        MAX(t.sozlesme_bedeli) FILTER (WHERE t.sozlesme_bedeli IS NOT NULL) as max_sozlesme
      FROM tenders t
      WHERE t.city IS NOT NULL AND t.yuklenici_id IS NOT NULL
      ${sehir ? 'AND t.city = $1' : ''}
      GROUP BY t.city
      ORDER BY yuklenici_sayisi DESC
      LIMIT 30
    `, sehir ? [sehir] : []);

    // Yıllık trend (son 3 yıl)
    const yillikTrend = await query(`
      SELECT 
        EXTRACT(YEAR FROM t.sozlesme_tarihi) as yil,
        COUNT(*) as ihale_sayisi,
        SUM(t.sozlesme_bedeli) as toplam_bedel,
        AVG(t.indirim_orani) FILTER (WHERE t.indirim_orani IS NOT NULL) as ort_indirim,
        COUNT(DISTINCT t.yuklenici_id) as aktif_yuklenici
      FROM tenders t
      WHERE t.sozlesme_tarihi IS NOT NULL 
        AND t.sozlesme_tarihi > NOW() - INTERVAL '3 years'
        AND t.yuklenici_id IS NOT NULL
      GROUP BY EXTRACT(YEAR FROM t.sozlesme_tarihi)
      ORDER BY yil
    `);

    // Fiyat tahmini: Benzer ihalelerin sözleşme bedeli dağılımı
    const fiyatDagilimi = await query(`
      SELECT 
        CASE 
          WHEN t.sozlesme_bedeli < 500000 THEN '0-500K'
          WHEN t.sozlesme_bedeli < 1000000 THEN '500K-1M'
          WHEN t.sozlesme_bedeli < 5000000 THEN '1M-5M'
          WHEN t.sozlesme_bedeli < 10000000 THEN '5M-10M'
          WHEN t.sozlesme_bedeli < 50000000 THEN '10M-50M'
          ELSE '50M+'
        END as aralik,
        COUNT(*) as ihale_sayisi,
        AVG(t.indirim_orani) FILTER (WHERE t.indirim_orani IS NOT NULL) as ort_indirim
      FROM tenders t
      WHERE t.sozlesme_bedeli IS NOT NULL AND t.sozlesme_bedeli > 0
      GROUP BY aralik
      ORDER BY MIN(t.sozlesme_bedeli)
    `);

    res.json({
      success: true,
      data: {
        sehirYogunluk: sehirYogunluk.rows,
        yillikTrend: yillikTrend.rows,
        fiyatDagilimi: fiyatDagilimi.rows,
      },
    });
  } catch (error) {
    logError('Pazar Analizi', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/contractors/analytics/fiyat-tahmini:
 *   get:
 *     summary: Bir ihale için fiyat tahmini (benzer ihalelerin geçmiş verilerine göre)
 *     tags: [Yukleniciler]
 */
router.get('/analytics/fiyat-tahmini', async (req, res) => {
  try {
    const { sehir, sure } = req.query;

    const conditions = [
      't.sozlesme_bedeli IS NOT NULL',
      't.sozlesme_bedeli > 0',
      "t.status = 'completed'",
    ];
    const params = [];
    let paramIndex = 1;

    if (sehir) {
      conditions.push(`t.city = $${paramIndex}`);
      params.push(sehir);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const result = await query(`
      SELECT 
        COUNT(*) as veri_sayisi,
        AVG(t.sozlesme_bedeli) as ortalama_bedel,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY t.sozlesme_bedeli) as alt_ceyrek,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY t.sozlesme_bedeli) as medyan,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY t.sozlesme_bedeli) as ust_ceyrek,
        MIN(t.sozlesme_bedeli) as minimum,
        MAX(t.sozlesme_bedeli) as maksimum,
        AVG(t.indirim_orani) FILTER (WHERE t.indirim_orani IS NOT NULL) as ort_indirim,
        STDDEV(t.sozlesme_bedeli) as standart_sapma
      FROM tenders t
      WHERE ${whereClause}
    `, params);

    // Son 5 benzer ihale
    const benzerIhaleler = await query(`
      SELECT t.title, t.city, t.sozlesme_bedeli, t.indirim_orani, 
             t.sozlesme_tarihi, t.yuklenici_adi, t.work_duration
      FROM tenders t
      WHERE ${whereClause}
      ORDER BY t.sozlesme_tarihi DESC NULLS LAST
      LIMIT 10
    `, params);

    res.json({
      success: true,
      data: {
        tahmini: result.rows[0],
        benzerIhaleler: benzerIhaleler.rows,
        parametreler: { sehir, sure },
      },
    });
  } catch (error) {
    logError('Fiyat Tahmini', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/contractors/karsilastir:
 *   get:
 *     summary: 2-3 yükleniciyi karşılaştır (istatistik + ortak ihaleler)
 *     tags: [Yukleniciler]
 *     parameters:
 *       - name: ids
 *         in: query
 *         description: Virgülle ayrılmış yüklenici ID'leri (2-3 adet)
 *         required: true
 *         schema:
 *           type: string
 *           example: "1,2,3"
 */
router.get('/karsilastir', async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ success: false, error: 'ids parametresi gerekli (ör: ?ids=1,2,3)' });
    }

    const idList = String(ids).split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !Number.isNaN(id));
    if (idList.length < 2 || idList.length > 5) {
      return res.status(400).json({ success: false, error: '2-5 arası yüklenici ID gerekli' });
    }

    // Yüklenici bilgileri
    const placeholders = idList.map((_, i) => `$${i + 1}`).join(',');
    const yuklenicilerResult = await query(
      `SELECT * FROM yukleniciler WHERE id IN (${placeholders})`,
      idList
    );

    if (yuklenicilerResult.rows.length < 2) {
      return res.status(404).json({ success: false, error: 'Yeterli yüklenici bulunamadı' });
    }

    // Ortak katıldıkları ihaleler (aynı tender_id'ye sahip kayıtlar)
    const ortakResult = await query(
      `
      SELECT 
        yi.tender_id,
        yi.ihale_basligi,
        yi.sehir,
        yi.kurum_adi,
        yi.sozlesme_tarihi,
        json_agg(json_build_object(
          'yuklenici_id', yi.yuklenici_id,
          'unvan', y.unvan,
          'rol', yi.rol,
          'sozlesme_bedeli', yi.sozlesme_bedeli,
          'indirim_orani', yi.indirim_orani,
          'durum', yi.durum
        )) as katilimcilar
      FROM yuklenici_ihaleleri yi
      JOIN yukleniciler y ON yi.yuklenici_id = y.id
      WHERE yi.yuklenici_id IN (${placeholders})
        AND yi.tender_id IS NOT NULL
      GROUP BY yi.tender_id, yi.ihale_basligi, yi.sehir, yi.kurum_adi, yi.sozlesme_tarihi
      HAVING COUNT(DISTINCT yi.yuklenici_id) >= 2
      ORDER BY yi.sozlesme_tarihi DESC NULLS LAST
      LIMIT 50
    `,
      idList
    );

    // Her yüklenici için şehir dağılımı karşılaştırması
    const sehirResult = await query(
      `
      SELECT 
        yi.yuklenici_id,
        yi.sehir,
        COUNT(*) as ihale_sayisi,
        SUM(yi.sozlesme_bedeli) as toplam_bedel
      FROM yuklenici_ihaleleri yi
      WHERE yi.yuklenici_id IN (${placeholders})
        AND yi.sehir IS NOT NULL
      GROUP BY yi.yuklenici_id, yi.sehir
      ORDER BY ihale_sayisi DESC
    `,
      idList
    );

    // Grupla: yuklenici_id -> sehir dağılımı
    const sehirDagilimi = {};
    sehirResult.rows.forEach((row) => {
      if (!sehirDagilimi[row.yuklenici_id]) sehirDagilimi[row.yuklenici_id] = [];
      sehirDagilimi[row.yuklenici_id].push(row);
    });

    res.json({
      success: true,
      data: {
        yukleniciler: yuklenicilerResult.rows,
        ortakIhaleler: ortakResult.rows,
        sehirDagilimi,
        karsilastirma: {
          toplamSozlesme: yuklenicilerResult.rows.map((y) => ({
            id: y.id, unvan: y.unvan, deger: y.toplam_sozlesme_bedeli,
          })),
          kazanmaOrani: yuklenicilerResult.rows.map((y) => ({
            id: y.id, unvan: y.unvan, deger: y.kazanma_orani,
          })),
          ihaleSayisi: yuklenicilerResult.rows.map((y) => ({
            id: y.id, unvan: y.unvan, deger: y.katildigi_ihale_sayisi,
          })),
          ortIndirim: yuklenicilerResult.rows.map((y) => ({
            id: y.id, unvan: y.unvan, deger: y.ortalama_indirim_orani,
          })),
        },
      },
    });
  } catch (error) {
    logError('Yüklenici Karşılaştır', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/contractors/en-aktif:
 *   get:
 *     summary: En aktif yükleniciler (son 30 gün)
 *     tags: [Yukleniciler]
 */
router.get('/en-aktif', async (req, res) => {
  try {
    const { gun = 30, limit: maxLimit = 10 } = req.query;

    const result = await query(`
      SELECT 
        y.id, y.unvan, y.kisa_ad, y.toplam_sozlesme_bedeli, y.kazanma_orani, y.puan, y.takipte,
        COUNT(yi.id) as son_donem_ihale_sayisi,
        SUM(yi.sozlesme_bedeli) FILTER (WHERE yi.sozlesme_bedeli IS NOT NULL) as son_donem_bedel
      FROM yukleniciler y
      JOIN yuklenici_ihaleleri yi ON yi.yuklenici_id = y.id
      WHERE yi.sozlesme_tarihi >= NOW() - ($1 || ' days')::interval
      GROUP BY y.id
      ORDER BY son_donem_ihale_sayisi DESC
      LIMIT $2
    `, [parseInt(String(gun), 10), parseInt(String(maxLimit), 10)]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logError('En Aktif Yükleniciler', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/contractors/sehir-bazli:
 *   get:
 *     summary: Şehir bazlı yüklenici dağılımı
 *     tags: [Yukleniciler]
 */
router.get('/sehir-bazli', async (_req, res) => {
  try {
    const result = await query(`
      SELECT 
        yi.sehir,
        COUNT(DISTINCT yi.yuklenici_id) as yuklenici_sayisi,
        COUNT(*) as ihale_sayisi,
        SUM(yi.sozlesme_bedeli) FILTER (WHERE yi.sozlesme_bedeli IS NOT NULL) as toplam_bedel,
        AVG(yi.indirim_orani) FILTER (WHERE yi.indirim_orani IS NOT NULL) as ort_indirim
      FROM yuklenici_ihaleleri yi
      WHERE yi.sehir IS NOT NULL
      GROUP BY yi.sehir
      ORDER BY yuklenici_sayisi DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logError('Şehir Bazlı Yüklenici', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/contractors/scrape/participants:
 *   post:
 *     summary: Batch katılımcı scrape tetikle (arka planda)
 *     tags: [Yukleniciler]
 */
router.post('/scrape/participants', async (req, res) => {
  if (scrapeState.running) {
    return res.json({ success: false, error: 'Zaten bir scrape işlemi çalışıyor' });
  }

  try {
    const { maxTenders = 20 } = req.body;

    const tendersResult = await query(`
      SELECT t.id, t.external_id, t.document_links
      FROM tenders t
      WHERE t.document_links ? 'probable_participants'
        AND NOT EXISTS (
          SELECT 1 FROM yuklenici_ihaleleri yi WHERE yi.tender_id = t.id AND yi.rol = 'katilimci'
        )
      ORDER BY t.tender_date DESC NULLS LAST
      LIMIT $1
    `, [maxTenders]);

    if (tendersResult.rows.length === 0) {
      return res.json({ success: true, message: 'Scrape edilecek ihale bulunamadı', stats: { total: 0 } });
    }

    updateScrapeState({
      running: true,
      type: 'participants',
      progress: { current: 0, total: tendersResult.rows.length, newCount: 0, updated: 0, errors: 0 },
      startedAt: new Date().toISOString(),
      lastLog: [],
    });
    addScrapeLog(`Katılımcı scrape başlatıldı (${tendersResult.rows.length} ihale)`);

    (async () => {
      let page;
      try {
        const { default: browserManager } = await import('../scraper/browser-manager.js');
        const { batchScrapeParticipants } = await import('../scraper/participant-scraper.js');

        page = await browserManager.createPage();
        scrapeState._activePage = page;

        const result = await batchScrapeParticipants(page, tendersResult.rows, {
          maxTenders,
          onProgress: (stats) => {
            if (!scrapeState.running) { page.close().catch(() => {}); return; }
            updateScrapeState({
              progress: { current: stats.processed, total: stats.total, newCount: stats.participants_found, updated: 0, errors: stats.errors },
            });
            addScrapeLog(`${stats.processed}/${stats.total} ihale islendi (${stats.participants_found} katilimci)`, 'info');
          },
        });
        if (scrapeState.running) {
          addScrapeLog(`Tamamlandı: ${result.stats.participants_found} katılımcı bulundu`, 'success');
          logAPI('Batch Participant Scrape', result.stats);
        }
      } catch (error) {
        if (scrapeState.running) {
          addScrapeLog(`Hata: ${error.message}`, 'error');
          logError('Batch Participant Scrape', error);
        }
      } finally {
        if (page && !page.isClosed()) await page.close().catch(() => {});
        resetScrapeState();
      }
    })();

    res.json({ success: true, message: 'Katılımcı scrape başlatıldı', type: 'participants' });
  } catch (error) {
    logError('Batch Participant Scrape', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/contractors/scrape/tender-history:
 *   post:
 *     summary: Takipteki yüklenicilerin ihale geçmişini scrape et (arka planda)
 *     tags: [Yukleniciler]
 */
router.post('/scrape/tender-history', async (req, res) => {
  if (scrapeState.running) {
    return res.json({ success: false, error: 'Zaten bir scrape işlemi çalışıyor' });
  }

  const { maxContractors = 10, maxPagesPerContractor = 5 } = req.body;

  updateScrapeState({
    running: true,
    type: 'tender-history',
    progress: { current: 0, total: maxContractors, newCount: 0, updated: 0, errors: 0 },
    startedAt: new Date().toISOString(),
    lastLog: [],
  });
  addScrapeLog(`İhale geçmişi scrape başlatıldı (max ${maxContractors} yüklenici)`);

  (async () => {
    let page;
    try {
      const { default: browserManager } = await import('../scraper/browser-manager.js');
      const { batchScrapeContractorTenders } = await import('../scraper/contractor-tender-scraper.js');

      page = await browserManager.createPage();
      scrapeState._activePage = page;

      const result = await batchScrapeContractorTenders(page, {
        maxContractors,
        maxPagesPerContractor,
        onProgress: (batchStats) => {
          if (!scrapeState.running) { page.close().catch(() => {}); return; }
          updateScrapeState({
            progress: { current: batchStats.processed, total: batchStats.total, newCount: batchStats.total_tenders, updated: 0, errors: 0 },
          });
          addScrapeLog(`${batchStats.processed}/${batchStats.total} yuklenici islendi (${batchStats.total_tenders} ihale)`, 'info');
        },
      });
      if (scrapeState.running) {
        addScrapeLog(`Tamamlandı: ${result.stats.total_tenders || 0} ihale kaydedildi`, 'success');
        logAPI('Batch Contractor Tender Scrape', result.stats);
      }
    } catch (error) {
      if (scrapeState.running) {
        addScrapeLog(`Hata: ${error.message}`, 'error');
        logError('Batch Contractor Tender Scrape', error);
      }
    } finally {
      if (page && !page.isClosed()) await page.close().catch(() => {});
      resetScrapeState();
    }
  })();

  res.json({ success: true, message: 'İhale geçmişi scrape başlatıldı', type: 'tender-history' });
});

/**
 * @swagger
 * /api/contractors/:id/risk:
 *   get:
 *     summary: Yüklenici risk profili (fesih, KİK şikayet, notlar)
 *     tags: [Yukleniciler]
 */
router.get('/:id/risk', async (req, res) => {
  try {
    const { id } = req.params;

    // Yüklenici temel bilgi
    const ykResult = await query(
      'SELECT id, unvan, fesih_sayisi, risk_notu, kik_sikayet_sayisi FROM yukleniciler WHERE id = $1',
      [id]
    );
    if (ykResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Yüklenici bulunamadı' });
    }

    // Fesih kayıtları
    const fesihResult = await query(
      `SELECT ihale_basligi, kurum_adi, sehir, sozlesme_bedeli, sozlesme_tarihi, fesih_durumu, ikn
       FROM yuklenici_ihaleleri
       WHERE yuklenici_id = $1 AND fesih_durumu IS NOT NULL AND fesih_durumu != 'Yok'
       ORDER BY sozlesme_tarihi DESC`,
      [id]
    );

    // KIK kararları (yuklenici_ihaleleri tablosundan, rol = 'kik_karari')
    const kikResult = await query(
      `SELECT ihale_basligi, kurum_adi, sehir, sozlesme_bedeli, sozlesme_tarihi, durum, ikn
       FROM yuklenici_ihaleleri
       WHERE yuklenici_id = $1 AND rol = 'kik_karari'
       ORDER BY sozlesme_tarihi DESC NULLS LAST`,
      [id]
    );

    // İlgili notlar — notes tablosu henüz oluşturulmamış olabilir
    let riskNotlari = [];
    try {
      const notResult = await query(
        `SELECT * FROM notes
         WHERE entity_type = 'yuklenici' AND entity_id = $1
         ORDER BY created_at DESC LIMIT 20`,
        [id]
      );
      riskNotlari = notResult.rows || [];
    } catch (_e) {
      // notes tablosu yoksa sessizce devam et
    }

    res.json({
      success: true,
      data: {
        yuklenici: ykResult.rows[0],
        fesihler: fesihResult.rows,
        kikKararlari: kikResult.rows,
        riskNotlari,
        ozet: {
          fesihSayisi: fesihResult.rows.length,
          kikSikayetSayisi: ykResult.rows[0].kik_sikayet_sayisi || 0,
          kikKararSayisi: kikResult.rows.length,
          riskNotu: ykResult.rows[0].risk_notu,
        },
      },
    });
  } catch (error) {
    logError('Yüklenici Risk', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/contractors/:id/risk:
 *   patch:
 *     summary: Risk notu güncelle
 *     tags: [Yukleniciler]
 */
router.patch('/:id/risk', async (req, res) => {
  try {
    const { id } = req.params;
    const { risk_notu } = req.body;

    const result = await query(
      'UPDATE yukleniciler SET risk_notu = $1 WHERE id = $2 RETURNING id, unvan, risk_notu',
      [risk_notu, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Yüklenici bulunamadı' });
    }

    logAPI('Yüklenici Risk Notu', { id, risk_notu: risk_notu?.substring(0, 50) });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logError('Yüklenici Risk Güncelle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/contractors/:id/scrape-history:
 *   post:
 *     summary: Tek yüklenicinin ihale geçmişini ihalebul'dan scrape et (arka planda)
 *     tags: [Yukleniciler]
 */
router.post('/:id/scrape-history', async (req, res) => {
  if (scrapeState.running) {
    return res.json({ success: false, error: 'Zaten bir scrape işlemi çalışıyor' });
  }

  const { id } = req.params;
  const { maxPages = 10 } = req.body;

  try {
    // Yükleniciyi bul
    const ykResult = await query('SELECT id, unvan FROM yukleniciler WHERE id = $1', [id]);
    if (ykResult.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Yüklenici bulunamadı' });
    }

    const yuklenici = ykResult.rows[0];

    updateScrapeState({
      running: true,
      type: 'single-tender-history',
      progress: { current: 0, total: 1, newCount: 0, updated: 0, errors: 0 },
      startedAt: new Date().toISOString(),
      lastLog: [],
    });
    addScrapeLog(`"${yuklenici.unvan}" ihale geçmişi çekiliyor...`);

    // Arka planda çalıştır
    (async () => {
      let page;
      try {
        const { default: browserManager } = await import('../scraper/browser-manager.js');
        const { scrapeContractorTenders } = await import('../scraper/contractor-tender-scraper.js');

        page = await browserManager.createPage();
        scrapeState._activePage = page;

        const result = await scrapeContractorTenders(page, yuklenici, {
          maxPages,
          onPageComplete: (pageNum, tenders, stats) => {
            if (!scrapeState.running) { page.close().catch(() => {}); return; }
            updateScrapeState({
              progress: {
                current: 0,
                total: 1,
                newCount: stats.tenders_saved,
                updated: 0,
                errors: stats.errors,
              },
            });
            addScrapeLog(`Sayfa ${pageNum}: ${tenders.length} ihale bulundu (toplam ${stats.tenders_saved} kaydedildi)`, 'info');
          },
        });

        if (scrapeState.running) {
          updateScrapeState({
            progress: { current: 1, total: 1, newCount: result.stats.tenders_saved, updated: 0, errors: result.stats.errors },
          });
          addScrapeLog(`Tamamlandı: ${result.stats.tenders_saved} ihale kaydedildi (${result.stats.pages_scraped} sayfa tarandı)`, 'success');
          logAPI('Single Contractor Tender Scrape', { yukleniciId: id, ...result.stats });
        }
      } catch (error) {
        if (scrapeState.running) {
          addScrapeLog(`Hata: ${error.message}`, 'error');
          logError('Single Contractor Tender Scrape', error);
        }
      } finally {
        if (page && !page.isClosed()) await page.close().catch(() => {});
        resetScrapeState();
      }
    })();

    res.json({ success: true, message: `"${yuklenici.unvan}" ihale geçmişi çekiliyor`, type: 'single-tender-history' });
  } catch (error) {
    logError('Single Contractor Tender Scrape', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Analiz Sayfası Endpoints ────────────────────────────────────

/**
 * GET /api/contractors/:id/analyze
 * Yüklenicinin analiz verisini getir (varsa DB'den)
 */
router.get('/:id/analyze', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT id, unvan, analiz_verisi, analiz_scraped_at 
       FROM yukleniciler WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Yüklenici bulunamadı' });
    }

    const yuklenici = result.rows[0];
    res.json({
      success: true,
      data: yuklenici.analiz_verisi || null,
      scraped_at: yuklenici.analiz_scraped_at || null,
      has_data: !!yuklenici.analiz_verisi,
    });
  } catch (error) {
    logError('Get Contractor Analyze', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/contractors/:id/scrape-analyze
 * Yüklenicinin analiz sayfasını scrape et (background)
 */
router.post('/:id/scrape-analyze', async (req, res) => {
  try {
    const { id } = req.params;

    // Yükleniciyi al
    const result = await query('SELECT id, unvan FROM yukleniciler WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Yüklenici bulunamadı' });
    }
    const yuklenici = result.rows[0];

    // Zaten çalışan scrape var mı?
    if (scrapeState.running) {
      return res.status(409).json({
        success: false,
        error: `Zaten bir scrape işlemi çalışıyor: ${scrapeState.type}`,
        type: scrapeState.type,
      });
    }

    // Background'da çalıştır
    updateScrapeState({
      running: true,
      type: 'analyze',
      progress: { current: 0, total: 1, newCount: 0, updated: 0, errors: 0 },
      startedAt: new Date().toISOString(),
      lastLog: [],
    });
    addScrapeLog(`"${yuklenici.unvan}" analiz sayfası taranıyor...`, 'info');

    let page;
    (async () => {
      try {
        const { default: browserManager } = await import('../scraper/browser-manager.js');
        const { scrapeAnalyzePage } = await import('../scraper/analyze-page-scraper.js');

        page = await browserManager.createPage();
        scrapeState._activePage = page;

        const result = await scrapeAnalyzePage(page, yuklenici, {
          onProgress: (msg) => {
            if (scrapeState.running) {
              addScrapeLog(msg, 'info');
            }
          },
        });

        if (scrapeState.running) {
          if (result.success) {
            updateScrapeState({
              progress: { current: 1, total: 1, newCount: result.stats.total_rows, updated: 0, errors: result.stats.errors.length },
            });
            addScrapeLog(
              `Tamamlandı: ${result.stats.sections_scraped} bölüm, ${result.stats.total_rows} satır veri çekildi`,
              'success'
            );
          } else {
            addScrapeLog(`Hata: ${result.error}`, 'error');
          }
          logAPI('Contractor Analyze Scrape', { yukleniciId: id, ...result.stats });
        }
      } catch (error) {
        if (scrapeState.running) {
          addScrapeLog(`Hata: ${error.message}`, 'error');
          logError('Contractor Analyze Scrape', error);
        }
      } finally {
        if (page && !page.isClosed()) await page.close().catch(() => {});
        resetScrapeState();
      }
    })();

    res.json({
      success: true,
      message: `"${yuklenici.unvan}" analiz sayfası çekiliyor`,
      type: 'analyze',
    });
  } catch (error) {
    logError('Contractor Analyze Scrape Start', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── AI Destekli Endpoint'ler ─────────────────────────────────────

/**
 * GET /api/contractors/:id/ai-ozet
 * AI ile yüklenici profil özeti oluştur
 */
router.get('/:id/ai-ozet', async (req, res) => {
  try {
    const { id } = req.params;

    const yukleniciAI = (await import('../services/yuklenici-ai.js')).default;
    const result = await yukleniciAI.generateProfilOzeti(parseInt(id, 10));

    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    logError('AI Profil Özeti', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/contractors/tender/:tenderId/ai-rakip-analiz
 * AI ile bir ihale için rakip analizi oluştur
 */
router.get('/tender/:tenderId/ai-rakip-analiz', async (req, res) => {
  try {
    const { tenderId } = req.params;

    const yukleniciAI = (await import('../services/yuklenici-ai.js')).default;
    const result = await yukleniciAI.generateRakipAnalizi(parseInt(tenderId, 10));

    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    logError('AI Rakip Analizi', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
