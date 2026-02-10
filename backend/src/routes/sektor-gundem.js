/**
 * Sektör Gündem API Route
 * ───────────────────────
 * Hibrit pipeline: Tavily + DB/Scraper + Claude AI
 *
 * Endpoints:
 *   GET /api/sektor-gundem/ihale         — İhale Merkezi odaklı haberler
 *   GET /api/sektor-gundem/istihbarat    — Yüklenici istihbaratı odaklı haberler
 *   GET /api/sektor-gundem/firma         — Firma bazlı hibrit arama
 *   GET /api/sektor-gundem/usage         — Tavily kredi kullanım durumu
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  fetchFirmaHaberleri,
  fetchIhaleGundem,
  fetchIstihbaratGundem,
  readCache,
  writeCache,
} from '../services/sektor-gundem-aggregator.js';

const router = express.Router();

// Tüm endpoint'ler auth gerektirir
router.use(authenticate);

// ─── CACHE TTL (saat) ────────────────────────────────────

const CACHE_TTL = {
  ihale: 4,
  istihbarat: 6,
  firma: 12,
};

// ─── İHALE MERKEZI GÜNDEMİ ──────────────────────────────

/**
 * GET /api/sektor-gundem/ihale
 * İhale odaklı sektör gündemi (5 kategori)
 * Query: ?refresh=1 → cache bypass
 */
router.get('/ihale', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === '1';
    const syncType = 'sektor_gundem_ihale';

    // Cache kontrol
    if (!forceRefresh) {
      const cached = await readCache(syncType, CACHE_TTL.ihale);
      if (cached.hit) {
        return res.json({
          success: true,
          kaynak: 'cache',
          guncelleme: cached.guncelleme,
          sonraki_guncelleme: new Date(new Date(cached.guncelleme).getTime() + CACHE_TTL.ihale * 3600000),
          konular: cached.data.konular || [],
        });
      }
    }

    // Canlı çek
    const konular = await fetchIhaleGundem();

    // Cache'e yaz
    await writeCache(syncType, { konular });

    res.json({
      success: true,
      kaynak: 'canli',
      guncelleme: new Date(),
      konular,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── İSTİHBARAT GÜNDEMİ ─────────────────────────────────

/**
 * GET /api/sektor-gundem/istihbarat
 * İstihbarat odaklı sektör gündemi (5 kategori)
 * Query: ?refresh=1 → cache bypass
 */
router.get('/istihbarat', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === '1';
    const syncType = 'sektor_gundem_istihbarat';

    if (!forceRefresh) {
      const cached = await readCache(syncType, CACHE_TTL.istihbarat);
      if (cached.hit) {
        return res.json({
          success: true,
          kaynak: 'cache',
          guncelleme: cached.guncelleme,
          sonraki_guncelleme: new Date(new Date(cached.guncelleme).getTime() + CACHE_TTL.istihbarat * 3600000),
          konular: cached.data.konular || [],
        });
      }
    }

    const konular = await fetchIstihbaratGundem();
    await writeCache(syncType, { konular });

    res.json({
      success: true,
      kaynak: 'canli',
      guncelleme: new Date(),
      konular,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── FİRMA BAZLI HABERLER ───────────────────────────────

/**
 * GET /api/sektor-gundem/firma?q=Firma+Adı
 * Firma bazlı hibrit haber araması
 * Query: ?q=firmaAdi&refresh=1
 */
router.get('/firma', async (req, res) => {
  try {
    const firmaAdi = req.query.q?.trim();
    if (!firmaAdi || firmaAdi.length < 3) {
      return res.status(400).json({ success: false, error: 'Firma adı en az 3 karakter olmalı (?q=...)' });
    }

    const forceRefresh = req.query.refresh === '1';
    const firmaSlug = firmaAdi.toLowerCase().replace(/\s+/g, '_').substring(0, 50);
    const syncType = `sektor_gundem_firma_${firmaSlug}`;

    if (!forceRefresh) {
      const cached = await readCache(syncType, CACHE_TTL.firma);
      if (cached.hit) {
        return res.json({
          ...cached.data,
          kaynak: 'cache',
          guncelleme: cached.guncelleme,
        });
      }
    }

    const result = await fetchFirmaHaberleri(firmaAdi);

    if (result.success) {
      await writeCache(syncType, result);
    }

    res.json({
      ...result,
      kaynak: 'canli',
      guncelleme: new Date(),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── KULLANIM DURUMU ─────────────────────────────────────

/**
 * GET /api/sektor-gundem/usage
 * Tavily kredi kullanım durumu + cache istatistikleri
 */
router.get('/usage', async (_req, res) => {
  try {
    // Son 30 günde yapılan Tavily aramaları (sync_logs'dan tahmin)
    const { rows: logs } = (await res.locals?.db?.query)
      ? { rows: [] }
      : await (async () => {
          try {
            const r = await (await import('../database.js')).query(
              `SELECT sync_type, COUNT(*) as adet, MAX(finished_at) as son_guncelleme
               FROM sync_logs
               WHERE sync_type LIKE 'sektor_gundem_%' AND status = 'success'
               AND finished_at > NOW() - INTERVAL '30 days'
               GROUP BY sync_type
               ORDER BY son_guncelleme DESC`
            );
            return r;
          } catch {
            return { rows: [] };
          }
        })();

    // Tahmini kredi kullanımı
    const ihaleCount = logs.find((l) => l.sync_type === 'sektor_gundem_ihale')?.adet || 0;
    const istihbaratCount = logs.find((l) => l.sync_type === 'sektor_gundem_istihbarat')?.adet || 0;
    const firmaCount = logs
      .filter((l) => l.sync_type?.startsWith('sektor_gundem_firma_'))
      .reduce((s, l) => s + Number(l.adet), 0);

    const tahminiKredi = ihaleCount * 5 + istihbaratCount * 5 + firmaCount * 1;

    res.json({
      success: true,
      kullanim: {
        ihale_guncelleme: Number(ihaleCount),
        istihbarat_guncelleme: Number(istihbaratCount),
        firma_arama: firmaCount,
        tahmini_tavily_kredi: tahminiKredi,
        aylik_limit: 1000,
        kalan_tahmini: Math.max(0, 1000 - tahminiKredi),
      },
      cache_durumu: logs.map((l) => ({
        tip: l.sync_type,
        guncelleme_sayisi: Number(l.adet),
        son_guncelleme: l.son_guncelleme,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
