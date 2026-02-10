/**
 * Yüklenici Merkez Veri Havuzu
 * ────────────────────────────
 * Tüm web istihbarat verisini merkezi olarak toplar ve persist eder.
 * Diğer modüller ve AI raporu bu havuzdan okur.
 *
 * Toplanan veri:
 *   - 4x Tavily Search (ihale, KİK, haber, sicil)
 *   - Tavily Extract (5 tam metin)
 *   - DB çapraz kontrol (coopetition, rakip eşleşmeler)
 *
 * Depolama: yuklenici_istihbarat tablosu, modul = 'veri_havuzu'
 * TTL: 6 saat (tekrar çalıştırılırsa eski veriyi günceller)
 */

import {
  isTavilyConfigured,
  tavilyExtract,
  tavilySearch,
} from './tavily-service.js';
import { query } from '../database.js';
import { logAPI, logError } from '../utils/logger.js';

const MODULE_NAME = 'Veri-Havuzu';
const HAVUZ_TTL_MS = 6 * 60 * 60 * 1000; // 6 saat

/**
 * Merkez veri havuzunu doldurur.
 * @param {number} yukleniciId
 * @param {object} [options]
 * @param {boolean} [options.force=false] TTL dolmamış olsa bile yeniden topla
 * @returns {Promise<object>} Toplanan veri
 */
export async function collectVeriHavuzu(yukleniciId, options = {}) {
  const startTime = Date.now();
  logAPI(MODULE_NAME, 'toplama_basladi', { yukleniciId });

  try {
    // ─── 1. Cache kontrolü (force değilse) ──────────────────
    if (!options.force) {
      const cached = await getCachedHavuz(yukleniciId);
      if (cached) {
        logAPI(MODULE_NAME, 'cache_hit', {
          yukleniciId,
          age_min: Math.round((Date.now() - new Date(cached.meta.toplama_tarihi).getTime()) / 60000),
        });
        return cached;
      }
    }

    // ─── 2. Yüklenici bilgilerini al ────────────────────────
    const {
      rows: [yuklenici],
    } = await query(
      `SELECT id, unvan, kisa_ad, analiz_verisi
       FROM yukleniciler WHERE id = $1`,
      [yukleniciId]
    );

    if (!yuklenici) throw new Error('Yüklenici bulunamadı');

    const kisaAd = yuklenici.unvan.split(/\s+/).slice(0, 3).join(' ');
    const tamUnvan = yuklenici.unvan;

    // ─── 3. Paralel veri toplama (Tavily + DB cross-ref) ────
    const [tavilyData, crossRefData] = await Promise.all([
      // Tavily aramaları
      isTavilyConfigured()
        ? collectTavilyData(kisaAd, tamUnvan)
        : Promise.resolve(null),
      // DB çapraz kontrol
      collectCrossRefData(yukleniciId, yuklenici.analiz_verisi),
    ]);

    // ─── 4. Sonucu yapılandır ───────────────────────────────
    const havuzVeri = {
      web_istihbarat: tavilyData?.searchResults || null,
      tam_metinler: tavilyData?.fullTexts || [],
      capraz_kontrol: crossRefData,
      meta: {
        toplama_tarihi: new Date().toISOString(),
        tavily_aktif: isTavilyConfigured(),
        tavily_arama_sayisi: tavilyData ? 4 : 0,
        sonuc_toplam: tavilyData
          ? (tavilyData.searchResults?.ihale_sonuclari?.length || 0) +
            (tavilyData.searchResults?.kik_sonuclari?.length || 0) +
            (tavilyData.searchResults?.haber_sonuclari?.length || 0) +
            (tavilyData.searchResults?.sicil_sonuclari?.length || 0)
          : 0,
        tam_metin_sayisi: tavilyData?.fullTexts?.length || 0,
        sure_ms: Date.now() - startTime,
      },
    };

    logAPI(MODULE_NAME, 'toplama_tamamlandi', {
      yukleniciId,
      sure_ms: havuzVeri.meta.sure_ms,
      sonuc: havuzVeri.meta.sonuc_toplam,
      tamMetin: havuzVeri.meta.tam_metin_sayisi,
    });

    return havuzVeri;
  } catch (error) {
    logError(MODULE_NAME, error);
    throw error;
  }
}

/**
 * Havuzdan cache'li veriyi oku (6 saat TTL).
 * @param {number} yukleniciId
 * @returns {Promise<object|null>}
 */
export async function getCachedHavuz(yukleniciId) {
  try {
    const {
      rows: [row],
    } = await query(
      `SELECT veri, updated_at
       FROM yuklenici_istihbarat
       WHERE yuklenici_id = $1 AND modul = 'veri_havuzu'
         AND durum = 'tamamlandi' AND veri IS NOT NULL`,
      [yukleniciId]
    );

    if (!row?.veri) return null;

    // TTL kontrolü
    const age = Date.now() - new Date(row.updated_at).getTime();
    if (age > HAVUZ_TTL_MS) return null;

    return row.veri;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// Tavily Veri Toplama
// ═══════════════════════════════════════════════════════════════

async function collectTavilyData(kisaAd, tamUnvan) {
  try {
    // 4 paralel arama
    const [webResult, kikResult, habResult, sicilResult] = await Promise.all([
      tavilySearch(`"${kisaAd}" ihale sözleşme kamu`, {
        searchDepth: 'advanced',
        maxResults: 10,
        includeAnswer: true,
      }).catch(() => ({ success: false })),

      tavilySearch(`"${kisaAd}" KİK karar şikayet itiraz`, {
        searchDepth: 'advanced',
        maxResults: 10,
        includeAnswer: false,
      }).catch(() => ({ success: false })),

      tavilySearch(`"${kisaAd}" haber yemek catering gıda`, {
        searchDepth: 'basic',
        maxResults: 10,
        includeAnswer: true,
      }).catch(() => ({ success: false })),

      tavilySearch(`"${tamUnvan}" ticaret sicil kuruluş`, {
        searchDepth: 'basic',
        maxResults: 5,
        includeAnswer: false,
      }).catch(() => ({ success: false })),
    ]);

    const searchResults = {
      ihale_sonuclari: webResult.success ? webResult.results : [],
      kik_sonuclari: kikResult.success ? kikResult.results : [],
      haber_sonuclari: habResult.success ? habResult.results : [],
      sicil_sonuclari: sicilResult.success ? sicilResult.results : [],
      ai_ozet: webResult.success ? webResult.answer : null,
      haber_ozet: habResult.success ? habResult.answer : null,
    };

    // Tam metin çekilecek URL'leri topla (KİK + ihale bilgi siteleri)
    const extractableUrls = [
      ...searchResults.kik_sonuclari,
      ...searchResults.ihale_sonuclari,
      ...searchResults.haber_sonuclari,
    ]
      .filter((r) => {
        if (!r.url) return false;
        const url = r.url.toLowerCase();
        return (
          url.includes('arsiv.kikkararlari.com') ||
          url.includes('ihalebilgileri.com') ||
          url.includes('ihaleciler.com') ||
          url.includes('ihalegundem.com') ||
          url.includes('kik.gov.tr')
        );
      })
      .slice(0, 5)
      .map((r) => r.url);

    let fullTexts = [];
    if (extractableUrls.length > 0) {
      try {
        const extractResult = await tavilyExtract(extractableUrls);
        if (extractResult.success) {
          fullTexts = extractResult.results.map((r) => ({
            url: r.url,
            domain: getDomain(r.url),
            metin: r.rawContent || '',
          }));
        }
      } catch {
        // Extract opsiyonel
      }
    }

    logAPI(MODULE_NAME, 'tavily_sonuclari', {
      ihale: searchResults.ihale_sonuclari.length,
      kik: searchResults.kik_sonuclari.length,
      haber: searchResults.haber_sonuclari.length,
      sicil: searchResults.sicil_sonuclari.length,
      tamMetin: fullTexts.length,
    });

    return { searchResults, fullTexts };
  } catch (err) {
    logError(MODULE_NAME, err, 'Tavily veri toplama hatası');
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// DB Çapraz Kontrol (Coopetition + Rakip-İhale Eşleşme)
// ═══════════════════════════════════════════════════════════════

async function collectCrossRefData(yukleniciId, analizVerisi) {
  const result = {
    coopetition: [],
    rakip_ihale_eslesmeler: [],
  };

  if (!analizVerisi) return result;
  const av = analizVerisi;

  // ── Coopetition: hem rakip hem ortak firma tespiti ──
  if (av.rakipler?.length > 0 && av.ortak_girisimler?.length > 0) {
    for (const r of av.rakipler) {
      const rKisa = r.rakip_adi.toLowerCase().split(/\s+/).slice(0, 3).join(' ');
      for (const o of av.ortak_girisimler) {
        const oKisa = o.partner_adi.toLowerCase().split(/\s+/).slice(0, 3).join(' ');
        if (r.rakip_adi.toLowerCase() === o.partner_adi.toLowerCase() || rKisa === oKisa) {
          result.coopetition.push({
            firma: r.rakip_adi.split(/\s+/).slice(0, 4).join(' '),
            rakip_ihale_sayisi: r.ihale_sayisi,
            rakip_sozlesme: r.toplam_sozlesme,
            ortak_sozlesme: o.toplam_sozlesme,
            ortak_devam_eden: o.devam_eden,
            ortak_tamamlanan: o.tamamlanan,
          });
        }
      }
    }
  }

  // ── Rakip isimlerinin ihale metinlerinde geçtiği yerler ──
  if (av.rakipler?.length > 0) {
    try {
      const { rows: ihaleler } = await query(
        `SELECT ihale_basligi, kisim_adi FROM yuklenici_ihaleleri
         WHERE yuklenici_id = $1 AND ihale_basligi IS NOT NULL
         LIMIT 200`,
        [yukleniciId]
      );

      for (let i = 0; i < av.rakipler.length && i < 5; i++) {
        const r = av.rakipler[i];
        const rKisa = r.rakip_adi.toLowerCase().split(/\s+/).slice(0, 2).join(' ');
        const eslesen = ihaleler.filter(
          (ih) => ih.ihale_basligi?.toLowerCase().includes(rKisa)
        );
        if (eslesen.length > 0) {
          result.rakip_ihale_eslesmeler.push({
            rakip: r.rakip_adi.split(/\s+/).slice(0, 4).join(' '),
            ihaleler: eslesen.map((ih) => ih.ihale_basligi).slice(0, 3),
          });
        }
      }
    } catch {
      // Opsiyonel cross-ref
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// Yardımcılar
// ═══════════════════════════════════════════════════════════════

function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}
