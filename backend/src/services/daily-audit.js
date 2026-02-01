/**
 * Daily Audit Service
 * Günlük AI destekli denetim sistemi
 * Reçete, menü ve fiyat tutarsızlıklarını tespit eder ve düzeltir
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../database.js';
import logger from '../utils/logger.js';
import { hesaplaAktifFiyat, topluAiTahmini } from './fiyat-motor.js';

// Claude API client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Yapılandırma cache
let configCache = null;
let configCacheTime = null;
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 dakika

/**
 * Yapılandırmayı yükle (cache'li)
 */
async function getConfig() {
  if (configCache && configCacheTime && Date.now() - configCacheTime < CONFIG_CACHE_TTL) {
    return configCache;
  }

  try {
    const result = await query('SELECT config_key, config_value FROM daily_audit_config');
    const config = {};
    result.rows.forEach((row) => {
      config[row.config_key] = JSON.parse(row.config_value);
    });
    configCache = config;
    configCacheTime = Date.now();
    return config;
  } catch (error) {
    logger.warn('Audit config yüklenemedi, varsayılan değerler kullanılıyor', { error: error.message });
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

/**
 * AI Denetim Promptu
 */
const DENETIM_PROMPT = `Sen bir catering ERP sisteminin kalite kontrol uzmanısın.
Aşağıdaki denetim sonuçlarını analiz et ve her sorun için detaylı değerlendirme yap.

HER SORUN İÇİN:
1. ÖNEM SEVİYESİ: kritik/orta/dusuk
2. KÖK NEDEN: Sorunun muhtemel kaynağı
3. ÖNERİLEN DÜZELTME: Somut aksiyon (JSON formatında)
4. OTOMATİK DÜZELTME UYGUN MU: true/false (basit ve risksiz ise true)
5. ETKİ ANALİZİ: Düzeltilmezse ne olur

KURALLAR:
- Otomatik düzeltme SADECE şunlar için uygun:
  * Eksik maliyet hesaplama (recete_maliyet_hesapla)
  * Fiyatsız ürünlere AI tahmini (ai_fiyat_tahmini)
  * Birim dönüşümü düzeltme (birim_donusum)
  * Malzeme-ürün kartı eşleştirme (urun_eslestir)

- Manuel onay GEREKLİ:
  * Fiyat değişiklikleri
  * Menü değişiklikleri  
  * Reçete silme/büyük değişiklik
  * Tedarikçi değişiklikleri

- ÖNEM SEVİYELERİ:
  * kritik: Veri kaybı veya yanlış maliyet riski
  * orta: Performans veya tutarlılık sorunları
  * dusuk: Kozmetik veya önemsiz tutarsızlıklar

JSON formatında yanıt ver:
{
  "findings": [
    {
      "temp_id": <bulgu_temp_id>,
      "onem": "kritik|orta|dusuk",
      "kok_neden": "açıklama",
      "onerilen_duzeltme": {
        "action": "eylem_kodu",
        "params": {...}
      },
      "otomatik_uygun": true|false,
      "etki": "düzeltilmezse ne olur"
    }
  ],
  "genel_degerlendirme": "sistemin genel durumu hakkında 2-3 cümle",
  "oncelikli_aksiyonlar": ["öncelikli aksiyon 1", "öncelikli aksiyon 2"]
}`;

class DailyAuditService {
  constructor() {
    this.currentRunId = null;
    this.findings = [];
    this.stats = {
      recete: 0,
      menu: 0,
      fiyat: 0,
      otomatik: 0,
      manuel: 0,
    };
  }

  /**
   * Tam denetim çalıştır
   * @param {Object} options - { skipAI: boolean } AI analizini atla
   */
  async runFullAudit(options = {}) {
    const { skipAI = false, runId: existingRunId } = options;
    logger.info('[DailyAudit] Günlük denetim başlatılıyor...', { skipAI });

    try {
      // Denetim kaydı: dışarıdan runId verilmişse onu kullan, yoksa oluştur
      if (existingRunId) {
        this.currentRunId = existingRunId;
      } else {
        const runResult = await query(`
          INSERT INTO daily_audit_runs (durum) VALUES ('running')
          RETURNING id
        `);
        this.currentRunId = runResult.rows[0].id;
      }
      this.findings = [];
      this.stats = { recete: 0, menu: 0, fiyat: 0, otomatik: 0, manuel: 0 };

      // 1. Reçete denetimi
      logger.info('[DailyAudit] Reçete denetimi başlıyor...', { runId: this.currentRunId });
      const t1 = Date.now();
      await this.auditReceteler();
      logger.info('[DailyAudit] Reçete denetimi bitti', { sureSaniye: ((Date.now() - t1) / 1000).toFixed(1), bulgu: this.stats.recete });

      // 2. Menü denetimi
      logger.info('[DailyAudit] Menü denetimi başlıyor...');
      const t2 = Date.now();
      await this.auditMenuler();
      logger.info('[DailyAudit] Menü denetimi bitti', { sureSaniye: ((Date.now() - t2) / 1000).toFixed(1), bulgu: this.stats.menu });

      // 3. Fiyat denetimi
      logger.info('[DailyAudit] Fiyat denetimi başlıyor...');
      const t3 = Date.now();
      await this.auditFiyatlar();
      logger.info('[DailyAudit] Fiyat denetimi bitti', { sureSaniye: ((Date.now() - t3) / 1000).toFixed(1), bulgu: this.stats.fiyat });

      // 4. AI analizi (opsiyonel - skipAI ile atlanabilir)
      if (!skipAI) {
        logger.info('[DailyAudit] AI analizi başlıyor...');
        await this.runAIAnalysis();
      } else {
        logger.info('[DailyAudit] AI analizi atlandı (skipAI=true)');
      }

      // 5. Otomatik düzeltmeler
      const config = await getConfig();
      if (config.otomatik_duzeltme_aktif) {
        logger.info('[DailyAudit] Otomatik düzeltmeler uygulanıyor...');
        await this.applyAutoFixes();
      }

      // Denetim kaydını güncelle
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
          fiyat_sorun = $6
        WHERE id = $7
      `,
        [
          this.stats.recete + this.stats.menu + this.stats.fiyat,
          this.stats.otomatik,
          this.stats.manuel,
          this.stats.recete,
          this.stats.menu,
          this.stats.fiyat,
          this.currentRunId,
        ]
      );

      logger.info('[DailyAudit] Günlük denetim tamamlandı', {
        runId: this.currentRunId,
        stats: this.stats,
      });

      return {
        success: true,
        runId: this.currentRunId,
        stats: this.stats,
      };
    } catch (error) {
      logger.error('[DailyAudit] Denetim hatası', { error: error.message, stack: error.stack });

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

  /**
   * Reçete Denetimi
   */
  async auditReceteler() {
    const config = await getConfig();

    // 1. Malzeme fiyatı eksik reçeteler
    const eksikFiyatResult = await query(`
      SELECT 
        r.id, r.kod, r.ad,
        COUNT(rm.id) as malzeme_sayisi,
        COUNT(CASE WHEN rm.birim_fiyat IS NULL OR rm.birim_fiyat = 0 THEN 1 END) as fiyatsiz_malzeme
      FROM receteler r
      JOIN recete_malzemeler rm ON rm.recete_id = r.id
      WHERE r.aktif = true
      GROUP BY r.id, r.kod, r.ad
      HAVING COUNT(CASE WHEN rm.birim_fiyat IS NULL OR rm.birim_fiyat = 0 THEN 1 END) > 0
    `);

    for (const row of eksikFiyatResult.rows) {
      await this.addFinding({
        kategori: 'recete',
        sorun_tipi: 'eksik_malzeme_fiyat',
        ilgili_tablo: 'receteler',
        ilgili_id: row.id,
        ilgili_kod: row.kod,
        ilgili_ad: row.ad,
        aciklama: `"${row.ad}" reçetesinde ${row.fiyatsiz_malzeme}/${row.malzeme_sayisi} malzemenin fiyatı eksik`,
        detay: { fiyatsiz_malzeme: row.fiyatsiz_malzeme, toplam_malzeme: row.malzeme_sayisi },
        otomatik_uygun: true,
        onerilen_duzeltme: { action: 'recete_maliyet_hesapla', params: { recete_id: row.id } },
      });
    }

    // 2. Tahmini maliyet hesaplanmamış reçeteler
    const maliyetYokResult = await query(`
      SELECT r.id, r.kod, r.ad
      FROM receteler r
      WHERE r.aktif = true
        AND (r.tahmini_maliyet IS NULL OR r.tahmini_maliyet = 0)
        AND EXISTS (SELECT 1 FROM recete_malzemeler rm WHERE rm.recete_id = r.id)
    `);

    for (const row of maliyetYokResult.rows) {
      await this.addFinding({
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
    }

    // 3. Anormal maliyet (kategori ortalamasından sapma)
    const anormalMaliyetResult = await query(`
      WITH kategori_ort AS (
        SELECT 
          r.kategori_id,
          AVG(r.tahmini_maliyet) as ort_maliyet,
          STDDEV(r.tahmini_maliyet) as std_maliyet
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
    `);

    for (const row of anormalMaliyetResult.rows) {
      await this.addFinding({
        kategori: 'recete',
        sorun_tipi: 'anormal_maliyet',
        ilgili_tablo: 'receteler',
        ilgili_id: row.id,
        ilgili_kod: row.kod,
        ilgili_ad: row.ad,
        aciklama: `"${row.ad}" maliyeti (${row.tahmini_maliyet}₺) kategori ortalamasından %${Math.round(row.sapma_yuzde)} sapıyor`,
        detay: {
          maliyet: parseFloat(row.tahmini_maliyet),
          kategori_ortalama: parseFloat(row.ort_maliyet),
          sapma_yuzde: Math.round(row.sapma_yuzde),
        },
        otomatik_uygun: false, // Manuel kontrol gerekli
      });
    }

    // 4. Malzeme-ürün kartı eşleşmesi eksik
    const eslesmemisResult = await query(`
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
      LIMIT 100
    `);

    for (const row of eslesmemisResult.rows) {
      await this.addFinding({
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
    }

    // 5. Toplam gramaj mantık kontrolü
    const gramajResult = await query(`
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
    `, [config.porsiyon_min_gramaj, config.porsiyon_max_gramaj]);

    for (const row of gramajResult.rows) {
      const porsiyonGramaj = row.toplam_gramaj / (row.porsiyon_miktar || 1);
      await this.addFinding({
        kategori: 'recete',
        sorun_tipi: 'anormal_gramaj',
        ilgili_tablo: 'receteler',
        ilgili_id: row.id,
        ilgili_kod: row.kod,
        ilgili_ad: row.ad,
        aciklama: `"${row.ad}" porsiyon gramajı (${Math.round(porsiyonGramaj)}g) normal aralık dışında (${config.porsiyon_min_gramaj}-${config.porsiyon_max_gramaj}g)`,
        detay: {
          toplam_gramaj: Math.round(row.toplam_gramaj),
          porsiyon_miktar: row.porsiyon_miktar,
          porsiyon_gramaj: Math.round(porsiyonGramaj),
        },
        otomatik_uygun: false,
      });
    }

    this.stats.recete = this.findings.filter((f) => f.kategori === 'recete').length;
    logger.info('[DailyAudit] Reçete denetimi tamamlandı', { sorunSayisi: this.stats.recete });
  }

  /**
   * Menü Denetimi
   */
  async auditMenuler() {
    const config = await getConfig();

    // 1. Aynı yemek aynı haftada tekrar
    const tekrarResult = await query(`
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
      SELECT * FROM haftalik ORDER BY hafta DESC, tekrar_sayisi DESC
      LIMIT 50
    `, [config.ayni_yemek_hafta_limit]);

    for (const row of tekrarResult.rows) {
      await this.addFinding({
        kategori: 'menu',
        sorun_tipi: 'tekrar_yemek',
        ilgili_tablo: 'menu_planlari',
        ilgili_id: row.menu_plan_id,
        ilgili_ad: `${row.proje_ad} - ${row.recete_ad}`,
        aciklama: `"${row.proje_ad}" projesinde "${row.recete_ad}" yemeği aynı hafta içinde ${row.tekrar_sayisi} kez tekrarlanmış`,
        detay: {
          proje_id: row.proje_id,
          recete_id: row.recete_id,
          hafta: row.hafta,
          tekrar_sayisi: row.tekrar_sayisi,
        },
        otomatik_uygun: false,
      });
    }

    // 2. Aynı kategoriden ardışık günler
    const ardisikResult = await query(`
      WITH gunluk_kategori AS (
        SELECT 
          mpo.menu_plan_id,
          mp.proje_id,
          p.ad as proje_ad,
          mpo.tarih,
          rk.kod as kategori_kod,
          rk.ad as kategori_ad,
          LAG(rk.kod) OVER (PARTITION BY mpo.menu_plan_id ORDER BY mpo.tarih) as onceki_kategori,
          LAG(rk.kod, 2) OVER (PARTITION BY mpo.menu_plan_id ORDER BY mpo.tarih) as onceki2_kategori
        FROM menu_ogun_yemekleri moy
        JOIN menu_plan_ogunleri mpo ON mpo.id = moy.menu_ogun_id
        JOIN menu_planlari mp ON mp.id = mpo.menu_plan_id
        JOIN projeler p ON p.id = mp.proje_id
        JOIN receteler r ON r.id = moy.recete_id
        JOIN recete_kategoriler rk ON rk.id = r.kategori_id
        WHERE mpo.tarih >= CURRENT_DATE - INTERVAL '30 days'
          AND rk.kod = 'ana_yemek'
      )
      SELECT DISTINCT menu_plan_id, proje_id, proje_ad, tarih, kategori_ad
      FROM gunluk_kategori
      WHERE kategori_kod = onceki_kategori AND kategori_kod = onceki2_kategori
      LIMIT 20
    `);

    for (const row of ardisikResult.rows) {
      await this.addFinding({
        kategori: 'menu',
        sorun_tipi: 'ardisik_kategori',
        ilgili_tablo: 'menu_planlari',
        ilgili_id: row.menu_plan_id,
        ilgili_ad: row.proje_ad,
        aciklama: `"${row.proje_ad}" projesinde ${row.tarih} civarında 3+ gün ardışık aynı kategori`,
        detay: { proje_id: row.proje_id, tarih: row.tarih, kategori: row.kategori_ad },
        otomatik_uygun: false,
      });
    }

    // 3. Eksik öğünler (planlanan ama boş)
    const eksikOgunResult = await query(`
      SELECT 
        mpo.id,
        mpo.menu_plan_id,
        mp.ad as plan_ad,
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
      LIMIT 30
    `);

    for (const row of eksikOgunResult.rows) {
      await this.addFinding({
        kategori: 'menu',
        sorun_tipi: 'eksik_ogun',
        ilgili_tablo: 'menu_plan_ogunleri',
        ilgili_id: row.id,
        ilgili_ad: `${row.proje_ad} - ${row.tarih}`,
        aciklama: `"${row.proje_ad}" projesinde ${row.tarih} tarihli ${row.ogun_ad} öğünü boş`,
        detay: { plan_id: row.menu_plan_id, tarih: row.tarih, ogun: row.ogun_ad },
        otomatik_uygun: false,
      });
    }

    // 4. Maliyet aşımı (hedef bütçe: proje bazında veya varsayılan 50 TL)
    const maliyetAsimResult = await query(`
      SELECT 
        mp.id,
        mp.ad,
        p.ad as proje_ad,
        mp.toplam_maliyet,
        mp.gunluk_ortalama_maliyet,
        mp.porsiyon_ortalama_maliyet,
        50 as hedef_butce  -- Varsayılan porsiyon bütçesi (TL)
      FROM menu_planlari mp
      JOIN projeler p ON p.id = mp.proje_id
      WHERE mp.porsiyon_ortalama_maliyet > 0
        AND mp.durum IN ('taslak', 'aktif')
    `);

    for (const row of maliyetAsimResult.rows) {
      if (row.porsiyon_ortalama_maliyet > row.hedef_butce * (config.maliyet_asim_yuzde / 100)) {
        await this.addFinding({
          kategori: 'menu',
          sorun_tipi: 'maliyet_asimi',
          ilgili_tablo: 'menu_planlari',
          ilgili_id: row.id,
          ilgili_ad: `${row.proje_ad} - ${row.ad}`,
          aciklama: `"${row.proje_ad}" menü maliyeti hedef bütçeyi aşıyor`,
          detay: {
            mevcut_maliyet: row.porsiyon_ortalama_maliyet,
            hedef_butce: row.hedef_butce,
            asim_yuzde: Math.round((row.porsiyon_ortalama_maliyet / row.hedef_butce) * 100),
          },
          otomatik_uygun: false,
        });
      }
    }

    this.stats.menu = this.findings.filter((f) => f.kategori === 'menu').length;
    logger.info('[DailyAudit] Menü denetimi tamamlandı', { sorunSayisi: this.stats.menu });
  }

  /**
   * Fiyat Denetimi
   */
  async auditFiyatlar() {
    const config = await getConfig();

    // 1. 30+ gün güncellenmemiş fiyatlar
    const eskiFiyatResult = await query(`
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
      LIMIT 100
    `, [config.fiyat_esik_gun]);

    for (const row of eskiFiyatResult.rows) {
      await this.addFinding({
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
          gun_farki: Math.round(row.gun_farki),
        },
        otomatik_uygun: false, // Fiyat değişikliği manuel onay gerektirir
      });
    }

    // 2. Ani fiyat değişimi (son 7 günde %30+)
    const anomaliResult = await query(`
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
      LIMIT 50
    `, [config.fiyat_anomali_yuzde]);

    for (const row of anomaliResult.rows) {
      await this.addFinding({
        kategori: 'fiyat',
        sorun_tipi: 'fiyat_anomali',
        ilgili_tablo: 'urun_kartlari',
        ilgili_id: row.id,
        ilgili_kod: row.kod,
        ilgili_ad: row.ad,
        aciklama: `"${row.ad}" fiyatında ani değişim: ${row.onceki_fiyat}₺ → ${row.yeni_fiyat}₺ (%${Math.round(row.degisim_yuzde)})`,
        detay: {
          onceki_fiyat: parseFloat(row.onceki_fiyat),
          yeni_fiyat: parseFloat(row.yeni_fiyat),
          degisim_yuzde: Math.round(row.degisim_yuzde),
        },
        otomatik_uygun: false,
      });
    }

    // 3. Kategori ortalamasından sapma
    const sapmaResult = await query(`
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
      LIMIT 50
    `, [config.kategori_sapma_yuzde]);

    for (const row of sapmaResult.rows) {
      await this.addFinding({
        kategori: 'fiyat',
        sorun_tipi: 'kategori_sapma',
        ilgili_tablo: 'urun_kartlari',
        ilgili_id: row.id,
        ilgili_kod: row.kod,
        ilgili_ad: row.ad,
        aciklama: `"${row.ad}" fiyatı (${row.aktif_fiyat}₺) kategori ortalamasından %${Math.round(row.sapma_yuzde)} sapıyor`,
        detay: {
          mevcut_fiyat: parseFloat(row.aktif_fiyat),
          kategori_ortalama: parseFloat(row.ort_fiyat),
          sapma_yuzde: Math.round(row.sapma_yuzde),
        },
        otomatik_uygun: false,
      });
    }

    // 4. AI tahmini güven skoru düşük
    const dusukGuvenResult = await query(`
      SELECT 
        uk.id, uk.kod, uk.ad,
        uk.aktif_fiyat,
        uk.aktif_fiyat_guven
      FROM urun_kartlari uk
      WHERE uk.aktif = true
        AND uk.aktif_fiyat_tipi = 'AI_TAHMINI'
        AND uk.aktif_fiyat_guven < $1
      LIMIT 50
    `, [config.ai_guven_esik]);

    for (const row of dusukGuvenResult.rows) {
      await this.addFinding({
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
    }

    // 5. Fiyatsız aktif ürünler
    const fiyatsizResult = await query(`
      SELECT uk.id, uk.kod, uk.ad, kat.ad as kategori_ad
      FROM urun_kartlari uk
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      WHERE uk.aktif = true
        AND (uk.aktif_fiyat IS NULL OR uk.aktif_fiyat = 0)
      LIMIT 100
    `);

    for (const row of fiyatsizResult.rows) {
      await this.addFinding({
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
    }

    // 6. Tedarikçi sözleşme süresi dolmuş
    const sozlesmeSonResult = await query(`
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
      LIMIT 50
    `);

    for (const row of sozlesmeSonResult.rows) {
      await this.addFinding({
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
    }

    this.stats.fiyat = this.findings.filter((f) => f.kategori === 'fiyat').length;
    logger.info('[DailyAudit] Fiyat denetimi tamamlandı', { sorunSayisi: this.stats.fiyat });
  }

  /**
   * Finding ekle
   */
  async addFinding(finding) {
    this.findings.push(finding);
  }

  /**
   * AI Analizi - Batch işleme (max 20 bulgu/batch, 90sn timeout/batch)
   */
  async runAIAnalysis() {
    if (this.findings.length === 0) {
      logger.info('[DailyAudit] AI: Analiz edilecek bulgu yok');
      return;
    }

    const BATCH_SIZE = 20; // Daha küçük batch = daha hızlı yanıt
    const AI_TIMEOUT_MS = 90_000; // Batch başına 90 saniye
    const batches = [];

    for (let i = 0; i < this.findings.length; i += BATCH_SIZE) {
      batches.push(this.findings.slice(i, i + BATCH_SIZE));
    }

    logger.info('[DailyAudit] AI: Başlıyor', {
      toplamBulgu: this.findings.length,
      batchSayisi: batches.length,
      runId: this.currentRunId,
    });

    let genelDegerlendirme = '';
    const oncelikliAksiyonlar = [];
    let basariliBatch = 0;
    let hataliBatch = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const startIdx = batchIndex * BATCH_SIZE;

      const bulgularOzet = batch.map((f, i) => ({
        temp_id: startIdx + i,
        kategori: f.kategori,
        sorun_tipi: f.sorun_tipi,
        aciklama: f.aciklama,
        detay: f.detay,
      }));

      const userContent = `Batch ${batchIndex + 1}/${batches.length}: Aşağıdaki ${batch.length} adet denetim bulgusunu analiz et:\n\n${JSON.stringify(bulgularOzet, null, 2)}`;
      const payloadChars = userContent.length;

      logger.info('[DailyAudit] AI: Batch isteği gönderiliyor', {
        batch: `${batchIndex + 1}/${batches.length}`,
        bulguSayisi: batch.length,
        payloadKarakter: payloadChars,
      });

      const batchStart = Date.now();
      let aborted = false;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        aborted = true;
        controller.abort();
      }, AI_TIMEOUT_MS);

      try {
        const response = await anthropic.messages.create(
          {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            system: DENETIM_PROMPT,
            messages: [{ role: 'user', content: userContent }],
          },
          { signal: controller.signal }
        );

        clearTimeout(timeoutId);
        const sureMs = Date.now() - batchStart;

        if (!response?.content?.[0]?.text) {
          logger.warn('[DailyAudit] AI: Boş yanıt', { batch: batchIndex + 1, sureMs });
          hataliBatch++;
          continue;
        }

        const content = response.content[0].text;
        const jsonMatch = content.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
          logger.warn('[DailyAudit] AI: JSON bulunamadı', {
            batch: batchIndex + 1,
            yanitUzunluk: content?.length ?? 0,
            sureMs,
          });
          hataliBatch++;
          continue;
        }

        const aiResult = JSON.parse(jsonMatch[0]);
        const findingsCount = (aiResult.findings || []).length;

        for (const aiF of aiResult.findings || []) {
          const finding = this.findings[aiF.temp_id];
          if (finding) {
            finding.ai_analizi = aiF.etki;
            finding.ai_kok_neden = aiF.kok_neden;
            finding.onem_seviyesi = aiF.onem;
            if (aiF.onerilen_duzeltme) finding.onerilen_duzeltme = aiF.onerilen_duzeltme;
            if (typeof aiF.otomatik_uygun === 'boolean') finding.otomatik_uygun = aiF.otomatik_uygun;
          }
        }

        if (batchIndex === 0 && aiResult.genel_degerlendirme) {
          genelDegerlendirme = aiResult.genel_degerlendirme;
        }
        if (aiResult.oncelikli_aksiyonlar) {
          oncelikliAksiyonlar.push(...aiResult.oncelikli_aksiyonlar);
        }

        basariliBatch++;
        logger.info('[DailyAudit] AI: Batch tamamlandı', {
          batch: `${batchIndex + 1}/${batches.length}`,
          sureSaniye: (sureMs / 1000).toFixed(1),
          analizEdilen: findingsCount,
        });
      } catch (error) {
        clearTimeout(timeoutId);
        const sureMs = Date.now() - batchStart;
        hataliBatch++;
        const isTimeout = aborted || error.name === 'AbortError';
        logger.error('[DailyAudit] AI: Batch hatası', {
          batch: `${batchIndex + 1}/${batches.length}`,
          hata: error.message,
          timeout: isTimeout,
          sureMs,
        });
      }

      if (batchIndex < batches.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    if (genelDegerlendirme || oncelikliAksiyonlar.length > 0) {
      await query(
        `UPDATE daily_audit_runs SET ai_genel_degerlendirme = $1, ai_oncelikli_aksiyonlar = $2 WHERE id = $3`,
        [genelDegerlendirme, JSON.stringify(oncelikliAksiyonlar.slice(0, 10)), this.currentRunId]
      );
    }

    logger.info('[DailyAudit] AI: Tüm analiz bitti', {
      runId: this.currentRunId,
      basariliBatch,
      hataliBatch,
      toplamBulgu: this.findings.length,
    });

    // Bulguları veritabanına kaydet
    logger.info('[DailyAudit] Bulgular DB\'ye yazılıyor...', { adet: this.findings.length });
    const tDb = Date.now();
    for (const finding of this.findings) {
      await query(
        `
        INSERT INTO daily_audit_findings (
          audit_run_id, kategori, sorun_tipi, onem_seviyesi,
          ilgili_tablo, ilgili_id, ilgili_kod, ilgili_ad,
          aciklama, detay_json, ai_analizi, ai_kok_neden,
          onerilen_duzeltme_json, otomatik_duzeltme_uygun
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `,
        [
          this.currentRunId,
          finding.kategori,
          finding.sorun_tipi,
          finding.onem_seviyesi || 'orta',
          finding.ilgili_tablo,
          finding.ilgili_id,
          finding.ilgili_kod,
          finding.ilgili_ad,
          finding.aciklama,
          JSON.stringify(finding.detay || {}),
          finding.ai_analizi,
          finding.ai_kok_neden,
          JSON.stringify(finding.onerilen_duzeltme || {}),
          finding.otomatik_uygun || false,
        ]
      );
    }
    logger.info('[DailyAudit] Bulgular DB\'ye yazıldı', { sureSaniye: ((Date.now() - tDb) / 1000).toFixed(1) });
  }

  /**
   * Otomatik düzeltmeleri uygula
   */
  async applyAutoFixes() {
    // Otomatik düzeltme uygun bulguları al
    const result = await query(`
      SELECT id, sorun_tipi, ilgili_id, ilgili_tablo, onerilen_duzeltme_json, detay_json
      FROM daily_audit_findings
      WHERE audit_run_id = $1
        AND otomatik_duzeltme_uygun = true
        AND durum = 'beklemede'
    `, [this.currentRunId]);

    for (const finding of result.rows) {
      try {
        const duzeltme = finding.onerilen_duzeltme_json || {};
        let basarili = false;
        let oncekiDeger = {};
        let yeniDeger = {};

        switch (duzeltme.action) {
          case 'recete_maliyet_hesapla':
            const maliyetSonuc = await this.fixReceteMaliyet(duzeltme.params?.recete_id);
            basarili = maliyetSonuc.basarili;
            oncekiDeger = maliyetSonuc.onceki;
            yeniDeger = maliyetSonuc.yeni;
            break;

          case 'ai_fiyat_tahmini':
            const fiyatSonuc = await this.fixAiFiyatTahmini(duzeltme.params?.urun_id);
            basarili = fiyatSonuc.basarili;
            oncekiDeger = fiyatSonuc.onceki;
            yeniDeger = fiyatSonuc.yeni;
            break;

          case 'urun_eslestir':
            const eslestirmeSonuc = await this.fixUrunEslestir(
              duzeltme.params?.malzeme_id,
              duzeltme.params?.malzeme_adi
            );
            basarili = eslestirmeSonuc.basarili;
            oncekiDeger = eslestirmeSonuc.onceki;
            yeniDeger = eslestirmeSonuc.yeni;
            break;

          default:
            logger.warn('[DailyAudit] Bilinmeyen düzeltme aksiyonu', { action: duzeltme.action });
            continue;
        }

        if (basarili) {
          // Düzeltme kaydı oluştur
          await query(
            `
            INSERT INTO daily_audit_fixes (
              finding_id, duzeltme_tipi, onceki_deger_json, yeni_deger_json, basarili
            ) VALUES ($1, 'otomatik', $2, $3, true)
          `,
            [finding.id, JSON.stringify(oncekiDeger), JSON.stringify(yeniDeger)]
          );

          // Bulgu durumunu güncelle
          await query(`UPDATE daily_audit_findings SET durum = 'otomatik_duzeltildi' WHERE id = $1`, [finding.id]);

          this.stats.otomatik++;
        }
      } catch (error) {
        logger.error('[DailyAudit] Otomatik düzeltme hatası', {
          findingId: finding.id,
          error: error.message,
        });
      }
    }

    // Manuel onay bekleyenleri say
    const manuelResult = await query(`
      SELECT COUNT(*) as sayi FROM daily_audit_findings
      WHERE audit_run_id = $1 AND durum = 'beklemede'
    `, [this.currentRunId]);

    this.stats.manuel = parseInt(manuelResult.rows[0]?.sayi, 10) || 0;

    logger.info('[DailyAudit] Otomatik düzeltmeler tamamlandı', {
      otomatik: this.stats.otomatik,
      manuelBekleyen: this.stats.manuel,
    });
  }

  /**
   * Reçete maliyeti düzeltme
   */
  async fixReceteMaliyet(receteId) {
    const oncekiResult = await query('SELECT tahmini_maliyet FROM receteler WHERE id = $1', [receteId]);
    const onceki = { tahmini_maliyet: oncekiResult.rows[0]?.tahmini_maliyet };

    // Malzeme fiyatlarını hesapla
    const malzemeResult = await query(`
      SELECT 
        rm.miktar, rm.birim,
        COALESCE(uk.aktif_fiyat, uk.son_alis_fiyati, 0) as birim_fiyat
      FROM recete_malzemeler rm
      LEFT JOIN urun_kartlari uk ON uk.id = COALESCE(rm.urun_kart_id, rm.stok_kart_id)
      WHERE rm.recete_id = $1
    `, [receteId]);

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

    // Porsiyon başına maliyet
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

  /**
   * AI fiyat tahmini düzeltme
   */
  async fixAiFiyatTahmini(urunId) {
    const oncekiResult = await query('SELECT aktif_fiyat, aktif_fiyat_tipi FROM urun_kartlari WHERE id = $1', [urunId]);
    const onceki = {
      aktif_fiyat: oncekiResult.rows[0]?.aktif_fiyat,
      aktif_fiyat_tipi: oncekiResult.rows[0]?.aktif_fiyat_tipi,
    };

    const sonuc = await hesaplaAktifFiyat(urunId, { aiTahminiKullan: true });

    if (sonuc.fiyat) {
      return {
        basarili: true,
        onceki,
        yeni: { aktif_fiyat: sonuc.fiyat, aktif_fiyat_tipi: sonuc.tip },
      };
    }

    return { basarili: false, onceki, yeni: {} };
  }

  /**
   * Ürün eşleştirme düzeltme
   */
  async fixUrunEslestir(malzemeId, malzemeAdi) {
    // En benzer ürün kartını bul
    const eslestirmeResult = await query(`
      SELECT id, ad
      FROM urun_kartlari
      WHERE aktif = true
        AND ad ILIKE $1
      ORDER BY 
        CASE WHEN ad ILIKE $2 THEN 0 ELSE 1 END,
        LENGTH(ad)
      LIMIT 1
    `, [`%${malzemeAdi}%`, malzemeAdi]);

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

  /**
   * Manuel onay
   */
  async approveFinding(findingId, kullaniciId) {
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
        case 'recete_maliyet_hesapla':
          const maliyetSonuc = await this.fixReceteMaliyet(duzeltme.params?.recete_id);
          basarili = maliyetSonuc.basarili;
          oncekiDeger = maliyetSonuc.onceki;
          yeniDeger = maliyetSonuc.yeni;
          break;

        case 'ai_fiyat_tahmini':
          const fiyatSonuc = await this.fixAiFiyatTahmini(duzeltme.params?.urun_id);
          basarili = fiyatSonuc.basarili;
          oncekiDeger = fiyatSonuc.onceki;
          yeniDeger = fiyatSonuc.yeni;
          break;

        case 'urun_eslestir':
          const eslestirmeSonuc = await this.fixUrunEslestir(duzeltme.params?.malzeme_id, duzeltme.params?.malzeme_adi);
          basarili = eslestirmeSonuc.basarili;
          oncekiDeger = eslestirmeSonuc.onceki;
          yeniDeger = eslestirmeSonuc.yeni;
          break;

        default:
          // Genel onay (düzeltme uygulanmadan)
          basarili = true;
      }

      if (basarili) {
        await query(
          `
          INSERT INTO daily_audit_fixes (
            finding_id, duzeltme_tipi, onceki_deger_json, yeni_deger_json, 
            onaylayan_kullanici_id, basarili
          ) VALUES ($1, 'manuel', $2, $3, $4, true)
        `,
          [findingId, JSON.stringify(oncekiDeger), JSON.stringify(yeniDeger), kullaniciId]
        );

        await query(
          `
          UPDATE daily_audit_findings SET 
            durum = 'duzeltildi',
            isleme_alan_kullanici_id = $1,
            isleme_alinma_zamani = NOW()
          WHERE id = $2
        `,
          [kullaniciId, findingId]
        );

        return { success: true, message: 'Düzeltme uygulandı' };
      }

      return { success: false, error: 'Düzeltme uygulanamadı' };
    } catch (error) {
      logger.error('[DailyAudit] Manuel onay hatası', { findingId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Manuel red
   */
  async rejectFinding(findingId, kullaniciId, neden) {
    await query(
      `
      UPDATE daily_audit_findings SET 
        durum = 'reddedildi',
        isleme_alan_kullanici_id = $1,
        isleme_alinma_zamani = NOW(),
        red_nedeni = $2
      WHERE id = $3
    `,
      [kullaniciId, neden, findingId]
    );

    return { success: true, message: 'Bulgu reddedildi' };
  }

  /**
   * İstatistikleri getir
   */
  async getStats(daysBback = 30) {
    const result = await query('SELECT * FROM get_audit_stats($1)', [daysBback]);
    return result.rows[0] || {};
  }

  /**
   * Son denetim sonuçlarını getir
   */
  async getLatestRun() {
    const result = await query(`
      SELECT * FROM v_audit_dashboard
      LIMIT 1
    `);
    return result.rows[0] || null;
  }

  /**
   * Bekleyen onayları getir
   */
  async getPendingApprovals(limit = 50) {
    const result = await query(`
      SELECT * FROM v_audit_pending_approvals
      LIMIT $1
    `, [limit]);
    return result.rows;
  }
}

// Singleton instance
const dailyAuditService = new DailyAuditService();

export default dailyAuditService;
export { DailyAuditService };
