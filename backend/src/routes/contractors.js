/**
 * @swagger
 * tags:
 *   name: Yukleniciler
 *   description: Yüklenici (rakip firma) kütüphanesi yönetimi
 */

import express from 'express';
import { query } from '../database.js';
import { normalizeAnalyzData } from '../scraper/yuklenici-istihbarat/yuklenici-profil-cek.js';
import logger, { logAPI, logError } from '../utils/logger.js';

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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

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
    const countResult = await query(`SELECT COUNT(*) FROM yukleniciler y ${whereClause}`, params);
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

    // Top 25 sözleşme bedeline göre
    const top25 = await query(`
      SELECT id, unvan, kisa_ad, toplam_sozlesme_bedeli, kazanma_orani, 
             katildigi_ihale_sayisi, tamamlanan_is_sayisi, devam_eden_is_sayisi, puan, takipte
      FROM yukleniciler
      ORDER BY toplam_sozlesme_bedeli DESC NULLS LAST
      LIMIT 25
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
        top10: top25.rows,
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
    const ihalelerCountResult = await query('SELECT COUNT(*) FROM yuklenici_ihaleleri WHERE yuklenici_id = $1', [id]);
    const totalIhaleler = parseInt(ihalelerCountResult.rows[0].count, 10);

    const ihalelerResult = await query(
      `
      SELECT yi.*, t.url as tender_url, t.document_links
      FROM yuklenici_ihaleleri yi
      LEFT JOIN tenders t ON yi.tender_id = t.id
      WHERE yi.yuklenici_id = $1
      ORDER BY yi.sozlesme_tarihi DESC NULLS LAST, yi.created_at DESC
      LIMIT 200
    `,
      [id]
    );

    // Ayrıca tenders tablosundan bu yüklenicinin kazandığı ihaleler
    const kazanilanResult = await query(
      `
      SELECT id, external_id, title, city, location, organization_name, 
             sozlesme_bedeli, estimated_cost, indirim_orani, sozlesme_tarihi, 
             work_start_date, is_bitis_tarihi, work_duration, status, url, tender_date
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
        totalIhaleler,
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

    // Güncellenebilir alanlar (whitelist)
    const EDITABLE_FIELDS = [
      'puan', 'notlar', 'etiketler', 'kisa_ad',
      // Firma bilgileri (manuel giriş)
      'telefon', 'email', 'adres', 'yetkili_kisi', 'vergi_no', 'web_sitesi', 'sektor', 'firma_notu',
    ];

    const updates = [];
    const params = [];
    let paramIndex = 1;

    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        if (field === 'puan') {
          updates.push(`puan = $${paramIndex}`);
          params.push(Math.min(5, Math.max(0, parseInt(req.body.puan, 10))));
        } else {
          updates.push(`${field} = $${paramIndex}`);
          params.push(req.body[field]);
        }
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Güncellenecek alan yok' });
    }

    updates.push(`updated_at = NOW()`);

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

// ═══════════════════════════════════════════════════════════════
// YAPIŞKAN NOTLAR (Sticker Notes) CRUD
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/contractors/:id/notlar
 * Yükleniciye ait tüm yapışkan notları döner.
 */
router.get('/:id/notlar', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query(
      `SELECT * FROM yuklenici_notlar WHERE yuklenici_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    logError('Yapışkan Notlar Listele', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/contractors/:id/notlar
 * Yeni yapışkan not ekler.
 */
router.post('/:id/notlar', async (req, res) => {
  try {
    const { id } = req.params;
    const { icerik, renk = 'yellow', olusturan } = req.body;

    if (!icerik || !icerik.trim()) {
      return res.status(400).json({ success: false, error: 'Not içeriği boş olamaz' });
    }

    const { rows } = await query(
      `INSERT INTO yuklenici_notlar (yuklenici_id, icerik, renk, olusturan)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, icerik.trim(), renk, olusturan || null]
    );

    logAPI('Yapışkan Not Eklendi', { yukleniciId: id, notId: rows[0].id });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logError('Yapışkan Not Ekle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/contractors/:id/notlar/:notId
 * Yapışkan notu günceller.
 */
router.patch('/:id/notlar/:notId', async (req, res) => {
  try {
    const { notId } = req.params;
    const { icerik, renk } = req.body;

    const updates = [];
    const params = [];
    let idx = 1;

    if (icerik !== undefined) {
      updates.push(`icerik = $${idx}`);
      params.push(icerik.trim());
      idx++;
    }
    if (renk !== undefined) {
      updates.push(`renk = $${idx}`);
      params.push(renk);
      idx++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Güncellenecek alan yok' });
    }

    updates.push(`updated_at = NOW()`);
    params.push(notId);

    const { rows, rowCount } = await query(
      `UPDATE yuklenici_notlar SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Not bulunamadı' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logError('Yapışkan Not Güncelle', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/contractors/:id/notlar/:notId
 * Yapışkan notu siler.
 */
router.delete('/:id/notlar/:notId', async (req, res) => {
  try {
    const { notId } = req.params;
    const { rowCount } = await query(`DELETE FROM yuklenici_notlar WHERE id = $1`, [notId]);

    if (rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Not bulunamadı' });
    }

    res.json({ success: true });
  } catch (error) {
    logError('Yapışkan Not Sil', error);
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
          const { default: browserManager } = await import('../scraper/shared/browser.js');
          const { scrapeContractorTenders } = await import('../scraper/yuklenici-istihbarat/yuklenici-gecmisi-cek.js');

          page = await browserManager.createPage();
          scrapeState._activePage = page;

          // ── ADIM 1: İhale geçmişi çek ──
          addScrapeLog('Adım 1/4: İhale geçmişi çekiliyor...', 'info');
          await updateModulDurum(id, 'ihale_gecmisi', 'calisiyor');
          const scrapeResult = await scrapeContractorTenders(
            page,
            { id: parseInt(id, 10), unvan: yk.unvan },
            {
              maxPages: 15,
              onPageComplete: (pageNum, tenders, stats) => {
                if (!scrapeState.running) {
                  page.close().catch(() => {});
                  return;
                }
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
            }
          );

          if (scrapeState.running) {
            // Fesih sayısını güncelle
            const fesihResult = await query(
              `SELECT COUNT(*) as cnt FROM yuklenici_ihaleleri 
               WHERE yuklenici_id = $1 AND durum = 'iptal'`,
              [id]
            );
            const fesihCount = parseInt(fesihResult.rows[0].cnt, 10);
            await query('UPDATE yukleniciler SET fesih_sayisi = $1 WHERE id = $2', [fesihCount, id]);

            addScrapeLog(`İhale geçmişi: ${scrapeResult.stats.tenders_saved} ihale, ${fesihCount} fesih`, 'success');
            await updateModulDurum(id, 'ihale_gecmisi', 'tamamlandi', {
              veri: { ihale_sayisi: scrapeResult.stats.tenders_saved, fesih_sayisi: fesihCount },
            });

            // ── ADIM 2: Analiz verisi çek (yıllık trend, rakipler, şehirler vs.) ──
            addScrapeLog('Adım 2/4: Analiz verisi çekiliyor...', 'info');
            await updateModulDurum(id, 'profil_analizi', 'calisiyor');
            try {
              const { scrapeAnalyzePage } = await import('../scraper/yuklenici-istihbarat/yuklenici-profil-cek.js');
              const analyzeResult = await scrapeAnalyzePage(
                page,
                { id: parseInt(id, 10), unvan: yk.unvan },
                {
                  onProgress: (msg) => addScrapeLog(`Analiz: ${msg}`, 'info'),
                }
              );

              if (analyzeResult.success) {
                addScrapeLog(
                  `Analiz: ${analyzeResult.stats.sections_scraped} bölüm, ${analyzeResult.stats.total_rows} satır`,
                  'success'
                );
                await updateModulDurum(id, 'profil_analizi', 'tamamlandi', {
                  veri: { bolum: analyzeResult.stats.sections_scraped, satir: analyzeResult.stats.total_rows },
                });
              } else {
                addScrapeLog(`Analiz: ${analyzeResult.error || 'veri alınamadı'}`, 'warn');
                await updateModulDurum(id, 'profil_analizi', 'hata', { hata_mesaji: analyzeResult.error });
              }
            } catch (analyzeError) {
              addScrapeLog(`Analiz hatası: ${analyzeError.message}`, 'warn');
              await updateModulDurum(id, 'profil_analizi', 'hata', { hata_mesaji: analyzeError.message });
            }

            // ── ADIM 3: Katılımcı / teklif detayları (son 10 ihale) ──
            if (scrapeState.running) {
              addScrapeLog('Adım 3/4: Katılımcı detayları çekiliyor...', 'info');
              await updateModulDurum(id, 'katilimcilar', 'calisiyor');
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
                  const { batchScrapeParticipants } = await import(
                    '../scraper/yuklenici-istihbarat/ihale-katilimci-cek.js'
                  );
                  const partResult = await batchScrapeParticipants(page, recentTenders.rows, {
                    maxTenders: 10,
                    onProgress: (stats) =>
                      addScrapeLog(
                        `Katılımcı: ${stats.processed}/${stats.total} ihale (${stats.total_participants} katılımcı)`,
                        'info'
                      ),
                  });
                  addScrapeLog(
                    `Katılımcı: ${partResult.stats.total_participants} katılımcı, ${partResult.stats.new_contractors} yeni firma`,
                    'success'
                  );
                  await updateModulDurum(id, 'katilimcilar', 'tamamlandi', {
                    veri: {
                      katilimci: partResult.stats.total_participants,
                      yeni_firma: partResult.stats.new_contractors,
                    },
                  });
                } else {
                  addScrapeLog('Katılımcı: Uygun ihale bulunamadı (katılımcı linki yok veya zaten çekilmiş)', 'info');
                  await updateModulDurum(id, 'katilimcilar', 'tamamlandi', {
                    veri: { mesaj: 'Uygun ihale bulunamadı' },
                  });
                }
              } catch (partError) {
                addScrapeLog(`Katılımcı hatası: ${partError.message}`, 'warn');
                await updateModulDurum(id, 'katilimcilar', 'hata', { hata_mesaji: partError.message });
              }
            }

            // ── ADIM 4: KIK kararları ──
            if (scrapeState.running) {
              addScrapeLog('Adım 4/4: KIK kararları çekiliyor...', 'info');
              await updateModulDurum(id, 'kik_kararlari', 'calisiyor');
              try {
                const { scrapeKikDecisions } = await import('../scraper/yuklenici-istihbarat/yuklenici-gecmisi-cek.js');
                const kikResult = await scrapeKikDecisions(
                  page,
                  { id: parseInt(id, 10), unvan: yk.unvan },
                  {
                    maxPages: 3,
                    onProgress: (msg) => addScrapeLog(`KIK: ${msg}`, 'info'),
                  }
                );

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
                await updateModulDurum(id, 'kik_kararlari', 'tamamlandi', {
                  veri: { karar_sayisi: kikResult.stats.tenders_saved },
                });
              } catch (kikError) {
                addScrapeLog(`KIK hatası: ${kikError.message}`, 'warn');
                await updateModulDurum(id, 'kik_kararlari', 'hata', { hata_mesaji: kikError.message });
              }
            }

            updateScrapeState({
              progress: {
                current: 1,
                total: 1,
                newCount: scrapeResult.stats.tenders_saved,
                updated: 0,
                errors: scrapeResult.stats.errors,
              },
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

    const countResult = await query(`SELECT COUNT(*) FROM tenders t WHERE ${whereClause}`, params);

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
      const { default: browserManager } = await import('../scraper/shared/browser.js');
      const { scrapeContractorList } = await import('../scraper/yuklenici-istihbarat/yuklenici-listesi-cek.js');

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
        addScrapeLog(
          `Tamamlandı: ${result.stats.contractors_found} bulundu, ${result.stats.contractors_new} yeni`,
          'success'
        );
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
    const sehirYogunluk = await query(
      `
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
    `,
      sehir ? [sehir] : []
    );

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

    const conditions = ['t.sozlesme_bedeli IS NOT NULL', 't.sozlesme_bedeli > 0', "t.status = 'completed'"];
    const params = [];
    let paramIndex = 1;

    if (sehir) {
      conditions.push(`t.city = $${paramIndex}`);
      params.push(sehir);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const result = await query(
      `
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
    `,
      params
    );

    // Son 5 benzer ihale
    const benzerIhaleler = await query(
      `
      SELECT t.title, t.city, t.sozlesme_bedeli, t.indirim_orani, 
             t.sozlesme_tarihi, t.yuklenici_adi, t.work_duration
      FROM tenders t
      WHERE ${whereClause}
      ORDER BY t.sozlesme_tarihi DESC NULLS LAST
      LIMIT 10
    `,
      params
    );

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

    const idList = String(ids)
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !Number.isNaN(id));
    if (idList.length < 2 || idList.length > 5) {
      return res.status(400).json({ success: false, error: '2-5 arası yüklenici ID gerekli' });
    }

    // Yüklenici bilgileri
    const placeholders = idList.map((_, i) => `$${i + 1}`).join(',');
    const yuklenicilerResult = await query(`SELECT * FROM yukleniciler WHERE id IN (${placeholders})`, idList);

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
            id: y.id,
            unvan: y.unvan,
            deger: y.toplam_sozlesme_bedeli,
          })),
          kazanmaOrani: yuklenicilerResult.rows.map((y) => ({
            id: y.id,
            unvan: y.unvan,
            deger: y.kazanma_orani,
          })),
          ihaleSayisi: yuklenicilerResult.rows.map((y) => ({
            id: y.id,
            unvan: y.unvan,
            deger: y.katildigi_ihale_sayisi,
          })),
          ortIndirim: yuklenicilerResult.rows.map((y) => ({
            id: y.id,
            unvan: y.unvan,
            deger: y.ortalama_indirim_orani,
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

    const result = await query(
      `
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
    `,
      [parseInt(String(gun), 10), parseInt(String(maxLimit), 10)]
    );

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

    const tendersResult = await query(
      `
      SELECT t.id, t.external_id, t.document_links
      FROM tenders t
      WHERE t.document_links ? 'probable_participants'
        AND NOT EXISTS (
          SELECT 1 FROM yuklenici_ihaleleri yi WHERE yi.tender_id = t.id AND yi.rol = 'katilimci'
        )
      ORDER BY t.tender_date DESC NULLS LAST
      LIMIT $1
    `,
      [maxTenders]
    );

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
        const { default: browserManager } = await import('../scraper/shared/browser.js');
        const { batchScrapeParticipants } = await import('../scraper/yuklenici-istihbarat/ihale-katilimci-cek.js');

        page = await browserManager.createPage();
        scrapeState._activePage = page;

        const result = await batchScrapeParticipants(page, tendersResult.rows, {
          maxTenders,
          onProgress: (stats) => {
            if (!scrapeState.running) {
              page.close().catch(() => {});
              return;
            }
            updateScrapeState({
              progress: {
                current: stats.processed,
                total: stats.total,
                newCount: stats.participants_found,
                updated: 0,
                errors: stats.errors,
              },
            });
            addScrapeLog(
              `${stats.processed}/${stats.total} ihale islendi (${stats.participants_found} katilimci)`,
              'info'
            );
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
      const { default: browserManager } = await import('../scraper/shared/browser.js');
      const { batchScrapeContractorTenders } = await import('../scraper/yuklenici-istihbarat/yuklenici-gecmisi-cek.js');

      page = await browserManager.createPage();
      scrapeState._activePage = page;

      const result = await batchScrapeContractorTenders(page, {
        maxContractors,
        maxPagesPerContractor,
        onProgress: (batchStats) => {
          if (!scrapeState.running) {
            page.close().catch(() => {});
            return;
          }
          updateScrapeState({
            progress: {
              current: batchStats.processed,
              total: batchStats.total,
              newCount: batchStats.total_tenders,
              updated: 0,
              errors: 0,
            },
          });
          addScrapeLog(
            `${batchStats.processed}/${batchStats.total} yuklenici islendi (${batchStats.total_tenders} ihale)`,
            'info'
          );
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

    const result = await query('UPDATE yukleniciler SET risk_notu = $1 WHERE id = $2 RETURNING id, unvan, risk_notu', [
      risk_notu,
      id,
    ]);

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
        const { default: browserManager } = await import('../scraper/shared/browser.js');
        const { scrapeContractorTenders } = await import('../scraper/yuklenici-istihbarat/yuklenici-gecmisi-cek.js');

        page = await browserManager.createPage();
        scrapeState._activePage = page;

        const result = await scrapeContractorTenders(page, yuklenici, {
          maxPages,
          onPageComplete: (pageNum, tenders, stats) => {
            if (!scrapeState.running) {
              page.close().catch(() => {});
              return;
            }
            updateScrapeState({
              progress: {
                current: 0,
                total: 1,
                newCount: stats.tenders_saved,
                updated: 0,
                errors: stats.errors,
              },
            });
            addScrapeLog(
              `Sayfa ${pageNum}: ${tenders.length} ihale bulundu (toplam ${stats.tenders_saved} kaydedildi)`,
              'info'
            );
          },
        });

        if (scrapeState.running) {
          updateScrapeState({
            progress: {
              current: 1,
              total: 1,
              newCount: result.stats.tenders_saved,
              updated: 0,
              errors: result.stats.errors,
            },
          });
          addScrapeLog(
            `Tamamlandı: ${result.stats.tenders_saved} ihale kaydedildi (${result.stats.pages_scraped} sayfa tarandı)`,
            'success'
          );
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
        const { default: browserManager } = await import('../scraper/shared/browser.js');
        const { scrapeAnalyzePage } = await import('../scraper/yuklenici-istihbarat/yuklenici-profil-cek.js');

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
              progress: {
                current: 1,
                total: 1,
                newCount: result.stats.total_rows,
                updated: 0,
                errors: result.stats.errors.length,
              },
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

// ═══════════════════════════════════════════════════════════════════
// İSTİHBARAT MERKEZİ API ENDPOİNTLERİ
// Her yüklenici için 8 bağımsız istihbarat modülünü yönetir.
// Mevcut endpoint'lerle ÇAKIŞMAZ, tamamen ek katmandır.
// ═══════════════════════════════════════════════════════════════════

/**
 * Geçerli modül adları.
 * Frontend ve backend aynı listeyi kullanır.
 */
const ISTIHBARAT_MODULLERI = [
  'veri_havuzu', // Merkez veri havuzu — Tavily + çapraz kontrol (İLK çalışır)
  'ihale_gecmisi', // ihalebul.com — ihale geçmişi scraper
  'profil_analizi', // ihalebul.com — analiz sayfası scraper
  'katilimcilar', // ihalebul.com — katılımcı bilgileri scraper
  'kik_kararlari', // ihalebul.com — KİK kararları scraper
  'kik_yasaklilar', // EKAP — yasaklı firma sorgusu
  'sirket_bilgileri', // MERSİS + Ticaret Sicil Gazetesi
  'haberler', // Google News RSS haber taraması
  'ai_arastirma', // Claude AI istihbarat raporu
];

/**
 * Modül durumunu DB'de günceller (UPSERT).
 * Tüm modül tetikleme fonksiyonları bunu kullanır.
 */
async function updateModulDurum(yukleniciId, modul, durum, extras = {}) {
  const setClauses = ['durum = $3', 'updated_at = NOW()'];
  const values = [yukleniciId, modul, durum];
  let idx = 4;

  if (extras.veri !== undefined) {
    setClauses.push(`veri = $${idx}`);
    values.push(JSON.stringify(extras.veri));
    idx++;
  }
  if (extras.hata_mesaji !== undefined) {
    setClauses.push(`hata_mesaji = $${idx}`);
    values.push(extras.hata_mesaji);
    idx++;
  } else if (durum === 'tamamlandi' || durum === 'calisiyor') {
    // Yeni çalışma başladığında veya tamamlandığında eski hatayı temizle
    setClauses.push('hata_mesaji = NULL');
  }
  if (durum === 'tamamlandi') {
    setClauses.push('son_guncelleme = NOW()');
  }

  await query(
    `INSERT INTO yuklenici_istihbarat (yuklenici_id, modul, durum, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (yuklenici_id, modul)
     DO UPDATE SET ${setClauses.join(', ')}`,
    values
  );
}

/**
 * GET /api/contractors/:id/istihbarat
 * Bir yüklenicinin TÜM modüllerinin durumunu döner.
 * Frontend bu endpoint ile modül kartlarını doldurur.
 *
 * Yanıt formatı:
 * {
 *   success: true,
 *   data: {
 *     moduller: [
 *       { modul: "ihale_gecmisi", durum: "tamamlandi", son_guncelleme: "...", ... },
 *       { modul: "haberler", durum: "bekliyor", son_guncelleme: null, ... },
 *       ...
 *     ]
 *   }
 * }
 */
router.get('/:id/istihbarat', async (req, res) => {
  try {
    const { id } = req.params;
    // Polling endpoint — loglama kapalı (her 3 saniyede çağrılıyor, spam yapıyor)

    // DB'deki mevcut kayıtları çek
    const { rows } = await query(
      `SELECT modul, durum, son_guncelleme, veri, hata_mesaji, updated_at
       FROM yuklenici_istihbarat
       WHERE yuklenici_id = $1
       ORDER BY modul`,
      [id]
    );

    // DB'de kaydı olmayan modüller için varsayılan "bekliyor" durumu oluştur
    const mevcutMap = new Map(rows.map((r) => [r.modul, r]));
    const moduller = ISTIHBARAT_MODULLERI.map((modul) => {
      if (mevcutMap.has(modul)) {
        return mevcutMap.get(modul);
      }
      return {
        modul,
        durum: 'bekliyor',
        son_guncelleme: null,
        veri: {},
        hata_mesaji: null,
        updated_at: null,
      };
    });

    res.json({ success: true, data: { moduller } });
  } catch (error) {
    logError('İstihbarat Merkezi - Tüm Modüller', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/contractors/:id/modul/:modul/calistir
 * Belirli bir istihbarat modülünü tetikler.
 * Arka planda çalışır, anında { success: true, message: "Başlatıldı" } döner.
 *
 * Puppeteer kullanan modüller (ihalebul + EKAP + MERSIS) sıra bekler.
 * HTTP-only modüller (haberler, ai_arastirma) paralel çalışabilir.
 */
router.post('/:id/modul/:modul/calistir', async (req, res) => {
  try {
    const { id, modul } = req.params;

    // Geçersiz modül kontrolü
    if (!ISTIHBARAT_MODULLERI.includes(modul)) {
      return res.status(400).json({
        success: false,
        error: `Geçersiz modül: "${modul}". Geçerli modüller: ${ISTIHBARAT_MODULLERI.join(', ')}`,
      });
    }

    // Yüklenici var mı kontrol et
    const {
      rows: [yuklenici],
    } = await query('SELECT id, unvan FROM yukleniciler WHERE id = $1', [id]);
    if (!yuklenici) {
      return res.status(404).json({ success: false, error: 'Yüklenici bulunamadı' });
    }

    // Zaten çalışıyor mu kontrol et (10 dk'dan eski "calisiyor" durumları stale kabul edilir)
    const {
      rows: [mevcut],
    } = await query(
      `SELECT durum, updated_at FROM yuklenici_istihbarat
       WHERE yuklenici_id = $1 AND modul = $2`,
      [id, modul]
    );
    if (mevcut?.durum === 'calisiyor') {
      const ageMinutes = (Date.now() - new Date(mevcut.updated_at).getTime()) / 60000;
      if (ageMinutes < 10) {
        return res.status(409).json({
          success: false,
          error: `"${modul}" modülü zaten çalışıyor (${Math.round(ageMinutes)} dk). Lütfen bitmesini bekleyin.`,
        });
      }
      // 10+ dakikadır takılmış, yeniden çalıştırılabilir
      logAPI('İstihbarat Stale Reset', { modul, ageMinutes: Math.round(ageMinutes) });
    }

    // Durumu "çalışıyor" yap
    await updateModulDurum(id, modul, 'calisiyor');

    // Arka planda çalıştır (async IIFE)
    const t0 = Date.now();
    (async () => {
      logger.info(`[İSTİHBARAT] yk=${id} ⏳ ${modul} başladı`);
      try {
        await calistirModul(parseInt(id, 10), modul, yuklenici);
        const sure = ((Date.now() - t0) / 1000).toFixed(1);
        logger.info(`[İSTİHBARAT] yk=${id} ✅ ${modul} tamamlandı (${sure}s)`);
      } catch (err) {
        const sure = ((Date.now() - t0) / 1000).toFixed(1);
        logger.error(`[İSTİHBARAT] yk=${id} ❌ ${modul} hata (${sure}s): ${err.message}`);
        await updateModulDurum(id, modul, 'hata', {
          hata_mesaji: err.message || 'Bilinmeyen hata',
        });
      }
    })();

    logAPI('İstihbarat', `${modul} başlatıldı`, { yukleniciId: id });
    res.json({
      success: true,
      message: `"${modul}" modülü başlatıldı`,
      modul,
      durum: 'calisiyor',
    });
  } catch (error) {
    logError('İstihbarat Modül Tetikleme', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/contractors/:id/modul/tumunu-calistir
 * Tüm modülleri sırayla çalıştırır.
 * ihalebul modülleri ardışık (aynı Puppeteer sayfası),
 * diğerleri paralel (HTTP çağrıları).
 */
router.post('/:id/modul/tumunu-calistir', async (req, res) => {
  try {
    const { id } = req.params;

    const {
      rows: [yuklenici],
    } = await query('SELECT id, unvan FROM yukleniciler WHERE id = $1', [id]);
    if (!yuklenici) {
      return res.status(404).json({ success: false, error: 'Yüklenici bulunamadı' });
    }

    // Önce takılmış modülleri resetle (10+ dk "calisiyor" olanlar)
    await query(
      `UPDATE yuklenici_istihbarat
       SET durum = CASE
         WHEN veri IS NOT NULL AND veri != '{}'::jsonb THEN 'tamamlandi'
         WHEN hata_mesaji IS NOT NULL THEN 'hata'
         ELSE 'bekliyor'
       END, updated_at = NOW()
       WHERE yuklenici_id = $1 AND durum = 'calisiyor'
         AND updated_at < NOW() - INTERVAL '10 minutes'`,
      [id]
    );

    // Tüm modülleri "çalışıyor" olarak işaretle
    for (const modul of ISTIHBARAT_MODULLERI) {
      await updateModulDurum(id, modul, 'calisiyor');
    }

    // ─── Modül timeout helper ─────────────────────────────────────
    const MODUL_TIMEOUT_MS = 5 * 60 * 1000; // 5 dakika per modül

    function withTimeout(promise, modulAdi, timeoutMs = MODUL_TIMEOUT_MS) {
      return Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`${modulAdi} zaman aşımına uğradı (${timeoutMs / 1000}s)`)), timeoutMs)
        ),
      ]);
    }

    // Arka planda TÜM modülleri paralel çalıştır
    // Her modül bağımsız: biri takılırsa diğerleri etkilenmez
    const yukId = parseInt(id, 10);
    const istihbaratLog = (msg) => logger.info(`[İSTİHBARAT] yk=${yukId} ${msg}`);

    // Sıralama: veri_havuzu İLK → diğerleri PARALEL → ai_arastirma SON
    const havuzModul = 'veri_havuzu';
    const aiModul = 'ai_arastirma';
    const ortaModuller = ISTIHBARAT_MODULLERI.filter(m => m !== havuzModul && m !== aiModul);

    istihbaratLog(`▶ ${ISTIHBARAT_MODULLERI.length} modül sıralı başlatılıyor (${yuklenici.unvan})`);
    istihbaratLog(`  Sıra: veri_havuzu → ${ortaModuller.length} paralel → ai_arastirma`);

    (async () => {
      let okCount = 0;
      let failCount = 0;

      // ─── Faz 1: Veri Havuzu (İLK — Tavily + çapraz kontrol) ───
      const t0havuz = Date.now();
      try {
        istihbaratLog(`  ⏳ ${havuzModul} başladı (Faz 1)`);
        await withTimeout(calistirModul(yukId, havuzModul, yuklenici), havuzModul);
        istihbaratLog(`  ✅ ${havuzModul} tamamlandı (${((Date.now() - t0havuz) / 1000).toFixed(1)}s)`);
        okCount++;
      } catch (err) {
        istihbaratLog(`  ❌ ${havuzModul} hata (${((Date.now() - t0havuz) / 1000).toFixed(1)}s): ${err.message}`);
        await updateModulDurum(id, havuzModul, 'hata', { hata_mesaji: err.message }).catch(() => {});
        failCount++;
        // Havuz hata verse de diğer modüller devam edebilir
      }

      // ─── Faz 2: Diğer modüller PARALEL ────────────────────────
      const ortaResults = await Promise.allSettled(
        ortaModuller.map(async (modul) => {
          const t0 = Date.now();
          try {
            istihbaratLog(`  ⏳ ${modul} başladı (Faz 2)`);
            await withTimeout(calistirModul(yukId, modul, yuklenici), modul);
            istihbaratLog(`  ✅ ${modul} tamamlandı (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
          } catch (err) {
            istihbaratLog(`  ❌ ${modul} hata (${((Date.now() - t0) / 1000).toFixed(1)}s): ${err.message}`);
            await updateModulDurum(id, modul, 'hata', { hata_mesaji: err.message }).catch(() => {});
            throw err; // allSettled yakalar
          }
        })
      );
      okCount += ortaResults.filter(r => r.status === 'fulfilled').length;
      failCount += ortaResults.filter(r => r.status === 'rejected').length;

      // ─── Faz 3: AI İstihbarat (SON — tüm veriyi okur) ─────────
      const t0ai = Date.now();
      try {
        istihbaratLog(`  ⏳ ${aiModul} başladı (Faz 3 — tüm veriyi sentezleyecek)`);
        await withTimeout(calistirModul(yukId, aiModul, yuklenici), aiModul, 8 * 60 * 1000); // AI için 8 dk
        istihbaratLog(`  ✅ ${aiModul} tamamlandı (${((Date.now() - t0ai) / 1000).toFixed(1)}s)`);
        okCount++;
      } catch (err) {
        istihbaratLog(`  ❌ ${aiModul} hata (${((Date.now() - t0ai) / 1000).toFixed(1)}s): ${err.message}`);
        await updateModulDurum(id, aiModul, 'hata', { hata_mesaji: err.message }).catch(() => {});
        failCount++;
      }

      istihbaratLog(`■ Tamamlandı: ${okCount} başarılı, ${failCount} hatalı`);
    })();

    logAPI('İstihbarat', 'Tüm Modüller Başlatıldı', { yukleniciId: id, modul_sayisi: ISTIHBARAT_MODULLERI.length });
    res.json({
      success: true,
      message: 'Tüm istihbarat modülleri başlatıldı',
    });
  } catch (error) {
    logError('Toplu İstihbarat Tetikleme', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/contractors/:id/modul/:modul/durum
 * Belirli bir modülün anlık durumunu sorgular.
 * Frontend bu endpoint'i polling ile kullanır (modül çalışırken).
 */
router.get('/:id/modul/:modul/durum', async (req, res) => {
  try {
    const { id, modul } = req.params;

    const {
      rows: [row],
    } = await query(
      `SELECT modul, durum, son_guncelleme, hata_mesaji, updated_at
       FROM yuklenici_istihbarat
       WHERE yuklenici_id = $1 AND modul = $2`,
      [id, modul]
    );

    res.json({
      success: true,
      data: row || { modul, durum: 'bekliyor', son_guncelleme: null },
    });
  } catch (error) {
    logError('İstihbarat Modül Durum', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/contractors/:id/modul/:modul/veri
 * Belirli bir modülün sakladığı veriyi döner.
 * ihalebul modülleri için ana tablolardan çeker,
 * yeni modüller için yuklenici_istihbarat.veri alanından döner.
 */
router.get('/:id/modul/:modul/veri', async (req, res) => {
  try {
    const { id, modul } = req.params;

    // ihalebul modülleri: veri ana tablolarda, oradan çek
    if (modul === 'ihale_gecmisi') {
      const { rows } = await query(
        `SELECT * FROM yuklenici_ihaleleri
         WHERE yuklenici_id = $1 AND rol IN ('yuklenici', 'katilimci')
         ORDER BY sozlesme_tarihi DESC NULLS LAST
         LIMIT 200`,
        [id]
      );
      return res.json({ success: true, data: { ihaleler: rows, toplam: rows.length } });
    }

    if (modul === 'profil_analizi') {
      const {
        rows: [yk],
      } = await query('SELECT analiz_verisi, analiz_scraped_at, aktif_sehirler FROM yukleniciler WHERE id = $1', [id]);
      return res.json({
        success: true,
        data: {
          analiz: yk?.analiz_verisi,
          scraped_at: yk?.analiz_scraped_at,
          aktif_sehirler: yk?.aktif_sehirler || [],
        },
      });
    }

    if (modul === 'katilimcilar') {
      const { rows } = await query(
        `SELECT * FROM yuklenici_ihaleleri
         WHERE yuklenici_id = $1 AND rol = 'katilimci'
         ORDER BY created_at DESC
         LIMIT 100`,
        [id]
      );
      return res.json({ success: true, data: { katilimcilar: rows } });
    }

    if (modul === 'kik_kararlari') {
      const { rows } = await query(
        `SELECT * FROM yuklenici_ihaleleri
         WHERE yuklenici_id = $1 AND rol = 'kik_karari'
         ORDER BY created_at DESC
         LIMIT 100`,
        [id]
      );
      return res.json({ success: true, data: { kararlar: rows } });
    }

    // Yeni modüller: veri JSONB alanından
    const {
      rows: [row],
    } = await query(
      `SELECT veri, son_guncelleme, durum
       FROM yuklenici_istihbarat
       WHERE yuklenici_id = $1 AND modul = $2`,
      [id, modul]
    );

    res.json({
      success: true,
      data: row ? { ...row.veri, son_guncelleme: row.son_guncelleme } : null,
    });
  } catch (error) {
    logError('İstihbarat Modül Veri', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/contractors/bildirimler
 * Okunmamış yüklenici bildirimlerini döner (bildirim zili için).
 * ?limit=20 parametresiyle sayı sınırlanabilir.
 */
router.get('/bildirimler/liste', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;

    const { rows } = await query(
      `SELECT yb.*, y.kisa_ad, y.unvan
       FROM yuklenici_bildirimler yb
       LEFT JOIN yukleniciler y ON y.id = yb.yuklenici_id
       ORDER BY yb.created_at DESC
       LIMIT $1`,
      [limit]
    );

    // Okunmamış toplam sayı (badge için)
    const {
      rows: [countRow],
    } = await query(`SELECT COUNT(*) as sayi FROM yuklenici_bildirimler WHERE okundu = false`);

    res.json({
      success: true,
      data: {
        bildirimler: rows,
        okunmamis_sayisi: parseInt(countRow.sayi, 10),
      },
    });
  } catch (error) {
    logError('Bildirim Listesi', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/contractors/bildirimler/:bildirimId/oku
 * Bir bildirimi "okundu" olarak işaretler.
 */
router.patch('/bildirimler/:bildirimId/oku', async (req, res) => {
  try {
    const { bildirimId } = req.params;

    await query('UPDATE yuklenici_bildirimler SET okundu = true WHERE id = $1', [bildirimId]);

    res.json({ success: true });
  } catch (error) {
    logError('Bildirim Okundu', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/contractors/bildirimler/tumunu-oku
 * Tüm bildirimleri okundu olarak işaretler.
 */
router.post('/bildirimler/tumunu-oku', async (_req, res) => {
  try {
    await query('UPDATE yuklenici_bildirimler SET okundu = true WHERE okundu = false');
    res.json({ success: true });
  } catch (error) {
    logError('Tüm Bildirimler Okundu', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/contractors/:id/fiyat-tahmin
 * Bir yüklenicinin geçmiş ihalelerine dayalı fiyat tahmini.
 * Sektör/şehir bazlı indirim ortalamaları ve trend analizi.
 */
router.get('/:id/fiyat-tahmin', async (req, res) => {
  try {
    const { id } = req.params;

    // Tüm ihalelerdeki indirim oranlarını çek
    const { rows: ihaleler } = await query(
      `SELECT indirim_orani, sozlesme_bedeli, yaklasik_maliyet, sehir, sozlesme_tarihi
       FROM yuklenici_ihaleleri
       WHERE yuklenici_id = $1
         AND rol = 'yuklenici'
         AND indirim_orani IS NOT NULL
         AND indirim_orani > 0
       ORDER BY sozlesme_tarihi DESC NULLS LAST`,
      [id]
    );

    if (ihaleler.length === 0) {
      return res.json({
        success: true,
        data: { yeterli_veri: false, mesaj: 'Fiyat tahmini için yeterli ihale verisi yok' },
      });
    }

    const indirimler = ihaleler.map((i) => parseFloat(i.indirim_orani));

    // Temel istatistikler
    const ortalama = indirimler.reduce((a, b) => a + b, 0) / indirimler.length;
    const sorted = [...indirimler].sort((a, b) => a - b);
    const medyan = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    // Trend: son 10 vs önceki ihaleler
    const son10 = indirimler.slice(0, Math.min(10, indirimler.length));
    const oncekiler = indirimler.slice(10);
    const son10Ort = son10.reduce((a, b) => a + b, 0) / son10.length;
    const oncekiOrt = oncekiler.length > 0 ? oncekiler.reduce((a, b) => a + b, 0) / oncekiler.length : son10Ort;
    const fark = son10Ort - oncekiOrt;
    let trend = 'sabit';
    if (fark > 2)
      trend = 'artiyor'; // İndirim oranı artıyor → daha agresif
    else if (fark < -2) trend = 'azaliyor'; // İndirim oranı azalıyor → daha tutucu

    // Şehir bazlı ortalamalar
    const sehirMap = new Map();
    for (const ihale of ihaleler) {
      if (!ihale.sehir) continue;
      if (!sehirMap.has(ihale.sehir)) sehirMap.set(ihale.sehir, []);
      sehirMap.get(ihale.sehir).push(parseFloat(ihale.indirim_orani));
    }
    const sehir_bazli = [...sehirMap.entries()]
      .map(([sehir, vals]) => ({
        sehir,
        ort_indirim: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2),
        ihale_sayisi: vals.length,
      }))
      .sort((a, b) => b.ihale_sayisi - a.ihale_sayisi)
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        yeterli_veri: true,
        toplam_ihale: ihaleler.length,
        ortalama_indirim: +ortalama.toFixed(2),
        medyan_indirim: +medyan.toFixed(2),
        min_indirim: +min.toFixed(2),
        max_indirim: +max.toFixed(2),
        trend,
        trend_detay: {
          son_10_ort: +son10Ort.toFixed(2),
          onceki_ort: +oncekiOrt.toFixed(2),
          fark: +fark.toFixed(2),
        },
        sehir_bazli,
      },
    });
  } catch (error) {
    logError('Fiyat Tahmini', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Derin Analiz (Tavily Research) ─────────────────────────────────
/**
 * POST /api/contractors/:id/derin-analiz
 * Tavily Research ile kapsamlı firma araştırması.
 * Birden fazla alt sorgu ile paralel arama yapar, sonuçları birleştirir.
 * Premium özellik — her çağrı ~5-8 Tavily kredisi harcar.
 */
router.post('/:id/derin-analiz', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows: [yuklenici] } = await query(
      'SELECT id, unvan, kisa_ad FROM yukleniciler WHERE id = $1',
      [id]
    );
    if (!yuklenici) {
      return res.status(404).json({ success: false, error: 'Yüklenici bulunamadı' });
    }

    const { tavilyResearch, isTavilyConfigured } = await import('../services/tavily-service.js');
    if (!isTavilyConfigured()) {
      return res.status(400).json({ success: false, error: 'Tavily API yapılandırılmamış' });
    }

    const kisaAd = (yuklenici.kisa_ad || yuklenici.unvan).split(/\s+/).slice(0, 3).join(' ');

    // Alt sorgular: farklı açılardan firma istihbaratı
    const subQueries = [
      `"${kisaAd}" ihale sözleşme kamu`,
      `"${kisaAd}" KİK karar şikayet`,
      `"${kisaAd}" yemek catering gıda hizmet`,
    ];

    logAPI('Derin Analiz', `Başlatılıyor: ${yuklenici.unvan}`, { yukleniciId: id });

    const result = await tavilyResearch(`"${kisaAd}" yüklenici ihale analiz`, {
      subQueries,
      maxSources: 10,
      days: 365,
    });

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    // Sonucu DB'ye kaydet (istihbarat modülüne)
    await query(
      `INSERT INTO yuklenici_istihbarat (yuklenici_id, modul, durum, veri, son_guncelleme, updated_at)
       VALUES ($1, 'derin_analiz', 'tamamlandi', $2, NOW(), NOW())
       ON CONFLICT (yuklenici_id, modul)
       DO UPDATE SET durum = 'tamamlandi', veri = $2, son_guncelleme = NOW(), updated_at = NOW(), hata_mesaji = NULL`,
      [id, JSON.stringify({
        ozet: result.summary,
        kaynaklar: result.sources,
        kaynak_sayisi: result.totalSources,
        alt_sorgular: result.subQueriesUsed,
        olusturma_tarihi: new Date().toISOString(),
      })]
    );

    logAPI('Derin Analiz', `Tamamlandı: ${result.totalSources} kaynak`, { yukleniciId: id });

    res.json({
      success: true,
      data: {
        ozet: result.summary,
        kaynaklar: result.sources,
        kaynak_sayisi: result.totalSources,
        alt_sorgular: result.subQueriesUsed,
      },
    });
  } catch (error) {
    logError('Derin Analiz', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/contractors/:id/derin-analiz
 * Son derin analiz sonucunu döner (cache).
 */
router.get('/:id/derin-analiz', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows: [row] } = await query(
      `SELECT veri, son_guncelleme, durum
       FROM yuklenici_istihbarat
       WHERE yuklenici_id = $1 AND modul = 'derin_analiz'`,
      [id]
    );

    if (!row || !row.veri) {
      return res.json({ success: true, data: null });
    }

    res.json({
      success: true,
      data: {
        ...row.veri,
        son_guncelleme: row.son_guncelleme,
      },
    });
  } catch (error) {
    logError('Derin Analiz Getir', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Modül Çalıştırma Merkezi ─────────────────────────────────────
// Her modülün arka plan iş mantığını yöneten fonksiyon.
// Modüle göre doğru scraper/servisi çağırır.

async function calistirModul(yukleniciId, modul, yuklenici) {
  const startTime = Date.now();

  switch (modul) {
    // ──────── Merkez Veri Havuzu (Tavily + çapraz kontrol) ─────────

    case 'veri_havuzu': {
      const { collectVeriHavuzu } = await import('../services/yuklenici-veri-havuzu.js');
      const result = await collectVeriHavuzu(yukleniciId, { force: true });
      await updateModulDurum(yukleniciId, modul, 'tamamlandi', { veri: result });
      break;
    }

    // ──────── ihalebul.com Modülleri (mevcut scraper'ları kullanır) ────────

    case 'ihale_gecmisi': {
      const { default: browserManager } = await import('../scraper/shared/browser.js');
      const { scrapeContractorTenders } = await import('../scraper/yuklenici-istihbarat/yuklenici-gecmisi-cek.js');

      const page = await browserManager.createPage();
      try {
        // İstihbarat için 5 sayfa/faz yeterli (15 çok uzun sürüyor)
        const result = await scrapeContractorTenders(page, yuklenici, {
          maxPages: 5,
          onPageComplete: (pageNum, tenders, s) => {
            logger.info(`[İSTİHBARAT] yk=${yukleniciId} ihale_gecmisi: sayfa ${pageNum} — ${tenders.length} ihale (toplam: ${s.tenders_found})`);
          },
        });
        await updateModulDurum(yukleniciId, modul, 'tamamlandi', {
          veri: { stats: result.stats, sure_ms: Date.now() - startTime },
        });
      } finally {
        if (page && !page.isClosed()) await page.close().catch(() => {});
      }
      break;
    }

    case 'profil_analizi': {
      const { default: browserManager } = await import('../scraper/shared/browser.js');
      const { scrapeAnalyzePage } = await import('../scraper/yuklenici-istihbarat/yuklenici-profil-cek.js');

      const page = await browserManager.createPage();
      try {
        const result = await scrapeAnalyzePage(page, yuklenici);
        if (!result.success) throw new Error(result.error || 'Analiz sayfası çekilemedi');
        await updateModulDurum(yukleniciId, modul, 'tamamlandi', {
          veri: { bolum_sayisi: Object.keys(result.data || {}).length, sure_ms: Date.now() - startTime },
        });
      } finally {
        if (page && !page.isClosed()) await page.close().catch(() => {});
      }
      break;
    }

    case 'katilimcilar': {
      const { default: browserManager } = await import('../scraper/shared/browser.js');
      const { batchScrapeParticipants } = await import('../scraper/yuklenici-istihbarat/ihale-katilimci-cek.js');

      // Son 10 ihaleyi çek (katılımcı linki olanlar)
      const { rows: recentTenders } = await query(
        `SELECT t.id, t.external_id, t.document_links
         FROM tenders t
         INNER JOIN yuklenici_ihaleleri yi ON yi.tender_id = t.id
         WHERE yi.yuklenici_id = $1
           AND t.document_links IS NOT NULL
         ORDER BY t.tender_date DESC NULLS LAST
         LIMIT 10`,
        [yukleniciId]
      );

      if (recentTenders.length === 0) {
        await updateModulDurum(yukleniciId, modul, 'tamamlandi', {
          veri: { mesaj: 'Katılımcı linki olan ihale bulunamadı', sure_ms: Date.now() - startTime },
        });
        break;
      }

      const page = await browserManager.createPage();
      try {
        const result = await batchScrapeParticipants(page, recentTenders, { maxTenders: 10 });
        await updateModulDurum(yukleniciId, modul, 'tamamlandi', {
          veri: { stats: result.stats, sure_ms: Date.now() - startTime },
        });
      } finally {
        if (page && !page.isClosed()) await page.close().catch(() => {});
      }
      break;
    }

    case 'kik_kararlari': {
      const { default: browserManager } = await import('../scraper/shared/browser.js');
      const { scrapeKikDecisions } = await import('../scraper/yuklenici-istihbarat/yuklenici-gecmisi-cek.js');

      const page = await browserManager.createPage();
      try {
        const result = await scrapeKikDecisions(page, yuklenici, {
          maxPages: 3,
          onProgress: (info) => {
            logger.info(`[İSTİHBARAT] yk=${yukleniciId} kik_kararlari: ${info}`);
          },
        });
        await updateModulDurum(yukleniciId, modul, 'tamamlandi', {
          veri: { stats: result.stats, sure_ms: Date.now() - startTime },
        });
      } finally {
        if (page && !page.isClosed()) await page.close().catch(() => {});
      }
      break;
    }

    // ──────── Yeni Modüller (Faz 2'de servis dosyaları yazılacak) ────────

    case 'kik_yasaklilar': {
      // Faz 2.1'de yazılacak: kik-yasakli-sorgula.js
      try {
        const { scrapeKikYasakli } = await import('../scraper/yuklenici-istihbarat/kik-yasakli-sorgula.js');
        const result = await scrapeKikYasakli(yuklenici);
        await updateModulDurum(yukleniciId, modul, 'tamamlandi', { veri: result });
      } catch (importErr) {
        // Modül henüz yazılmadıysa geçici mesaj
        if (importErr.code === 'ERR_MODULE_NOT_FOUND') {
          await updateModulDurum(yukleniciId, modul, 'hata', {
            hata_mesaji: 'Bu modül henüz aktif değil. Yakında eklenecek.',
          });
        } else {
          throw importErr;
        }
      }
      break;
    }

    case 'sirket_bilgileri': {
      // Faz 2.2'de yazılacak: sirket-bilgi-cek.js
      try {
        const { scrapeSirketBilgileri } = await import('../scraper/yuklenici-istihbarat/sirket-bilgi-cek.js');
        const result = await scrapeSirketBilgileri(yuklenici);
        await updateModulDurum(yukleniciId, modul, 'tamamlandi', { veri: result });
      } catch (importErr) {
        if (importErr.code === 'ERR_MODULE_NOT_FOUND') {
          await updateModulDurum(yukleniciId, modul, 'hata', {
            hata_mesaji: 'Bu modül henüz aktif değil. Yakında eklenecek.',
          });
        } else {
          throw importErr;
        }
      }
      break;
    }

    case 'haberler': {
      // Faz 2.3'te yazılacak: haber-ara.js
      try {
        const { araHaberler } = await import('../scraper/yuklenici-istihbarat/haber-ara.js');
        const result = await araHaberler(yuklenici.unvan);
        await updateModulDurum(yukleniciId, modul, 'tamamlandi', { veri: result });
      } catch (importErr) {
        if (importErr.code === 'ERR_MODULE_NOT_FOUND') {
          await updateModulDurum(yukleniciId, modul, 'hata', {
            hata_mesaji: 'Bu modül henüz aktif değil. Yakında eklenecek.',
          });
        } else {
          throw importErr;
        }
      }
      break;
    }

    case 'ai_arastirma': {
      // Faz 2.4'te yazılacak: yuklenici-ai-arastirma.js
      try {
        const { generateIstihbaratRaporu } = await import('../services/yuklenici-ai-arastirma.js');
        const result = await generateIstihbaratRaporu(yukleniciId);
        await updateModulDurum(yukleniciId, modul, 'tamamlandi', { veri: result });
      } catch (importErr) {
        if (importErr.code === 'ERR_MODULE_NOT_FOUND') {
          await updateModulDurum(yukleniciId, modul, 'hata', {
            hata_mesaji: 'Bu modül henüz aktif değil. Yakında eklenecek.',
          });
        } else {
          throw importErr;
        }
      }
      break;
    }

    default:
      throw new Error(`Bilinmeyen modül: ${modul}`);
  }
}

export default router;
