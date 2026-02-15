/**
 * Piyasa Fiyat Otomatik Senkronizasyon Scheduler
 * Günde 3 kez (08:00, 13:00, 18:00) çalışarak
 * sistemdeki aktif ürün kartlarının piyasa fiyatlarını günceller.
 *
 * Sadece urun_kartlari'ndaki aktif ürünler işlenir.
 * Öncelik sırası:
 *   1. piyasa_arama_terimi olan ürünler (daha önce başarılı arama yapılmış)
 *   2. piyasa_takip_listesi'ndeki ürünler
 *   3. Diğer aktif ürünler (ad'ı arama terimi olarak kullanılır)
 */

import cron from 'node-cron';
import { KREDI_AYARLARI } from '../config/piyasa-kaynak.js';
import { query } from '../database.js';
import logger from '../utils/logger.js';
import { optimizeAllSearchTerms } from './arama-terimi-optimizer.js';
import { syncHalFiyatlari } from './hal-scraper.js';
import { searchMarketPrices } from './market-scraper.js';
import { detectAndFixPriceAnomalies, savePiyasaFiyatlar } from './piyasa-fiyat-writer.js';
import { isTavilyConfigured, tavilyPiyasaAra, tavilySearch } from './tavily-service.js';

// ─── ARAMA TERİMİ OPTİMİZASYONU ──────────────────────────

/**
 * Ürün adından camgoz.net'te daha iyi sonuç verecek arama terimleri türet.
 *
 * Strateji:
 *  - Marka bilgisi varsa çıkar (camgöz zaten marka bazlı listeliyor)
 *  - Ambalaj bilgisini (25kg, 5lt) çıkar (fiyat sonuçlarında zaten var)
 *  - Çok kısa isimler (1-2 kelime) için kategori ipucu ekle
 *  - Birden fazla terimle arama yap (orijinal + sadeleştirilmiş)
 *
 * @param {string} urunAdi - urun_kartlari.ad değeri
 * @param {string|null} varsayilanBirim - kg, lt, adet vs.
 * @returns {string[]} Aranacak terimler dizisi (max 3)
 */
function optimizeSearchTerms(urunAdi, _varsayilanBirim) {
  if (!urunAdi) return [];

  const original = urunAdi.trim();

  // 1) Ambalaj/birim bilgisini temizle
  const temiz = original
    .replace(/\d+[.,]?\d*\s*(kg|kilo|gr|gram|g|lt|litre|l|ml|cl|adet|ad)\b/gi, '')
    .replace(/[x×]\s*\d+/gi, '')
    .replace(/\d+\s*['']?\s*(lı|li|lu|lü)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 2) Bilinen catering kodlarını / gereksiz ekleri temizle
  const temizKodlar = temiz
    .replace(/\b(yerli|ithal|organik|ekonomik|taze|kuru|dondurulmuş)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const terms = new Set();

  // Orijinal ad her zaman denensin
  if (original.length >= 2) terms.add(original);
  // Temizlenmiş versiyon farklıysa onu da ekle
  if (temiz.length >= 2 && temiz !== original) terms.add(temiz);
  // Kodlar temizlenmiş versiyon da farklıysa
  if (temizKodlar.length >= 2 && temizKodlar !== temiz && temizKodlar !== original) {
    terms.add(temizKodlar);
  }

  // Max 3 terimle sınırla (camgöz'e fazla istek atmayalım)
  return [...terms].slice(0, 3);
}

// ─── AYARLAR ──────────────────────────────────────────────

const CONFIG = {
  // Cron: 08:00, 13:00, 18:00 her gün
  cronExpressions: ['0 8 * * *', '0 13 * * *', '0 18 * * *'],

  // Rate limiting: Camgöz birincil (3s), Tavily AI tamamlayıcı (1s)
  delayBetweenRequests: 2000, // ms (2 saniye - Camgöz rate limit'e uygun)

  // Batch boyutu - tek seferde max kaç ürün işlenir
  maxProductsPerRun: 100,

  // Minimum skor - bu skorun altındaki sonuçlar kaydedilmez
  minRelevanceScore: 40,

  // Sonuç kaydetme limiti - ürün başına max kaç market satırı
  maxResultsPerProduct: 15,

  // Fiyat geçmişi temizleme - kaç günden eski kayıtlar silinir
  historyRetentionDays: 30,

  // Advisory lock ID (sync-scheduler 12345 kullanıyor, biz farklı bir ID)
  lockId: 12346,
};

// ─── SCHEDULER CLASS ──────────────────────────────────────

class PiyasaSyncScheduler {
  constructor() {
    this.jobs = [];
    this.isRunning = false;
    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastRunAt: null,
      lastError: null,
      totalProductsUpdated: 0,
    };
  }

  // ── Lock mekanizması ────────────────────────────────────

  async acquireLock() {
    try {
      const result = await query(`SELECT pg_try_advisory_lock(${CONFIG.lockId}) as acquired`);
      return result.rows[0]?.acquired === true;
    } catch (error) {
      logger.error('[PiyasaSync] Lock alma hatası', { error: error.message });
      return false;
    }
  }

  async releaseLock() {
    try {
      await query(`SELECT pg_advisory_unlock(${CONFIG.lockId})`);
    } catch (error) {
      logger.error('[PiyasaSync] Lock bırakma hatası', { error: error.message });
    }
  }

  // ── Senkronize edilecek ürünleri getir ──────────────────

  async getProductsToSync() {
    try {
      // Sadece urun_kartlari'ndaki aktif ürünler işlenir.
      // Öncelik sırası:
      //   1. Daha önce piyasa araştırması yapılmış olanlar (piyasa_fiyat_gecmisi kaydı var)
      //   2. Takip listesindeki ürünler
      //   3. Geri kalan aktif ürünler
      // En uzun süredir güncellenmeyenler önce gelir.
      //
      // urun_kartlari tablosu üzerinden çalışıyoruz.
      const result = await query(
        `
        SELECT 
          uk.id,
          uk.ad,
          uk.varsayilan_birim,
          uk.stok_kart_id,
          COALESCE(uk.piyasa_arama_terimi, uk.ad) as arama_terimi,
          pfg.son_arastirma
        FROM urun_kartlari uk
        LEFT JOIN LATERAL (
          SELECT MAX(arastirma_tarihi) as son_arastirma
          FROM piyasa_fiyat_gecmisi p
          WHERE p.urun_kart_id = uk.id
        ) pfg ON true
        WHERE uk.aktif = true
          AND uk.piyasa_arama_terimi IS NOT NULL
        ORDER BY 
          pfg.son_arastirma ASC NULLS FIRST
        LIMIT $1
      `,
        [CONFIG.maxProductsPerRun]
      );

      return result.rows;
    } catch (error) {
      logger.error('[PiyasaSync] Ürün listesi alınamadı', { error: error.message });
      return [];
    }
  }

  // ── Tek bir ürün için piyasa fiyatı araştır ve kaydet ───

  async syncSingleProduct(product) {
    const { id: urunKartId, ad, arama_terimi, varsayilan_birim, stok_kart_id } = product;

    try {
      // Cache TTL kontrolü: son araştırma çok yakınsa atla
      const cacheCheck = await query(
        `SELECT MAX(arastirma_tarihi) as son FROM piyasa_fiyat_gecmisi WHERE urun_kart_id = $1`,
        [urunKartId]
      ).catch(() => ({ rows: [] }));

      if (cacheCheck.rows[0]?.son) {
        const sonArastirma = new Date(cacheCheck.rows[0].son);
        const saatFark = (Date.now() - sonArastirma.getTime()) / (1000 * 60 * 60);
        if (saatFark < KREDI_AYARLARI.cacheTtlSaat) {
          return { success: true, urun: ad, reason: 'cache_valid', kayitSayisi: 0, saatFark: Math.round(saatFark) };
        }
      }

      // Akıllı arama terimleri türet
      const searchTerms = optimizeSearchTerms(arama_terimi, varsayilan_birim);
      if (searchTerms.length === 0) {
        return { success: false, urun: ad, reason: 'no_search_term' };
      }

      const targetUnit = varsayilan_birim === 'lt' ? 'L' : varsayilan_birim === 'kg' ? 'kg' : null;
      let result = { success: false, fiyatlar: [] };
      let kaynakTip = 'unknown';

      // ── Katman 1: CAMGÖZ (BİRİNCİL — yapısal veri, güvenilir) ──
      try {
        const camgoz = await searchMarketPrices(searchTerms, { targetUnit });
        if (camgoz.success && camgoz.fiyatlar?.length > 0) {
          result = camgoz;
          kaynakTip = 'market';
        }
      } catch (camgozErr) {
        logger.warn('[PiyasaSync] Camgöz hatası', { urun: ad, error: camgozErr.message });
      }

      // ── Katman 2: Tavily AI Answer (TAMAMLAYICI) ──
      // Camgöz varsa → sadece AI answer, yoksa → full arama
      if (isTavilyConfigured()) {
        const camgozVar = result.success && result.fiyatlar?.length > 0;
        const tavilyMode = camgozVar ? 'ai_only' : 'full';

        try {
          const searchName = searchTerms[0];
          const tavilyResult = await tavilyPiyasaAra(searchName, { targetUnit, mode: tavilyMode });

          if (tavilyResult.success && tavilyResult.fiyatlar?.length > 0) {
            if (camgozVar) {
              // Camgöz var → Tavily AI fiyatlarını UYUM FİLTRESİ ile ekle
              const camgozPrices = result.fiyatlar.map((f) => f.birimFiyat || f.fiyat).filter((p) => p > 0);
              const camgozOrt =
                camgozPrices.length > 0 ? camgozPrices.reduce((s, p) => s + p, 0) / camgozPrices.length : 0;

              const existing = new Set(result.fiyatlar.map((f) => `${f.market}-${Math.round(f.fiyat)}`));
              const extra = tavilyResult.fiyatlar.filter((f) => {
                if (existing.has(`${f.market}-${Math.round(f.fiyat)}`)) return false;
                if (camgozOrt > 0) {
                  const aiFiyat = f.birimFiyat || f.fiyat;
                  const sapma = Math.abs(aiFiyat - camgozOrt) / camgozOrt;
                  if (sapma > 0.6) return false; // %60'tan fazla sapma → ekleme
                }
                return true;
              });
              if (extra.length > 0) {
                result.fiyatlar = [...result.fiyatlar, ...extra];
                kaynakTip = 'market+tavily_ai';
              }
            } else {
              // Camgöz boştu → Tavily full birincil
              result = tavilyResult;
              kaynakTip = 'tavily_referans';
            }
          }
        } catch (tavilyErr) {
          logger.warn('[PiyasaSync] Tavily hatası', { urun: ad, error: tavilyErr.message });
        }
      }

      if (!result.success || !result.fiyatlar || result.fiyatlar.length === 0) {
        return { success: false, urun: ad, reason: 'no_results' };
      }

      // Eski kayıtları temizle (retention period)
      await query(
        `DELETE FROM piyasa_fiyat_gecmisi 
         WHERE urun_kart_id = $1 
           AND arastirma_tarihi < NOW() - INTERVAL '${CONFIG.historyRetentionDays} days'`,
        [urunKartId]
      ).catch((err) => logger.warn('[PiyasaSync] Islem hatasi', { error: err.message }));

      // ── Merkezi yazım servisi ile kaydet ──
      const dominantBirim = targetUnit || result.birim || null;
      const { savedCount, skippedCount } = await savePiyasaFiyatlar({
        urunKartId,
        stokKartId: stok_kart_id,
        urunAdi: ad,
        fiyatlar: result.fiyatlar,
        kaynakTip,
        dominantBirim,
        aramaTermi: arama_terimi,
        maxKayit: CONFIG.maxResultsPerProduct,
      });

      if (skippedCount > 0) {
        logger.info('[PiyasaSync] Anomali fiyatlar filtrelendi', { urun: ad, skippedCount });
      }

      // Piyasa takip listesini güncelle (varsa)
      if (result.ortalama > 0 && stok_kart_id) {
        await query(
          `
          UPDATE piyasa_takip_listesi 
          SET son_piyasa_fiyat = $1,
              updated_at = NOW()
          WHERE stok_kart_id = $2
        `,
          [result.ortalama, stok_kart_id]
        ).catch((err) => logger.warn('[PiyasaSync] Islem hatasi', { error: err.message }));

        // urun_kartlari'ndaki son_piyasa_fiyat'ı da güncelle
        if (urunKartId) {
          await query(
            `
            UPDATE urun_kartlari 
            SET son_piyasa_fiyat = $1, updated_at = NOW()
            WHERE id = $2
          `,
            [result.ortalama, urunKartId]
          ).catch((err) => logger.warn('[PiyasaSync] Islem hatasi', { error: err.message }));
        }
      }

      return {
        success: true,
        urun: ad,
        kayitSayisi: savedCount,
        ortalama: result.ortalama,
        min: result.min,
        max: result.max,
        toplamSonuc: result.toplam_sonuc,
        kaynak: kaynakTip,
      };
    } catch (error) {
      logger.error('[PiyasaSync] Ürün sync hatası', { urun: ad, error: error.message });
      return { success: false, urun: ad, reason: 'error', error: error.message };
    }
  }

  // ── Ana sync fonksiyonu ─────────────────────────────────

  async runSync(_options = {}) {
    if (this.isRunning) {
      logger.info('[PiyasaSync] Zaten çalışıyor, atlanıyor');
      return { success: false, message: 'already_running' };
    }

    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      logger.info('[PiyasaSync] DB lock alınamadı, atlanıyor');
      return { success: false, message: 'lock_not_acquired' };
    }

    this.isRunning = true;
    const startTime = Date.now();
    this.stats.totalRuns++;

    logger.info('[PiyasaSync] ▶ Piyasa fiyat senkronizasyonu başlıyor...');

    try {
      // Senkronize edilecek ürünleri getir
      const products = await this.getProductsToSync();

      if (products.length === 0) {
        logger.info('[PiyasaSync] Senkronize edilecek ürün yok');
        this.stats.successfulRuns++;
        return { success: true, message: 'no_products', productsProcessed: 0 };
      }

      logger.info(`[PiyasaSync] ${products.length} ürün işlenecek`);

      const results = {
        processed: 0,
        successful: 0,
        failed: 0,
        noResults: 0,
        details: [],
      };

      // Ürünleri sırayla işle (rate limiting)
      for (const product of products) {
        const result = await this.syncSingleProduct(product);
        results.processed++;

        if (result.success) {
          results.successful++;
        } else if (result.reason === 'no_results') {
          results.noResults++;
        } else {
          results.failed++;
        }

        results.details.push(result);

        // Rate limiting: sonraki istek öncesi bekle
        if (results.processed < products.length) {
          await new Promise((r) => setTimeout(r, CONFIG.delayBetweenRequests));
        }

        // Her 10 üründe bir progress log
        if (results.processed % 10 === 0) {
          logger.info(
            `[PiyasaSync] İlerleme: ${results.processed}/${products.length} (✓${results.successful} ✗${results.failed} ○${results.noResults})`
          );
        }
      }

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      this.stats.successfulRuns++;
      this.stats.lastRunAt = new Date();
      this.stats.totalProductsUpdated += results.successful;

      // Sonuç logu
      logger.info(`[PiyasaSync] ✅ Tamamlandı (${elapsed}s)`, {
        processed: results.processed,
        successful: results.successful,
        failed: results.failed,
        noResults: results.noResults,
      });

      // Fatura anomali tespiti (piyasa > 3x fatura farkı olanları düzelt)
      const anomaliSonuc = await detectAndFixPriceAnomalies().catch(() => ({ duzeltilen: 0 }));
      if (anomaliSonuc.duzeltilen > 0) {
        logger.info(`[PiyasaSync] ${anomaliSonuc.duzeltilen} fatura anomalisi düzeltildi`);
      }

      // Sync log kaydet
      await this.logSync('success', {
        duration: elapsed,
        ...results,
        anomaliDuzeltilen: anomaliSonuc.duzeltilen,
      });

      return { success: true, ...results, elapsed, anomaliDuzeltilen: anomaliSonuc.duzeltilen };
    } catch (error) {
      this.stats.failedRuns++;
      this.stats.lastError = error.message;
      logger.error('[PiyasaSync] ❌ Senkronizasyon hatası', { error: error.message });

      await this.logSync('error', { error: error.message });

      return { success: false, error: error.message };
    } finally {
      this.isRunning = false;
      await this.releaseLock();
    }
  }

  // ── Log kaydet ──────────────────────────────────────────

  async logSync(status, details) {
    try {
      await query(
        `
        INSERT INTO sync_logs (sync_type, status, started_at, finished_at, details)
        VALUES ($1, $2, $3, $4, $5)
      `,
        [
          'piyasa_sync',
          status,
          new Date(Date.now() - (details.duration || 0) * 1000),
          new Date(),
          JSON.stringify(details),
        ]
      );
    } catch (error) {
      logger.error('[PiyasaSync] Log kayıt hatası', { error: error.message });
    }
  }

  // ── Hal.gov.tr günlük sync ──────────────────────────────

  async runHalSync() {
    logger.info('[PiyasaSync] Hal.gov.tr senkronizasyonu başlıyor...');
    try {
      const result = await syncHalFiyatlari();
      if (result.success) {
        logger.info(`[PiyasaSync] Hal.gov.tr sync tamamlandı: ${result.toplam} ürün, tarih: ${result.bultenTarihi}`);
      } else {
        logger.warn(`[PiyasaSync] Hal.gov.tr sync başarısız: ${result.error}`);
      }

      // Sync log kaydet
      await this.logSync(result.success ? 'success' : 'error', {
        type: 'hal_sync',
        ...result,
      }).catch((err) => logger.warn('[PiyasaSync] Islem hatasi', { error: err.message }));

      return result;
    } catch (error) {
      logger.error(`[PiyasaSync] Hal.gov.tr sync hatası: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ── Mevzuat & İhale değişiklik takibi ──────────────────

  async runMevzuatTakip() {
    if (!isTavilyConfigured()) {
      logger.warn('[PiyasaSync] Mevzuat takip: TAVILY_API_KEY ayarlanmamış, atlanıyor');
      return { success: false, error: 'TAVILY_API_KEY yok' };
    }

    logger.info('[PiyasaSync] Mevzuat & ihale değişiklik takibi başlıyor...');

    const konular = [
      {
        id: 'gida_mevzuat',
        sorgu: 'gıda mevzuatı değişiklik tebliğ yönetmelik 2026',
        domainler: ['mevzuat.gov.tr', 'resmigazete.gov.tr', 'tarimorman.gov.tr'],
      },
      {
        id: 'kik_ihale',
        sorgu: 'kamu ihale kurumu yemek hizmeti catering ihale duyurusu 2026',
        domainler: ['kik.gov.tr', 'ekap.kik.gov.tr', 'ihale.gov.tr'],
      },
      {
        id: 'sgk_degisiklik',
        sorgu: 'SGK prim oranı değişiklik asgari ücret güncelleme 2026',
        domainler: ['sgk.gov.tr', 'resmigazete.gov.tr'],
      },
      {
        id: 'gida_fiyat_trend',
        sorgu: 'gıda fiyatları enflasyon artış catering maliyet 2026',
        domainler: [],
      },
    ];

    const sonuclar = [];

    for (const konu of konular) {
      try {
        const result = await tavilySearch(konu.sorgu, {
          searchDepth: 'basic',
          maxResults: 5,
          includeAnswer: true,
          includeDomains: konu.domainler.length > 0 ? konu.domainler : undefined,
          days: 7, // Son 1 hafta
        });

        if (result.success && result.results?.length > 0) {
          sonuclar.push({
            konu: konu.id,
            ozet: result.answer,
            sonuc_sayisi: result.results.length,
            kaynaklar: result.results.map((r) => ({
              baslik: r.title,
              url: r.url,
              tarih: r.publishedDate,
            })),
          });

          logger.info(`[Mevzuat] ${konu.id}: ${result.results.length} sonuç bulundu`);
        } else {
          logger.info(`[Mevzuat] ${konu.id}: Yeni değişiklik yok`);
        }

        // Rate limit: istekler arası 1sn bekle
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        logger.warn(`[Mevzuat] ${konu.id} hatası: ${err.message}`);
      }
    }

    // Sonuçları DB'ye kaydet (varsa)
    if (sonuclar.length > 0) {
      try {
        await query(
          `INSERT INTO sync_logs (sync_type, status, started_at, finished_at, details)
           VALUES ($1, $2, NOW() - INTERVAL '1 minute', NOW(), $3)`,
          ['mevzuat_takip', 'success', JSON.stringify({ konular: sonuclar })]
        );
      } catch (logErr) {
        logger.warn(`[Mevzuat] Log kayıt hatası: ${logErr.message}`);
      }
    }

    logger.info(`[PiyasaSync] Mevzuat takip tamamlandı: ${sonuclar.length}/${konular.length} konuda sonuç`);

    return {
      success: true,
      tapilanKonu: sonuclar.length,
      toplamKonu: konular.length,
      sonuclar,
    };
  }

  // ── Scheduler başlat / durdur ───────────────────────────

  start() {
    if (this.jobs.length > 0) {
      logger.warn('[PiyasaSync] Scheduler zaten çalışıyor');
      return;
    }

    // Camgöz market fiyat sync: günde 3x (08:00, 13:00, 18:00)
    for (const expr of CONFIG.cronExpressions) {
      const job = cron.schedule(
        expr,
        () => {
          logger.info(`[PiyasaSync] Cron tetiklendi: ${expr}`);
          this.runSync({ trigger: 'cron' });
        },
        {
          timezone: 'Europe/Istanbul',
        }
      );
      this.jobs.push(job);
    }

    // Hal.gov.tr toptancı hal fiyat sync: günde 1x (09:00)
    const halJob = cron.schedule(
      '0 9 * * *',
      () => {
        logger.info('[PiyasaSync] Hal.gov.tr cron tetiklendi (09:00)');
        this.runHalSync();
      },
      {
        timezone: 'Europe/Istanbul',
      }
    );
    this.jobs.push(halJob);

    // Mevzuat & İhale değişiklik takibi: Haftalık Pazartesi 10:00 (legacy)
    const mevzuatJob = cron.schedule(
      '0 10 * * 1',
      () => {
        logger.info('[PiyasaSync] Mevzuat takip cron tetiklendi (Pazartesi 10:00)');
        this.runMevzuatTakip();
      },
      {
        timezone: 'Europe/Istanbul',
      }
    );
    this.jobs.push(mevzuatJob);

    // ── Sektör Gündem Aggregator Cron Jobs ──────────────
    // İhale gündem: günde 3 kez (08:30, 13:30, 18:30)
    for (const expr of ['30 8 * * *', '30 13 * * *', '30 18 * * *']) {
      const ihaleJob = cron.schedule(
        expr,
        async () => {
          logger.info(`[SektorGundem] İhale gündem cron tetiklendi: ${expr}`);
          try {
            const { fetchIhaleGundem, writeCache } = await import('./sektor-gundem-aggregator.js');
            const konular = await fetchIhaleGundem();
            await writeCache('sektor_gundem_ihale', { konular });
            logger.info(`[SektorGundem] İhale gündem cache güncellendi: ${konular.length} kategori`);
          } catch (err) {
            logger.error(`[SektorGundem] İhale gündem cron hatası: ${err.message}`);
          }
        },
        { timezone: 'Europe/Istanbul' }
      );
      this.jobs.push(ihaleJob);
    }

    // İstihbarat gündem: günde 2 kez (09:30, 15:30)
    for (const expr of ['30 9 * * *', '30 15 * * *']) {
      const istJob = cron.schedule(
        expr,
        async () => {
          logger.info(`[SektorGundem] İstihbarat gündem cron tetiklendi: ${expr}`);
          try {
            const { fetchIstihbaratGundem, writeCache } = await import('./sektor-gundem-aggregator.js');
            const konular = await fetchIstihbaratGundem();
            await writeCache('sektor_gundem_istihbarat', { konular });
            logger.info(`[SektorGundem] İstihbarat gündem cache güncellendi: ${konular.length} kategori`);
          } catch (err) {
            logger.error(`[SektorGundem] İstihbarat gündem cron hatası: ${err.message}`);
          }
        },
        { timezone: 'Europe/Istanbul' }
      );
      this.jobs.push(istJob);
    }

    // Arama terimi optimizasyonu: Pazar gecesi 03:00 (haftalık)
    // Düşük confidence'lı ürünlerin arama terimlerini yeniden optimize eder
    const termOptJob = cron.schedule(
      '0 3 * * 0',
      async () => {
        logger.info('[PiyasaSync] Arama terimi optimizasyonu başlıyor (haftalık)...');
        try {
          const result = await optimizeAllSearchTerms({ limit: 30 });
          logger.info(
            `[PiyasaSync] Terim optimizasyonu tamamlandı: ${result.guncellemeSayisi}/${result.islemSayisi} güncellendi`
          );
        } catch (err) {
          logger.error(`[PiyasaSync] Terim optimizasyonu hatası: ${err.message}`);
        }
      },
      { timezone: 'Europe/Istanbul' }
    );
    this.jobs.push(termOptJob);

    logger.info(
      `[PiyasaSync] Scheduler başlatıldı (Camgöz: 08:00/13:00/18:00, Hal: 09:00, Mevzuat: Pzt 10:00, Terim-Opt: Pzr 03:00)`
    );
  }

  stop() {
    for (const job of this.jobs) {
      job.stop();
    }
    this.jobs = [];
    logger.info('[PiyasaSync] Scheduler durduruldu');
  }

  // ── Durum bilgisi ───────────────────────────────────────

  getStatus() {
    return {
      isRunning: this.isRunning,
      stats: { ...this.stats },
      config: {
        schedules: CONFIG.cronExpressions,
        maxProductsPerRun: CONFIG.maxProductsPerRun,
        delayBetweenRequests: CONFIG.delayBetweenRequests,
      },
    };
  }
}

// ─── SINGLETON EXPORT ─────────────────────────────────────

const piyasaSyncScheduler = new PiyasaSyncScheduler();
export default piyasaSyncScheduler;
