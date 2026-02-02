/**
 * Daily Audit Service v2 - Optimized
 * =====================================
 * Performans iyileştirmeleri:
 * 1. Bulk INSERT (N+1 → 1 sorgu)
 * 2. Akıllı AI önceliklendirme (sadece kritik adaylara)
 * 3. Rule-based önem seviyesi (AI olmadan)
 * 4. Progress tracking (DB + memory)
 * 5. Exponential backoff (rate limit koruması)
 * 6. Streaming batch flush (memory optimizasyonu)
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../database.js';
import logger from '../utils/logger.js';
import { hesaplaAktifFiyat } from './fiyat-motor.js';

// Claude API client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// YAPILANDIRMA
// ============================================================================

const CONFIG = {
  // Bulk INSERT ayarları
  BULK_INSERT_SIZE: 100, // Tek sorguda max INSERT sayısı

  // AI ayarları
  AI_BATCH_SIZE: 15, // AI'a gönderilecek bulgu sayısı/batch
  AI_TIMEOUT_MS: 120_000, // Batch başına timeout (2 dakika)
  AI_MAX_RETRIES: 2, // Başarısız batch için retry sayısı
  AI_RETRY_DELAY_MS: 2000, // İlk retry gecikmesi (exponential)
  AI_MAX_FINDINGS_FOR_ANALYSIS: 80, // Max AI analizi yapılacak bulgu sayısı

  // Kategori başına limitler (aşırı bulgu önleme)
  MAX_FINDINGS_PER_CATEGORY: 150,

  // Rule-based önem eşikleri
  IMPORTANCE_THRESHOLDS: {
    // Kritik: Veri kaybı veya yanlış maliyet riski
    KRITIK: {
      fiyat_anomali_yuzde: 50, // %50+ fiyat değişimi
      kategori_sapma_yuzde: 150, // %150+ kategori sapması
      fiyatsiz_kritik_kategori: ['et', 'sut', 'yag'], // Kritik kategoriler
    },
    // Orta: Performans veya tutarlılık sorunları
    ORTA: {
      fiyat_anomali_yuzde: 30,
      kategori_sapma_yuzde: 100,
      eski_fiyat_gun: 45,
    },
  },

  // Progress güncelleme sıklığı
  PROGRESS_UPDATE_INTERVAL: 10, // Her 10 bulguda bir progress güncelle
};

// ============================================================================
// RULE-BASED ÖNEM SEVİYESİ BELİRLEME
// ============================================================================

/**
 * Bulgunun önem seviyesini rule-based belirle (AI olmadan)
 * @param {Object} finding - Bulgu objesi
 * @returns {string} - 'kritik' | 'orta' | 'dusuk'
 */
function determineImportanceLevel(finding) {
  const { sorun_tipi, detay = {} } = finding;
  const thresholds = CONFIG.IMPORTANCE_THRESHOLDS;

  // ---- KRİTİK Koşullar ----

  // 1. Fiyat anomalisi yüksek
  if (sorun_tipi === 'fiyat_anomali' && detay.degisim_yuzde >= thresholds.KRITIK.fiyat_anomali_yuzde) {
    return 'kritik';
  }

  // 2. Kategori sapması çok yüksek
  if (sorun_tipi === 'kategori_sapma' && detay.sapma_yuzde >= thresholds.KRITIK.kategori_sapma_yuzde) {
    return 'kritik';
  }

  // 3. Kritik kategoride fiyatsız ürün
  if (sorun_tipi === 'fiyatsiz_urun') {
    const kategori = (detay.kategori || '').toLowerCase();
    if (thresholds.KRITIK.fiyatsiz_kritik_kategori.some((k) => kategori.includes(k))) {
      return 'kritik';
    }
  }

  // 4. Anormal gramaj (çok düşük veya çok yüksek)
  if (sorun_tipi === 'anormal_gramaj') {
    const gramaj = detay.porsiyon_gramaj || 0;
    if (gramaj < 30 || gramaj > 3000) {
      return 'kritik';
    }
  }

  // 5. Sözleşme süresi dolmuş (60+ gün önce)
  if (sorun_tipi === 'sozlesme_suresi_dolmus') {
    const bitisTarihi = new Date(detay.bitis_tarihi);
    const gunFarki = (Date.now() - bitisTarihi.getTime()) / (1000 * 60 * 60 * 24);
    if (gunFarki > 60) {
      return 'kritik';
    }
  }

  // ---- ORTA Koşullar ----

  // 1. Orta seviye fiyat anomalisi
  if (sorun_tipi === 'fiyat_anomali' && detay.degisim_yuzde >= thresholds.ORTA.fiyat_anomali_yuzde) {
    return 'orta';
  }

  // 2. Orta seviye kategori sapması
  if (sorun_tipi === 'kategori_sapma' && detay.sapma_yuzde >= thresholds.ORTA.kategori_sapma_yuzde) {
    return 'orta';
  }

  // 3. Eski fiyat (45+ gün)
  if (sorun_tipi === 'eski_fiyat' && detay.gun_farki >= thresholds.ORTA.eski_fiyat_gun) {
    return 'orta';
  }

  // 4. Maliyet hesaplanmamış reçete (malzeme sayısı önemli)
  if (sorun_tipi === 'maliyet_hesaplanmamis' || sorun_tipi === 'eksik_malzeme_fiyat') {
    return 'orta';
  }

  // 5. Menü sorunları genellikle orta
  if (finding.kategori === 'menu') {
    if (sorun_tipi === 'maliyet_asimi') return 'orta';
    if (sorun_tipi === 'eksik_ogun') return 'orta';
  }

  // 6. Düşük güvenli AI tahmini
  if (sorun_tipi === 'dusuk_guven_ai') {
    return 'orta';
  }

  // ---- DÜŞÜK (varsayılan) ----
  return 'dusuk';
}

/**
 * Bulgunun AI analizi için uygun olup olmadığını belirle
 * @param {Object} finding - Bulgu objesi
 * @returns {boolean}
 */
function shouldAnalyzeWithAI(finding) {
  const importance = finding.onem_seviyesi || determineImportanceLevel(finding);

  // Kritik bulgular her zaman AI analizi alır
  if (importance === 'kritik') return true;

  // Bazı orta seviye bulgular da AI analizi alır
  if (importance === 'orta') {
    // Karmaşık sorun tipleri
    const complexTypes = ['anormal_maliyet', 'fiyat_anomali', 'kategori_sapma', 'maliyet_asimi'];
    if (complexTypes.includes(finding.sorun_tipi)) return true;
  }

  return false;
}

// ============================================================================
// AI ANALİZ PROMPT
// ============================================================================

const DENETIM_PROMPT = `Sen bir catering iş yönetim yazılımının kalite kontrol uzmanısın.
Aşağıdaki denetim bulgularını analiz et ve her sorun için kısa, öz değerlendirme yap.

HER BULGU İÇİN (JSON):
{
  "temp_id": <bulgu_temp_id>,
  "kok_neden": "Sorunun muhtemel kaynağı (1 cümle)",
  "onerilen_duzeltme": {
    "action": "eylem_kodu",
    "params": {...}
  },
  "otomatik_uygun": true|false,
  "etki": "Düzeltilmezse ne olur (1 cümle)"
}

OTOMATİK DÜZELTME UYGUN OLAN EYLEMLER:
- recete_maliyet_hesapla: Reçete maliyeti yeniden hesapla
- ai_fiyat_tahmini: Fiyatsız ürüne AI tahmini ata
- urun_eslestir: Malzemeyi ürün kartına eşle
- birim_donusum: Birim tutarsızlığını düzelt

MANUEL ONAY GEREKLİ:
- Fiyat değişiklikleri
- Menü değişiklikleri
- Reçete silme/değiştirme
- Tedarikçi değişiklikleri

JSON formatında yanıt ver:
{
  "findings": [...],
  "genel_degerlendirme": "2-3 cümle genel durum",
  "oncelikli_aksiyonlar": ["aksiyon1", "aksiyon2"]
}`;

// ============================================================================
// ANA SERVİS SINIFI
// ============================================================================

class DailyAuditServiceV2 {
  constructor() {
    this.currentRunId = null;
    this.findingsBuffer = []; // Bellekte biriken bulgular
    this.stats = {
      recete: 0,
      menu: 0,
      fiyat: 0,
      otomatik: 0,
      manuel: 0,
      aiAnalyzed: 0,
      ruleBasedAnalyzed: 0,
    };
    this.progress = {
      phase: 'idle',
      current: 0,
      total: 0,
      message: '',
    };
    this._migrationChecked = false;
  }

  /**
   * Gerekli kolonların varlığını kontrol et ve yoksa ekle
   */
  async ensureMigration() {
    if (this._migrationChecked) return;

    try {
      // progress_json kolonunu kontrol et
      const checkResult = await query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'daily_audit_runs' AND column_name = 'progress_json'
      `);

      if (checkResult.rows.length === 0) {
        logger.info('[AuditV2] progress_json kolonu ekleniyor...');
        await query(`ALTER TABLE daily_audit_runs ADD COLUMN IF NOT EXISTS progress_json JSONB DEFAULT '{}'`);
        logger.info('[AuditV2] progress_json kolonu eklendi');
      }

      // İndeks kontrolleri
      await query(
        `CREATE INDEX IF NOT EXISTS idx_audit_findings_run_status ON daily_audit_findings(audit_run_id, durum)`
      );
      await query(
        `CREATE INDEX IF NOT EXISTS idx_audit_findings_cat_imp ON daily_audit_findings(kategori, onem_seviyesi)`
      );

      this._migrationChecked = true;
    } catch (error) {
      logger.warn('[AuditV2] Migration kontrolü hatası (devam ediliyor)', { error: error.message });
      this._migrationChecked = true; // Hata olsa da tekrar deneme
    }
  }

  // ==========================================================================
  // PROGRESS TRACKING
  // ==========================================================================

  async updateProgress(phase, current, total, message = '') {
    this.progress = { phase, current, total, message };

    // Her N bulguda bir DB'ye kaydet
    if (current % CONFIG.PROGRESS_UPDATE_INTERVAL === 0 || current === total) {
      try {
        await query(
          `
          UPDATE daily_audit_runs 
          SET progress_json = $1
          WHERE id = $2
        `,
          [JSON.stringify(this.progress), this.currentRunId]
        );
      } catch (e) {
        // Progress update hatası kritik değil, devam et
        logger.warn('[AuditV2] Progress update hatası', { error: e.message });
      }
    }
  }

  // ==========================================================================
  // BULK INSERT
  // ==========================================================================

  /**
   * Bulguları toplu olarak veritabanına kaydet
   * @param {Array} findings - Bulgu dizisi
   */
  async bulkInsertFindings(findings) {
    if (!findings || findings.length === 0) return;

    const batchSize = CONFIG.BULK_INSERT_SIZE;
    const batches = [];

    for (let i = 0; i < findings.length; i += batchSize) {
      batches.push(findings.slice(i, i + batchSize));
    }

    logger.info('[AuditV2] Bulk INSERT başlıyor', {
      toplamBulgu: findings.length,
      batchSayisi: batches.length,
    });

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];

      // Dinamik VALUES oluştur
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const f of batch) {
        values.push(`(
          $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++},
          $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++},
          $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++},
          $${paramIdx++}, $${paramIdx++}
        )`);

        params.push(
          this.currentRunId,
          f.kategori,
          f.sorun_tipi,
          f.onem_seviyesi || 'orta',
          f.ilgili_tablo,
          f.ilgili_id,
          f.ilgili_kod || null,
          f.ilgili_ad || null,
          f.aciklama,
          JSON.stringify(f.detay || {}),
          f.ai_analizi || null,
          f.ai_kok_neden || null,
          JSON.stringify(f.onerilen_duzeltme || {}),
          f.otomatik_uygun || false
        );
      }

      const sql = `
        INSERT INTO daily_audit_findings (
          audit_run_id, kategori, sorun_tipi, onem_seviyesi,
          ilgili_tablo, ilgili_id, ilgili_kod, ilgili_ad,
          aciklama, detay_json, ai_analizi, ai_kok_neden,
          onerilen_duzeltme_json, otomatik_duzeltme_uygun
        ) VALUES ${values.join(', ')}
      `;

      try {
        await query(sql, params);
        logger.debug('[AuditV2] Batch INSERT tamamlandı', {
          batch: batchIdx + 1,
          kayit: batch.length,
        });
      } catch (error) {
        logger.error('[AuditV2] Bulk INSERT hatası', {
          batch: batchIdx + 1,
          error: error.message,
        });
        throw error;
      }
    }

    logger.info('[AuditV2] Bulk INSERT tamamlandı', { toplam: findings.length });
  }

  /**
   * Buffer'daki bulguları DB'ye flush et
   */
  async flushFindingsBuffer() {
    if (this.findingsBuffer.length === 0) return;

    await this.bulkInsertFindings(this.findingsBuffer);
    this.findingsBuffer = [];
  }

  /**
   * Bulgu ekle (buffer'a)
   */
  addFinding(finding) {
    // Rule-based önem seviyesi belirle
    if (!finding.onem_seviyesi) {
      finding.onem_seviyesi = determineImportanceLevel(finding);
    }

    // AI analizi gerekip gerekmediğini işaretle
    finding._needsAI = shouldAnalyzeWithAI(finding);

    this.findingsBuffer.push(finding);

    // Kategori sayacını güncelle
    if (finding.kategori === 'recete') this.stats.recete++;
    else if (finding.kategori === 'menu') this.stats.menu++;
    else if (finding.kategori === 'fiyat') this.stats.fiyat++;
  }

  // ==========================================================================
  // AKıLLı AI ANALİZİ
  // ==========================================================================

  /**
   * Sadece seçili bulgulara AI analizi uygula
   * @param {Array} findings - Tüm bulgular
   */
  async runSmartAIAnalysis(findings) {
    // AI analizi gerekenleri filtrele
    const aiCandidates = findings.filter((f) => f._needsAI);

    // Max limit uygula
    const toAnalyze = aiCandidates.slice(0, CONFIG.AI_MAX_FINDINGS_FOR_ANALYSIS);

    logger.info('[AuditV2] Smart AI Analizi başlıyor', {
      toplamBulgu: findings.length,
      aiAday: aiCandidates.length,
      analizEdilecek: toAnalyze.length,
    });

    if (toAnalyze.length === 0) {
      logger.info('[AuditV2] AI analizi gerekli bulgu yok');
      this.stats.ruleBasedAnalyzed = findings.length;
      return;
    }

    // Batch'lere böl
    const batches = [];
    for (let i = 0; i < toAnalyze.length; i += CONFIG.AI_BATCH_SIZE) {
      batches.push(toAnalyze.slice(i, i + CONFIG.AI_BATCH_SIZE));
    }

    let genelDegerlendirme = '';
    const oncelikliAksiyonlar = [];
    let basariliBatch = 0;
    let hataliBatch = 0;

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];

      await this.updateProgress(
        'ai_analysis',
        batchIdx + 1,
        batches.length,
        `AI analizi: Batch ${batchIdx + 1}/${batches.length}`
      );

      // Özet veri hazırla (token tasarrufu)
      const bulgularOzet = batch.map((f, _i) => {
        const globalIdx = findings.indexOf(f);
        return {
          temp_id: globalIdx,
          kategori: f.kategori,
          sorun_tipi: f.sorun_tipi,
          onem: f.onem_seviyesi,
          aciklama: f.aciklama.substring(0, 200), // Kısalt
          detay: f.detay,
        };
      });

      const userContent = `${batch.length} adet kritik/orta öncelikli bulgu:\n\n${JSON.stringify(bulgularOzet, null, 2)}`;

      // Retry mekanizması ile API çağrısı
      const result = await this.callAIWithRetry(userContent, batchIdx, batches.length);

      if (result.success) {
        // AI sonuçlarını bulgulara uygula
        for (const aiF of result.data.findings || []) {
          const finding = findings[aiF.temp_id];
          if (finding) {
            finding.ai_analizi = aiF.etki;
            finding.ai_kok_neden = aiF.kok_neden;
            if (aiF.onerilen_duzeltme) finding.onerilen_duzeltme = aiF.onerilen_duzeltme;
            if (typeof aiF.otomatik_uygun === 'boolean') finding.otomatik_uygun = aiF.otomatik_uygun;
            this.stats.aiAnalyzed++;
          }
        }

        if (batchIdx === 0 && result.data.genel_degerlendirme) {
          genelDegerlendirme = result.data.genel_degerlendirme;
        }
        if (result.data.oncelikli_aksiyonlar) {
          oncelikliAksiyonlar.push(...result.data.oncelikli_aksiyonlar);
        }

        basariliBatch++;
      } else {
        hataliBatch++;
      }

      // Rate limit koruması: batch arası bekleme
      if (batchIdx < batches.length - 1) {
        await this.sleep(1000);
      }
    }

    // Genel değerlendirmeyi kaydet
    if (genelDegerlendirme || oncelikliAksiyonlar.length > 0) {
      await query(
        `
        UPDATE daily_audit_runs 
        SET ai_genel_degerlendirme = $1, ai_oncelikli_aksiyonlar = $2
        WHERE id = $3
      `,
        [genelDegerlendirme, JSON.stringify(oncelikliAksiyonlar.slice(0, 10)), this.currentRunId]
      );
    }

    this.stats.ruleBasedAnalyzed = findings.length - this.stats.aiAnalyzed;

    logger.info('[AuditV2] AI analizi tamamlandı', {
      basariliBatch,
      hataliBatch,
      aiAnalyzed: this.stats.aiAnalyzed,
      ruleBasedAnalyzed: this.stats.ruleBasedAnalyzed,
    });
  }

  /**
   * AI API çağrısı (retry mekanizması ile)
   */
  async callAIWithRetry(userContent, batchIdx, totalBatches) {
    let lastError = null;

    for (let attempt = 0; attempt <= CONFIG.AI_MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = CONFIG.AI_RETRY_DELAY_MS * 2 ** (attempt - 1);
        logger.info('[AuditV2] AI retry beklemesi', { attempt, delay });
        await this.sleep(delay);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.AI_TIMEOUT_MS);

      try {
        const response = await anthropic.messages.create(
          {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 3000,
            system: DENETIM_PROMPT,
            messages: [{ role: 'user', content: userContent }],
          },
          { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        if (!response?.content?.[0]?.text) {
          throw new Error('Boş AI yanıtı');
        }

        const content = response.content[0].text;
        const jsonMatch = content.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
          throw new Error('JSON bulunamadı');
        }

        const aiResult = JSON.parse(jsonMatch[0]);

        logger.info('[AuditV2] AI batch başarılı', {
          batch: `${batchIdx + 1}/${totalBatches}`,
          attempt: attempt + 1,
          findings: (aiResult.findings || []).length,
        });

        return { success: true, data: aiResult };
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;

        const isTimeout = error.name === 'AbortError';
        const isRateLimit = error.message?.includes('rate') || error.status === 429;

        logger.warn('[AuditV2] AI batch hatası', {
          batch: `${batchIdx + 1}/${totalBatches}`,
          attempt: attempt + 1,
          error: error.message,
          isTimeout,
          isRateLimit,
        });

        // Rate limit durumunda daha uzun bekle
        if (isRateLimit && attempt < CONFIG.AI_MAX_RETRIES) {
          await this.sleep(5000 * (attempt + 1));
        }
      }
    }

    logger.error("[AuditV2] AI batch başarısız (tüm retry'lar tükendi)", {
      batch: `${batchIdx + 1}/${totalBatches}`,
      error: lastError?.message,
    });

    return { success: false, error: lastError?.message };
  }

  // ==========================================================================
  // DENETİM FONKSİYONLARI
  // ==========================================================================

  /**
   * Reçete Denetimi (optimized)
   */
  async auditReceteler() {
    const config = await this.getConfig();
    await this.updateProgress('audit_recete', 0, 5, 'Reçete denetimi başlıyor...');

    let findingCount = 0;
    const maxFindings = CONFIG.MAX_FINDINGS_PER_CATEGORY;

    // 1. Malzeme fiyatı eksik reçeteler
    await this.updateProgress('audit_recete', 1, 5, 'Eksik fiyat kontrolü...');
    const eksikFiyatResult = await query(
      `
      SELECT 
        r.id, r.kod, r.ad,
        COUNT(rm.id) as malzeme_sayisi,
        COUNT(CASE WHEN rm.birim_fiyat IS NULL OR rm.birim_fiyat = 0 THEN 1 END) as fiyatsiz_malzeme
      FROM receteler r
      JOIN recete_malzemeler rm ON rm.recete_id = r.id
      WHERE r.aktif = true
      GROUP BY r.id, r.kod, r.ad
      HAVING COUNT(CASE WHEN rm.birim_fiyat IS NULL OR rm.birim_fiyat = 0 THEN 1 END) > 0
      LIMIT $1
    `,
      [maxFindings - findingCount]
    );

    for (const row of eksikFiyatResult.rows) {
      this.addFinding({
        kategori: 'recete',
        sorun_tipi: 'eksik_malzeme_fiyat',
        ilgili_tablo: 'receteler',
        ilgili_id: row.id,
        ilgili_kod: row.kod,
        ilgili_ad: row.ad,
        aciklama: `"${row.ad}" reçetesinde ${row.fiyatsiz_malzeme}/${row.malzeme_sayisi} malzemenin fiyatı eksik`,
        detay: {
          fiyatsiz_malzeme: parseInt(row.fiyatsiz_malzeme, 10),
          toplam_malzeme: parseInt(row.malzeme_sayisi, 10),
        },
        otomatik_uygun: true,
        onerilen_duzeltme: { action: 'recete_maliyet_hesapla', params: { recete_id: row.id } },
      });
      findingCount++;
    }

    // 2. Maliyet hesaplanmamış reçeteler
    await this.updateProgress('audit_recete', 2, 5, 'Maliyet kontrolü...');
    if (findingCount < maxFindings) {
      const maliyetYokResult = await query(
        `
        SELECT r.id, r.kod, r.ad
        FROM receteler r
        WHERE r.aktif = true
          AND (r.tahmini_maliyet IS NULL OR r.tahmini_maliyet = 0)
          AND EXISTS (SELECT 1 FROM recete_malzemeler rm WHERE rm.recete_id = r.id)
        LIMIT $1
      `,
        [maxFindings - findingCount]
      );

      for (const row of maliyetYokResult.rows) {
        this.addFinding({
          kategori: 'recete',
          sorun_tipi: 'maliyet_hesaplanmamis',
          ilgili_tablo: 'receteler',
          ilgili_id: row.id,
          ilgili_kod: row.kod,
          ilgili_ad: row.ad,
          aciklama: `"${row.ad}" reçetesinin tahmini maliyeti hesaplanmamış`,
          otomatik_uygun: true,
          onerilen_duzeltme: { action: 'recete_maliyet_hesapla', params: { recete_id: row.id } },
        });
        findingCount++;
      }
    }

    // 3. Anormal maliyet
    await this.updateProgress('audit_recete', 3, 5, 'Anormal maliyet kontrolü...');
    if (findingCount < maxFindings) {
      const anormalMaliyetResult = await query(
        `
        WITH kategori_ort AS (
          SELECT 
            r.kategori_id,
            AVG(r.tahmini_maliyet) as ort_maliyet
          FROM receteler r
          WHERE r.aktif = true AND r.tahmini_maliyet > 0
          GROUP BY r.kategori_id
        )
        SELECT 
          r.id, r.kod, r.ad, r.tahmini_maliyet,
          rk.ad as kategori_ad,
          ko.ort_maliyet,
          ABS(r.tahmini_maliyet - ko.ort_maliyet) / NULLIF(ko.ort_maliyet, 0) * 100 as sapma_yuzde
        FROM receteler r
        JOIN recete_kategoriler rk ON rk.id = r.kategori_id
        JOIN kategori_ort ko ON ko.kategori_id = r.kategori_id
        WHERE r.aktif = true
          AND r.tahmini_maliyet > 0
          AND ABS(r.tahmini_maliyet - ko.ort_maliyet) / NULLIF(ko.ort_maliyet, 0) * 100 > 50
        ORDER BY sapma_yuzde DESC
        LIMIT $1
      `,
        [maxFindings - findingCount]
      );

      for (const row of anormalMaliyetResult.rows) {
        this.addFinding({
          kategori: 'recete',
          sorun_tipi: 'anormal_maliyet',
          ilgili_tablo: 'receteler',
          ilgili_id: row.id,
          ilgili_kod: row.kod,
          ilgili_ad: row.ad,
          aciklama: `"${row.ad}" maliyeti (${parseFloat(row.tahmini_maliyet).toFixed(2)}₺) kategori ortalamasından %${Math.round(row.sapma_yuzde)} sapıyor`,
          detay: {
            maliyet: parseFloat(row.tahmini_maliyet),
            kategori_ortalama: parseFloat(row.ort_maliyet),
            sapma_yuzde: Math.round(parseFloat(row.sapma_yuzde)),
          },
          otomatik_uygun: false,
        });
        findingCount++;
      }
    }

    // 4. Eşleşmemiş malzemeler
    await this.updateProgress('audit_recete', 4, 5, 'Eşleşme kontrolü...');
    if (findingCount < maxFindings) {
      const eslesmemisResult = await query(
        `
        SELECT 
          rm.id as malzeme_id,
          rm.malzeme_adi,
          r.id as recete_id,
          r.kod as recete_kod,
          r.ad as recete_ad
        FROM recete_malzemeler rm
        JOIN receteler r ON r.id = rm.recete_id
        WHERE r.aktif = true
          AND (rm.urun_kart_id IS NULL OR rm.stok_kart_id IS NULL)
          AND rm.malzeme_adi IS NOT NULL
        LIMIT $1
      `,
        [Math.min(50, maxFindings - findingCount)]
      );

      for (const row of eslesmemisResult.rows) {
        this.addFinding({
          kategori: 'recete',
          sorun_tipi: 'eslesmemis_malzeme',
          ilgili_tablo: 'recete_malzemeler',
          ilgili_id: row.malzeme_id,
          ilgili_kod: row.recete_kod,
          ilgili_ad: `${row.recete_ad} - ${row.malzeme_adi}`,
          aciklama: `"${row.recete_ad}" reçetesindeki "${row.malzeme_adi}" malzemesi ürün kartına eşleşmemiş`,
          detay: { recete_id: row.recete_id, malzeme_adi: row.malzeme_adi },
          otomatik_uygun: true,
          onerilen_duzeltme: {
            action: 'urun_eslestir',
            params: { malzeme_id: row.malzeme_id, malzeme_adi: row.malzeme_adi },
          },
        });
        findingCount++;
      }
    }

    // 5. Anormal gramaj
    await this.updateProgress('audit_recete', 5, 5, 'Gramaj kontrolü...');
    if (findingCount < maxFindings) {
      const gramajResult = await query(
        `
        SELECT 
          r.id, r.kod, r.ad, r.porsiyon_miktar,
          SUM(
            CASE 
              WHEN rm.birim IN ('g', 'gr') THEN rm.miktar
              WHEN rm.birim IN ('kg') THEN rm.miktar * 1000
              WHEN rm.birim IN ('ml') THEN rm.miktar
              WHEN rm.birim IN ('L', 'lt') THEN rm.miktar * 1000
              ELSE rm.miktar
            END
          ) as toplam_gramaj
        FROM receteler r
        JOIN recete_malzemeler rm ON rm.recete_id = r.id
        WHERE r.aktif = true
        GROUP BY r.id, r.kod, r.ad, r.porsiyon_miktar
        HAVING SUM(
          CASE 
            WHEN rm.birim IN ('g', 'gr') THEN rm.miktar
            WHEN rm.birim IN ('kg') THEN rm.miktar * 1000
            WHEN rm.birim IN ('ml') THEN rm.miktar
            WHEN rm.birim IN ('L', 'lt') THEN rm.miktar * 1000
            ELSE rm.miktar
          END
        ) / GREATEST(r.porsiyon_miktar, 1) NOT BETWEEN $1 AND $2
        LIMIT $3
      `,
        [config.porsiyon_min_gramaj, config.porsiyon_max_gramaj, maxFindings - findingCount]
      );

      for (const row of gramajResult.rows) {
        const porsiyonGramaj = parseFloat(row.toplam_gramaj) / (row.porsiyon_miktar || 1);
        this.addFinding({
          kategori: 'recete',
          sorun_tipi: 'anormal_gramaj',
          ilgili_tablo: 'receteler',
          ilgili_id: row.id,
          ilgili_kod: row.kod,
          ilgili_ad: row.ad,
          aciklama: `"${row.ad}" porsiyon gramajı (${Math.round(porsiyonGramaj)}g) normal aralık dışında`,
          detay: {
            toplam_gramaj: Math.round(parseFloat(row.toplam_gramaj)),
            porsiyon_miktar: row.porsiyon_miktar,
            porsiyon_gramaj: Math.round(porsiyonGramaj),
          },
          otomatik_uygun: false,
        });
      }
    }

    logger.info('[AuditV2] Reçete denetimi tamamlandı', { sorunSayisi: this.stats.recete });
  }

  /**
   * Menü Denetimi (optimized)
   */
  async auditMenuler() {
    const config = await this.getConfig();
    await this.updateProgress('audit_menu', 0, 4, 'Menü denetimi başlıyor...');

    let findingCount = 0;
    const maxFindings = CONFIG.MAX_FINDINGS_PER_CATEGORY;

    // 1. Aynı yemek aynı haftada tekrar
    await this.updateProgress('audit_menu', 1, 4, 'Tekrar yemek kontrolü...');
    const tekrarResult = await query(
      `
      WITH haftalik AS (
        SELECT 
          mpo.menu_plan_id,
          mp.proje_id,
          p.ad as proje_ad,
          DATE_TRUNC('week', mpo.tarih) as hafta,
          moy.recete_id,
          r.ad as recete_ad,
          COUNT(*) as tekrar_sayisi
        FROM menu_ogun_yemekleri moy
        JOIN menu_plan_ogunleri mpo ON mpo.id = moy.menu_ogun_id
        JOIN menu_planlari mp ON mp.id = mpo.menu_plan_id
        JOIN projeler p ON p.id = mp.proje_id
        JOIN receteler r ON r.id = moy.recete_id
        WHERE mpo.tarih >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY mpo.menu_plan_id, mp.proje_id, p.ad, DATE_TRUNC('week', mpo.tarih), moy.recete_id, r.ad
        HAVING COUNT(*) > $1
      )
      SELECT * FROM haftalik ORDER BY tekrar_sayisi DESC
      LIMIT $2
    `,
      [config.ayni_yemek_hafta_limit, maxFindings - findingCount]
    );

    for (const row of tekrarResult.rows) {
      this.addFinding({
        kategori: 'menu',
        sorun_tipi: 'tekrar_yemek',
        ilgili_tablo: 'menu_planlari',
        ilgili_id: row.menu_plan_id,
        ilgili_ad: `${row.proje_ad} - ${row.recete_ad}`,
        aciklama: `"${row.proje_ad}" projesinde "${row.recete_ad}" aynı hafta ${row.tekrar_sayisi} kez`,
        detay: {
          proje_id: row.proje_id,
          recete_id: row.recete_id,
          hafta: row.hafta,
          tekrar_sayisi: parseInt(row.tekrar_sayisi, 10),
        },
        otomatik_uygun: false,
      });
      findingCount++;
    }

    // 2. Eksik öğünler
    await this.updateProgress('audit_menu', 2, 4, 'Eksik öğün kontrolü...');
    if (findingCount < maxFindings) {
      const eksikOgunResult = await query(
        `
        SELECT 
          mpo.id,
          mpo.menu_plan_id,
          p.ad as proje_ad,
          mpo.tarih,
          ot.ad as ogun_ad
        FROM menu_plan_ogunleri mpo
        JOIN menu_planlari mp ON mp.id = mpo.menu_plan_id
        JOIN projeler p ON p.id = mp.proje_id
        JOIN ogun_tipleri ot ON ot.id = mpo.ogun_tipi_id
        LEFT JOIN menu_ogun_yemekleri moy ON moy.menu_ogun_id = mpo.id
        WHERE mpo.tarih >= CURRENT_DATE
          AND mpo.tarih <= CURRENT_DATE + INTERVAL '7 days'
          AND moy.id IS NULL
        ORDER BY mpo.tarih
        LIMIT $1
      `,
        [maxFindings - findingCount]
      );

      for (const row of eksikOgunResult.rows) {
        this.addFinding({
          kategori: 'menu',
          sorun_tipi: 'eksik_ogun',
          ilgili_tablo: 'menu_plan_ogunleri',
          ilgili_id: row.id,
          ilgili_ad: `${row.proje_ad} - ${row.tarih}`,
          aciklama: `"${row.proje_ad}" ${row.tarih} tarihli ${row.ogun_ad} öğünü boş`,
          detay: { plan_id: row.menu_plan_id, tarih: row.tarih, ogun: row.ogun_ad },
          otomatik_uygun: false,
        });
        findingCount++;
      }
    }

    // 3. Maliyet aşımı
    await this.updateProgress('audit_menu', 3, 4, 'Maliyet aşımı kontrolü...');
    if (findingCount < maxFindings) {
      const maliyetAsimResult = await query(
        `
        SELECT 
          mp.id,
          mp.ad,
          p.ad as proje_ad,
          mp.porsiyon_ortalama_maliyet,
          50 as hedef_butce
        FROM menu_planlari mp
        JOIN projeler p ON p.id = mp.proje_id
        WHERE mp.porsiyon_ortalama_maliyet > 0
          AND mp.durum IN ('taslak', 'aktif')
          AND mp.porsiyon_ortalama_maliyet > 50 * $1 / 100
        LIMIT $2
      `,
        [config.maliyet_asim_yuzde, maxFindings - findingCount]
      );

      for (const row of maliyetAsimResult.rows) {
        this.addFinding({
          kategori: 'menu',
          sorun_tipi: 'maliyet_asimi',
          ilgili_tablo: 'menu_planlari',
          ilgili_id: row.id,
          ilgili_ad: `${row.proje_ad} - ${row.ad}`,
          aciklama: `"${row.proje_ad}" menü maliyeti (${parseFloat(row.porsiyon_ortalama_maliyet).toFixed(2)}₺) hedef bütçeyi aşıyor`,
          detay: {
            mevcut_maliyet: parseFloat(row.porsiyon_ortalama_maliyet),
            hedef_butce: row.hedef_butce,
            asim_yuzde: Math.round((parseFloat(row.porsiyon_ortalama_maliyet) / row.hedef_butce) * 100),
          },
          otomatik_uygun: false,
        });
        findingCount++;
      }
    }

    await this.updateProgress('audit_menu', 4, 4, 'Menü denetimi tamamlandı');
    logger.info('[AuditV2] Menü denetimi tamamlandı', { sorunSayisi: this.stats.menu });
  }

  /**
   * Fiyat Denetimi (optimized)
   */
  async auditFiyatlar() {
    const config = await this.getConfig();
    await this.updateProgress('audit_fiyat', 0, 6, 'Fiyat denetimi başlıyor...');

    let findingCount = 0;
    const maxFindings = CONFIG.MAX_FINDINGS_PER_CATEGORY;

    // 1. Eski fiyatlar
    await this.updateProgress('audit_fiyat', 1, 6, 'Eski fiyat kontrolü...');
    const eskiFiyatResult = await query(
      `
      SELECT 
        uk.id, uk.kod, uk.ad,
        uk.aktif_fiyat,
        uk.aktif_fiyat_tipi,
        uk.aktif_fiyat_guncelleme,
        EXTRACT(DAY FROM NOW() - uk.aktif_fiyat_guncelleme) as gun_farki
      FROM urun_kartlari uk
      WHERE uk.aktif = true
        AND uk.aktif_fiyat > 0
        AND uk.aktif_fiyat_guncelleme < NOW() - ($1 || ' days')::INTERVAL
      ORDER BY uk.aktif_fiyat_guncelleme ASC
      LIMIT $2
    `,
      [config.fiyat_esik_gun, maxFindings - findingCount]
    );

    for (const row of eskiFiyatResult.rows) {
      this.addFinding({
        kategori: 'fiyat',
        sorun_tipi: 'eski_fiyat',
        ilgili_tablo: 'urun_kartlari',
        ilgili_id: row.id,
        ilgili_kod: row.kod,
        ilgili_ad: row.ad,
        aciklama: `"${row.ad}" fiyatı ${Math.round(row.gun_farki)} gündür güncellenmemiş`,
        detay: {
          mevcut_fiyat: parseFloat(row.aktif_fiyat),
          fiyat_tipi: row.aktif_fiyat_tipi,
          son_guncelleme: row.aktif_fiyat_guncelleme,
          gun_farki: Math.round(parseFloat(row.gun_farki)),
        },
        otomatik_uygun: false,
      });
      findingCount++;
    }

    // 2. Fiyat anomalisi
    await this.updateProgress('audit_fiyat', 2, 6, 'Fiyat anomalisi kontrolü...');
    if (findingCount < maxFindings) {
      const anomaliResult = await query(
        `
        WITH son_fiyatlar AS (
          SELECT 
            ufg.urun_kart_id,
            ufg.fiyat,
            ufg.tarih,
            LAG(ufg.fiyat) OVER (PARTITION BY ufg.urun_kart_id ORDER BY ufg.tarih) as onceki_fiyat
          FROM urun_fiyat_gecmisi ufg
          WHERE ufg.tarih >= CURRENT_DATE - INTERVAL '7 days'
        )
        SELECT 
          uk.id, uk.kod, uk.ad,
          sf.fiyat as yeni_fiyat,
          sf.onceki_fiyat,
          ABS(sf.fiyat - sf.onceki_fiyat) / NULLIF(sf.onceki_fiyat, 0) * 100 as degisim_yuzde
        FROM son_fiyatlar sf
        JOIN urun_kartlari uk ON uk.id = sf.urun_kart_id
        WHERE sf.onceki_fiyat > 0
          AND ABS(sf.fiyat - sf.onceki_fiyat) / sf.onceki_fiyat * 100 > $1
        ORDER BY degisim_yuzde DESC
        LIMIT $2
      `,
        [config.fiyat_anomali_yuzde, maxFindings - findingCount]
      );

      for (const row of anomaliResult.rows) {
        this.addFinding({
          kategori: 'fiyat',
          sorun_tipi: 'fiyat_anomali',
          ilgili_tablo: 'urun_kartlari',
          ilgili_id: row.id,
          ilgili_kod: row.kod,
          ilgili_ad: row.ad,
          aciklama: `"${row.ad}" fiyatında ani değişim: ${parseFloat(row.onceki_fiyat).toFixed(2)}₺ → ${parseFloat(row.yeni_fiyat).toFixed(2)}₺ (%${Math.round(row.degisim_yuzde)})`,
          detay: {
            onceki_fiyat: parseFloat(row.onceki_fiyat),
            yeni_fiyat: parseFloat(row.yeni_fiyat),
            degisim_yuzde: Math.round(parseFloat(row.degisim_yuzde)),
          },
          otomatik_uygun: false,
        });
        findingCount++;
      }
    }

    // 3. Kategori sapması
    await this.updateProgress('audit_fiyat', 3, 6, 'Kategori sapması kontrolü...');
    if (findingCount < maxFindings) {
      const sapmaResult = await query(
        `
        WITH kategori_ort AS (
          SELECT 
            uk.kategori_id,
            AVG(uk.aktif_fiyat) as ort_fiyat
          FROM urun_kartlari uk
          WHERE uk.aktif = true AND uk.aktif_fiyat > 0
          GROUP BY uk.kategori_id
        )
        SELECT 
          uk.id, uk.kod, uk.ad, uk.aktif_fiyat,
          kat.ad as kategori_ad,
          ko.ort_fiyat,
          ABS(uk.aktif_fiyat - ko.ort_fiyat) / NULLIF(ko.ort_fiyat, 0) * 100 as sapma_yuzde
        FROM urun_kartlari uk
        JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
        JOIN kategori_ort ko ON ko.kategori_id = uk.kategori_id
        WHERE uk.aktif = true
          AND uk.aktif_fiyat > 0
          AND ABS(uk.aktif_fiyat - ko.ort_fiyat) / NULLIF(ko.ort_fiyat, 0) * 100 > $1
        ORDER BY sapma_yuzde DESC
        LIMIT $2
      `,
        [config.kategori_sapma_yuzde, maxFindings - findingCount]
      );

      for (const row of sapmaResult.rows) {
        this.addFinding({
          kategori: 'fiyat',
          sorun_tipi: 'kategori_sapma',
          ilgili_tablo: 'urun_kartlari',
          ilgili_id: row.id,
          ilgili_kod: row.kod,
          ilgili_ad: row.ad,
          aciklama: `"${row.ad}" fiyatı (${parseFloat(row.aktif_fiyat).toFixed(2)}₺) kategori ortalamasından %${Math.round(row.sapma_yuzde)} sapıyor`,
          detay: {
            mevcut_fiyat: parseFloat(row.aktif_fiyat),
            kategori_ortalama: parseFloat(row.ort_fiyat),
            sapma_yuzde: Math.round(parseFloat(row.sapma_yuzde)),
          },
          otomatik_uygun: false,
        });
        findingCount++;
      }
    }

    // 4. Düşük güvenli AI tahmini
    await this.updateProgress('audit_fiyat', 4, 6, 'AI güven kontrolü...');
    if (findingCount < maxFindings) {
      const dusukGuvenResult = await query(
        `
        SELECT 
          uk.id, uk.kod, uk.ad,
          uk.aktif_fiyat,
          uk.aktif_fiyat_guven
        FROM urun_kartlari uk
        WHERE uk.aktif = true
          AND uk.aktif_fiyat_tipi = 'AI_TAHMINI'
          AND uk.aktif_fiyat_guven < $1
        LIMIT $2
      `,
        [config.ai_guven_esik, maxFindings - findingCount]
      );

      for (const row of dusukGuvenResult.rows) {
        this.addFinding({
          kategori: 'fiyat',
          sorun_tipi: 'dusuk_guven_ai',
          ilgili_tablo: 'urun_kartlari',
          ilgili_id: row.id,
          ilgili_kod: row.kod,
          ilgili_ad: row.ad,
          aciklama: `"${row.ad}" AI fiyat tahmini güven skoru düşük (%${row.aktif_fiyat_guven})`,
          detay: {
            mevcut_fiyat: parseFloat(row.aktif_fiyat),
            guven_skoru: row.aktif_fiyat_guven,
          },
          otomatik_uygun: false,
        });
        findingCount++;
      }
    }

    // 5. Fiyatsız aktif ürünler
    await this.updateProgress('audit_fiyat', 5, 6, 'Fiyatsız ürün kontrolü...');
    if (findingCount < maxFindings) {
      const fiyatsizResult = await query(
        `
        SELECT uk.id, uk.kod, uk.ad, kat.ad as kategori_ad
        FROM urun_kartlari uk
        LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
        WHERE uk.aktif = true
          AND (uk.aktif_fiyat IS NULL OR uk.aktif_fiyat = 0)
        LIMIT $1
      `,
        [maxFindings - findingCount]
      );

      for (const row of fiyatsizResult.rows) {
        this.addFinding({
          kategori: 'fiyat',
          sorun_tipi: 'fiyatsiz_urun',
          ilgili_tablo: 'urun_kartlari',
          ilgili_id: row.id,
          ilgili_kod: row.kod,
          ilgili_ad: row.ad,
          aciklama: `"${row.ad}" ürününün fiyatı tanımlı değil`,
          detay: { kategori: row.kategori_ad },
          otomatik_uygun: true,
          onerilen_duzeltme: { action: 'ai_fiyat_tahmini', params: { urun_id: row.id } },
        });
        findingCount++;
      }
    }

    // 6. Sözleşme süresi dolmuş
    await this.updateProgress('audit_fiyat', 6, 6, 'Sözleşme kontrolü...');
    if (findingCount < maxFindings) {
      const sozlesmeSonResult = await query(
        `
        SELECT 
          tf.id,
          uk.id as urun_id,
          uk.kod,
          uk.ad,
          c.unvan as tedarikci,
          tf.gecerlilik_bitis
        FROM tedarikci_fiyatlari tf
        JOIN urun_kartlari uk ON uk.id = tf.urun_kart_id
        JOIN cariler c ON c.id = tf.cari_id
        WHERE tf.aktif = true
          AND tf.gecerlilik_bitis < CURRENT_DATE
        LIMIT $1
      `,
        [maxFindings - findingCount]
      );

      for (const row of sozlesmeSonResult.rows) {
        this.addFinding({
          kategori: 'fiyat',
          sorun_tipi: 'sozlesme_suresi_dolmus',
          ilgili_tablo: 'tedarikci_fiyatlari',
          ilgili_id: row.id,
          ilgili_kod: row.kod,
          ilgili_ad: `${row.ad} - ${row.tedarikci}`,
          aciklama: `"${row.ad}" için "${row.tedarikci}" sözleşmesi ${row.gecerlilik_bitis} tarihinde sona ermiş`,
          detay: {
            urun_id: row.urun_id,
            tedarikci: row.tedarikci,
            bitis_tarihi: row.gecerlilik_bitis,
          },
          otomatik_uygun: false,
        });
        findingCount++;
      }
    }

    logger.info('[AuditV2] Fiyat denetimi tamamlandı', { sorunSayisi: this.stats.fiyat });
  }

  // ==========================================================================
  // OTOMATİK DÜZELTMELER
  // ==========================================================================

  /**
   * Otomatik düzeltmeleri uygula
   */
  async applyAutoFixes() {
    await this.updateProgress('auto_fix', 0, 1, 'Otomatik düzeltmeler uygulanıyor...');

    const result = await query(
      `
      SELECT id, sorun_tipi, ilgili_id, ilgili_tablo, onerilen_duzeltme_json, detay_json
      FROM daily_audit_findings
      WHERE audit_run_id = $1
        AND otomatik_duzeltme_uygun = true
        AND durum = 'beklemede'
    `,
      [this.currentRunId]
    );

    const total = result.rows.length;
    let processed = 0;

    for (const finding of result.rows) {
      try {
        const duzeltme = finding.onerilen_duzeltme_json || {};
        let basarili = false;
        let oncekiDeger = {};
        let yeniDeger = {};

        switch (duzeltme.action) {
          case 'recete_maliyet_hesapla': {
            const maliyetSonuc = await this.fixReceteMaliyet(duzeltme.params?.recete_id);
            basarili = maliyetSonuc.basarili;
            oncekiDeger = maliyetSonuc.onceki;
            yeniDeger = maliyetSonuc.yeni;
            break;
          }

          case 'ai_fiyat_tahmini': {
            const fiyatSonuc = await this.fixAiFiyatTahmini(duzeltme.params?.urun_id);
            basarili = fiyatSonuc.basarili;
            oncekiDeger = fiyatSonuc.onceki;
            yeniDeger = fiyatSonuc.yeni;
            break;
          }

          case 'urun_eslestir': {
            const eslestirmeSonuc = await this.fixUrunEslestir(
              duzeltme.params?.malzeme_id,
              duzeltme.params?.malzeme_adi
            );
            basarili = eslestirmeSonuc.basarili;
            oncekiDeger = eslestirmeSonuc.onceki;
            yeniDeger = eslestirmeSonuc.yeni;
            break;
          }

          default:
            continue;
        }

        if (basarili) {
          await query(
            `
            INSERT INTO daily_audit_fixes (
              finding_id, duzeltme_tipi, onceki_deger_json, yeni_deger_json, basarili
            ) VALUES ($1, 'otomatik', $2, $3, true)
          `,
            [finding.id, JSON.stringify(oncekiDeger), JSON.stringify(yeniDeger)]
          );

          await query(
            `
            UPDATE daily_audit_findings SET durum = 'otomatik_duzeltildi' WHERE id = $1
          `,
            [finding.id]
          );

          this.stats.otomatik++;
        }
      } catch (error) {
        logger.error('[AuditV2] Otomatik düzeltme hatası', {
          findingId: finding.id,
          error: error.message,
        });
      }

      processed++;
      if (processed % 10 === 0) {
        await this.updateProgress('auto_fix', processed, total, `Düzeltme: ${processed}/${total}`);
      }
    }

    // Manuel bekleyen sayısı
    const manuelResult = await query(
      `
      SELECT COUNT(*) as sayi FROM daily_audit_findings
      WHERE audit_run_id = $1 AND durum = 'beklemede'
    `,
      [this.currentRunId]
    );

    this.stats.manuel = parseInt(manuelResult.rows[0]?.sayi, 10) || 0;

    logger.info('[AuditV2] Otomatik düzeltmeler tamamlandı', {
      otomatik: this.stats.otomatik,
      manuelBekleyen: this.stats.manuel,
    });
  }

  // ==========================================================================
  // DÜZELTME FONKSİYONLARI
  // ==========================================================================

  async fixReceteMaliyet(receteId) {
    const oncekiResult = await query('SELECT tahmini_maliyet FROM receteler WHERE id = $1', [receteId]);
    const onceki = { tahmini_maliyet: oncekiResult.rows[0]?.tahmini_maliyet };

    const malzemeResult = await query(
      `
      SELECT 
        rm.miktar, rm.birim,
        COALESCE(uk.aktif_fiyat, uk.son_alis_fiyati, 0) as birim_fiyat
      FROM recete_malzemeler rm
      LEFT JOIN urun_kartlari uk ON uk.id = COALESCE(rm.urun_kart_id, rm.stok_kart_id)
      WHERE rm.recete_id = $1
    `,
      [receteId]
    );

    let toplamMaliyet = 0;
    for (const m of malzemeResult.rows) {
      const birim = (m.birim || '').toLowerCase();
      let maliyet = 0;

      if (birim === 'g' || birim === 'gr') {
        maliyet = (m.miktar / 1000) * m.birim_fiyat;
      } else if (birim === 'ml') {
        maliyet = (m.miktar / 1000) * m.birim_fiyat;
      } else {
        maliyet = m.miktar * m.birim_fiyat;
      }
      toplamMaliyet += maliyet;
    }

    const porsiyonResult = await query('SELECT porsiyon_miktar FROM receteler WHERE id = $1', [receteId]);
    const porsiyonMiktar = porsiyonResult.rows[0]?.porsiyon_miktar || 1;
    const porsiyonMaliyet = Math.round((toplamMaliyet / porsiyonMiktar) * 100) / 100;

    await query(
      `
      UPDATE receteler SET 
        tahmini_maliyet = $1,
        son_hesaplama_tarihi = NOW()
      WHERE id = $2
    `,
      [porsiyonMaliyet, receteId]
    );

    return {
      basarili: true,
      onceki,
      yeni: { tahmini_maliyet: porsiyonMaliyet },
    };
  }

  async fixAiFiyatTahmini(urunId) {
    const oncekiResult = await query('SELECT aktif_fiyat, aktif_fiyat_tipi FROM urun_kartlari WHERE id = $1', [urunId]);
    const onceki = {
      aktif_fiyat: oncekiResult.rows[0]?.aktif_fiyat,
      aktif_fiyat_tipi: oncekiResult.rows[0]?.aktif_fiyat_tipi,
    };

    try {
      const sonuc = await hesaplaAktifFiyat(urunId, { aiTahminiKullan: true });

      if (sonuc.fiyat) {
        return {
          basarili: true,
          onceki,
          yeni: { aktif_fiyat: sonuc.fiyat, aktif_fiyat_tipi: sonuc.tip },
        };
      }
    } catch (e) {
      logger.warn('[AuditV2] AI fiyat tahmini hatası', { urunId, error: e.message });
    }

    return { basarili: false, onceki, yeni: {} };
  }

  async fixUrunEslestir(malzemeId, malzemeAdi) {
    const eslestirmeResult = await query(
      `
      SELECT id, ad
      FROM urun_kartlari
      WHERE aktif = true
        AND ad ILIKE $1
      ORDER BY 
        CASE WHEN ad ILIKE $2 THEN 0 ELSE 1 END,
        LENGTH(ad)
      LIMIT 1
    `,
      [`%${malzemeAdi}%`, malzemeAdi]
    );

    if (eslestirmeResult.rows.length > 0) {
      const urunKart = eslestirmeResult.rows[0];

      await query(
        `
        UPDATE recete_malzemeler SET 
          urun_kart_id = $1,
          stok_kart_id = $1
        WHERE id = $2
      `,
        [urunKart.id, malzemeId]
      );

      return {
        basarili: true,
        onceki: { urun_kart_id: null },
        yeni: { urun_kart_id: urunKart.id, eslestirilen_ad: urunKart.ad },
      };
    }

    return { basarili: false, onceki: {}, yeni: {} };
  }

  // ==========================================================================
  // ANA DENETİM FONKSİYONU
  // ==========================================================================

  /**
   * Tam denetim çalıştır (optimized)
   * @param {Object} options - { skipAI, runId }
   */
  async runFullAudit(options = {}) {
    const { skipAI = false, runId: existingRunId } = options;
    const startTime = Date.now();

    // Migration kontrolü (ilk çalıştırmada)
    await this.ensureMigration();

    logger.info('[AuditV2] ═══════════════════════════════════════════════════');
    logger.info('[AuditV2] Optimize edilmiş günlük denetim başlatılıyor...');
    logger.info('[AuditV2] ═══════════════════════════════════════════════════');

    try {
      // 1. Denetim kaydı
      if (existingRunId) {
        this.currentRunId = existingRunId;
      } else {
        const runResult = await query(`
          INSERT INTO daily_audit_runs (durum, progress_json) 
          VALUES ('running', '{"phase":"starting","current":0,"total":0}')
          RETURNING id
        `);
        this.currentRunId = runResult.rows[0].id;
      }

      // State sıfırla
      this.findingsBuffer = [];
      this.stats = { recete: 0, menu: 0, fiyat: 0, otomatik: 0, manuel: 0, aiAnalyzed: 0, ruleBasedAnalyzed: 0 };

      // 2. Reçete denetimi
      const t1 = Date.now();
      await this.auditReceteler();
      logger.info('[AuditV2] Reçete denetimi süresi', { saniye: ((Date.now() - t1) / 1000).toFixed(1) });

      // 3. Menü denetimi
      const t2 = Date.now();
      await this.auditMenuler();
      logger.info('[AuditV2] Menü denetimi süresi', { saniye: ((Date.now() - t2) / 1000).toFixed(1) });

      // 4. Fiyat denetimi
      const t3 = Date.now();
      await this.auditFiyatlar();
      logger.info('[AuditV2] Fiyat denetimi süresi', { saniye: ((Date.now() - t3) / 1000).toFixed(1) });

      // 5. AI Analizi (akıllı filtreleme ile)
      if (!skipAI && this.findingsBuffer.length > 0) {
        const t4 = Date.now();
        await this.runSmartAIAnalysis(this.findingsBuffer);
        logger.info('[AuditV2] AI analizi süresi', { saniye: ((Date.now() - t4) / 1000).toFixed(1) });
      } else {
        // AI atlandı - rule-based analiz sayısı
        this.stats.ruleBasedAnalyzed = this.findingsBuffer.length;
        logger.info('[AuditV2] AI analizi atlandı', {
          skipAI,
          ruleBasedAnalyzed: this.stats.ruleBasedAnalyzed,
        });
      }

      // 6. Bulk INSERT (tüm bulgular tek seferde)
      const t5 = Date.now();
      await this.bulkInsertFindings(this.findingsBuffer);
      logger.info('[AuditV2] Bulk INSERT süresi', { saniye: ((Date.now() - t5) / 1000).toFixed(1) });

      // 7. Otomatik düzeltmeler
      const config = await this.getConfig();
      if (config.otomatik_duzeltme_aktif) {
        const t6 = Date.now();
        await this.applyAutoFixes();
        logger.info('[AuditV2] Otomatik düzeltme süresi', { saniye: ((Date.now() - t6) / 1000).toFixed(1) });
      }

      // 8. Denetim kaydını güncelle
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

      await query(
        `
        UPDATE daily_audit_runs SET
          durum = 'completed',
          bitis_zamani = NOW(),
          toplam_sorun = $1,
          otomatik_duzeltilen = $2,
          onay_bekleyen = $3,
          recete_sorun = $4,
          menu_sorun = $5,
          fiyat_sorun = $6,
          progress_json = $7
        WHERE id = $8
      `,
        [
          this.stats.recete + this.stats.menu + this.stats.fiyat,
          this.stats.otomatik,
          this.stats.manuel,
          this.stats.recete,
          this.stats.menu,
          this.stats.fiyat,
          JSON.stringify({ phase: 'completed', duration: totalTime }),
          this.currentRunId,
        ]
      );

      logger.info('[AuditV2] ═══════════════════════════════════════════════════');
      logger.info('[AuditV2] Denetim TAMAMLANDI', {
        runId: this.currentRunId,
        toplamSure: `${totalTime} saniye`,
        stats: this.stats,
      });
      logger.info('[AuditV2] ═══════════════════════════════════════════════════');

      return {
        success: true,
        runId: this.currentRunId,
        stats: this.stats,
        duration: parseFloat(totalTime),
      };
    } catch (error) {
      logger.error('[AuditV2] Denetim HATASI', { error: error.message, stack: error.stack });

      if (this.currentRunId) {
        await query(
          `
          UPDATE daily_audit_runs SET
            durum = 'failed',
            bitis_zamani = NOW(),
            hata_mesaji = $1
          WHERE id = $2
        `,
          [error.message, this.currentRunId]
        );
      }

      return {
        success: false,
        error: error.message,
        runId: this.currentRunId,
      };
    }
  }

  // ==========================================================================
  // YARDIMCI FONKSİYONLAR
  // ==========================================================================

  async getConfig() {
    try {
      const result = await query('SELECT config_key, config_value FROM daily_audit_config');
      const config = {};
      result.rows.forEach((row) => {
        config[row.config_key] = JSON.parse(row.config_value);
      });
      return config;
    } catch (_error) {
      return {
        fiyat_esik_gun: 30,
        fiyat_anomali_yuzde: 30,
        kategori_sapma_yuzde: 100,
        ai_guven_esik: 50,
        maliyet_asim_yuzde: 120,
        ayni_yemek_hafta_limit: 2,
        ardisik_kategori_limit: 3,
        porsiyon_min_gramaj: 50,
        porsiyon_max_gramaj: 2000,
        otomatik_duzeltme_aktif: true,
      };
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Mevcut API uyumluluğu için delegasyon metodları
  async approveFinding(findingId, kullaniciId) {
    // Eski servis ile aynı mantık
    const findingResult = await query('SELECT * FROM daily_audit_findings WHERE id = $1', [findingId]);
    if (findingResult.rows.length === 0) {
      return { success: false, error: 'Bulgu bulunamadı' };
    }

    const finding = findingResult.rows[0];
    const duzeltme = finding.onerilen_duzeltme_json || {};

    let oncekiDeger = {};
    let yeniDeger = {};
    let basarili = false;

    try {
      switch (duzeltme.action) {
        case 'recete_maliyet_hesapla': {
          const m = await this.fixReceteMaliyet(duzeltme.params?.recete_id);
          basarili = m.basarili;
          oncekiDeger = m.onceki;
          yeniDeger = m.yeni;
          break;
        }
        case 'ai_fiyat_tahmini': {
          const f = await this.fixAiFiyatTahmini(duzeltme.params?.urun_id);
          basarili = f.basarili;
          oncekiDeger = f.onceki;
          yeniDeger = f.yeni;
          break;
        }
        case 'urun_eslestir': {
          const e = await this.fixUrunEslestir(duzeltme.params?.malzeme_id, duzeltme.params?.malzeme_adi);
          basarili = e.basarili;
          oncekiDeger = e.onceki;
          yeniDeger = e.yeni;
          break;
        }
        default:
          basarili = true;
      }

      if (basarili) {
        await query(
          `
          INSERT INTO daily_audit_fixes (finding_id, duzeltme_tipi, onceki_deger_json, yeni_deger_json, onaylayan_kullanici_id, basarili)
          VALUES ($1, 'manuel', $2, $3, $4, true)
        `,
          [findingId, JSON.stringify(oncekiDeger), JSON.stringify(yeniDeger), kullaniciId]
        );

        await query(
          `
          UPDATE daily_audit_findings SET durum = 'duzeltildi', isleme_alan_kullanici_id = $1, isleme_alinma_zamani = NOW()
          WHERE id = $2
        `,
          [kullaniciId, findingId]
        );

        return { success: true, message: 'Düzeltme uygulandı' };
      }

      return { success: false, error: 'Düzeltme uygulanamadı' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async rejectFinding(findingId, kullaniciId, neden) {
    await query(
      `
      UPDATE daily_audit_findings SET 
        durum = 'reddedildi', isleme_alan_kullanici_id = $1, isleme_alinma_zamani = NOW(), red_nedeni = $2
      WHERE id = $3
    `,
      [kullaniciId, neden, findingId]
    );
    return { success: true, message: 'Bulgu reddedildi' };
  }

  async getStats(daysBack = 30) {
    const result = await query('SELECT * FROM get_audit_stats($1)', [daysBack]);
    return result.rows[0] || {};
  }

  async getLatestRun() {
    const result = await query('SELECT * FROM v_audit_dashboard LIMIT 1');
    return result.rows[0] || null;
  }

  async getPendingApprovals(limit = 50) {
    const result = await query('SELECT * FROM v_audit_pending_approvals LIMIT $1', [limit]);
    return result.rows;
  }
}

// Singleton instance
const dailyAuditServiceV2 = new DailyAuditServiceV2();

export default dailyAuditServiceV2;
export { DailyAuditServiceV2 };
