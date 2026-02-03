/**
 * İhale Modülü AI Tools
 * İhale takip ve analizi için AI tool'ları
 */

import { query } from '../../database.js';
import documentStorageService from '../document-storage.js';
import logger from '../../utils/logger.js';

const ihaleTools = {
  /**
   * İhaleleri listele
   */
  list_ihaleler: {
    description: 'İhaleleri listeler. Kurum, tarih, tutar veya durum bazında filtreleyebilir.',
    parameters: {
      type: 'object',
      properties: {
        kurum: {
          type: 'string',
          description: 'Kurum/organizasyon adı (arama)',
        },
        il: {
          type: 'string',
          description: 'İl filtresi',
        },
        aktif: {
          type: 'boolean',
          description: 'Sadece aktif (tarihi geçmemiş) ihaleleri getir',
        },
        tarih_baslangic: {
          type: 'string',
          description: 'İhale tarihi başlangıç (YYYY-MM-DD)',
        },
        tarih_bitis: {
          type: 'string',
          description: 'İhale tarihi bitiş (YYYY-MM-DD)',
        },
        tutar_min: {
          type: 'number',
          description: 'Minimum tahmini bedel',
        },
        tutar_max: {
          type: 'number',
          description: 'Maksimum tahmini bedel',
        },
        arama: {
          type: 'string',
          description: 'Başlık veya açıklamada arama',
        },
        limit: {
          type: 'number',
          description: 'Maksimum kayıt sayısı',
        },
      },
    },
    handler: async (params) => {
      let sql = `
        SELECT 
          id, external_id, title, organization_name, tender_date,
          estimated_cost, city, status, created_at
        FROM tenders
        WHERE 1=1
      `;
      const queryParams = [];
      let paramIndex = 1;

      if (params.kurum) {
        sql += ` AND UPPER(organization_name) LIKE UPPER($${paramIndex++})`;
        queryParams.push(`%${params.kurum}%`);
      }

      if (params.il) {
        sql += ` AND UPPER(city) = UPPER($${paramIndex++})`;
        queryParams.push(params.il);
      }

      if (params.aktif === true) {
        sql += ` AND tender_date > NOW()`;
      } else if (params.aktif === false) {
        sql += ` AND tender_date <= NOW()`;
      }

      if (params.tarih_baslangic) {
        sql += ` AND tender_date >= $${paramIndex++}`;
        queryParams.push(params.tarih_baslangic);
      }

      if (params.tarih_bitis) {
        sql += ` AND tender_date <= $${paramIndex++}`;
        queryParams.push(params.tarih_bitis);
      }

      if (params.tutar_min !== undefined) {
        sql += ` AND estimated_cost >= $${paramIndex++}`;
        queryParams.push(params.tutar_min);
      }

      if (params.tutar_max !== undefined) {
        sql += ` AND estimated_cost <= $${paramIndex++}`;
        queryParams.push(params.tutar_max);
      }

      if (params.arama) {
        sql += ` AND (UPPER(title) LIKE UPPER($${paramIndex}) OR UPPER(description) LIKE UPPER($${paramIndex++}))`;
        queryParams.push(`%${params.arama}%`);
      }

      sql += ` ORDER BY tender_date ASC LIMIT $${paramIndex}`;
      queryParams.push(params.limit || 50);

      const result = await query(sql, queryParams);

      // Özet istatistikler
      const toplamTutar = result.rows.reduce((sum, i) => sum + parseFloat(i.estimated_cost || 0), 0);

      return {
        success: true,
        data: result.rows,
        count: result.rows.length,
        ozet: {
          ihale_sayisi: result.rows.length,
          toplam_tahmini_bedel: toplamTutar,
        },
        message: `${result.rows.length} ihale bulundu`,
      };
    },
  },

  /**
   * İhale detayı getir
   */
  get_ihale_detay: {
    description: 'Tek bir ihalenin detaylı bilgilerini getirir.',
    parameters: {
      type: 'object',
      properties: {
        ihale_id: {
          type: 'number',
          description: 'İhale ID',
        },
        external_id: {
          type: 'string',
          description: 'İhale kayıt numarası',
        },
      },
    },
    handler: async (params) => {
      let sql = 'SELECT * FROM tenders WHERE ';
      let queryParam = null;

      if (params.ihale_id) {
        sql += 'id = $1';
        queryParam = params.ihale_id;
      } else if (params.external_id) {
        sql += 'external_id = $1';
        queryParam = params.external_id;
      } else {
        return { success: false, error: 'ihale_id veya external_id gerekli' };
      }

      const result = await query(sql, [queryParam]);

      if (result.rows.length === 0) {
        return { success: false, error: 'İhale bulunamadı' };
      }

      const ihale = result.rows[0];

      // Benzer ihaleleri bul
      const benzerResult = await query(
        `
        SELECT id, title, organization_name, tender_date, estimated_cost
        FROM tenders
        WHERE id != $1
        AND organization_name = $2
        ORDER BY tender_date DESC
        LIMIT 5
      `,
        [ihale.id, ihale.organization_name]
      );

      return {
        success: true,
        data: {
          ...ihale,
          benzer_ihaleler: benzerResult.rows,
        },
      };
    },
  },

  /**
   * İhale özeti
   */
  get_ihale_ozet: {
    description: 'İhalelerin genel özet istatistiklerini getirir.',
    parameters: {
      type: 'object',
      properties: {
        donem: {
          type: 'string',
          enum: ['bu_hafta', 'bu_ay', 'bu_yil', 'gelecek_ay'],
          description: 'Dönem filtresi',
        },
      },
    },
    handler: async (params) => {
      let dateFilter = '';

      if (params.donem) {
        const _now = new Date();

        switch (params.donem) {
          case 'bu_hafta':
            dateFilter = `AND tender_date >= date_trunc('week', NOW()) AND tender_date < date_trunc('week', NOW()) + INTERVAL '7 days'`;
            break;
          case 'bu_ay':
            dateFilter = `AND tender_date >= date_trunc('month', NOW()) AND tender_date < date_trunc('month', NOW()) + INTERVAL '1 month'`;
            break;
          case 'bu_yil':
            dateFilter = `AND tender_date >= date_trunc('year', NOW())`;
            break;
          case 'gelecek_ay':
            dateFilter = `AND tender_date >= date_trunc('month', NOW()) + INTERVAL '1 month' AND tender_date < date_trunc('month', NOW()) + INTERVAL '2 months'`;
            break;
        }
      }

      const ozetResult = await query(`
        SELECT 
          COUNT(*) as toplam_ihale,
          COUNT(CASE WHEN tender_date > NOW() THEN 1 END) as aktif_ihale,
          COUNT(CASE WHEN tender_date <= NOW() THEN 1 END) as gecmis_ihale,
          COALESCE(SUM(estimated_cost), 0) as toplam_tahmini_bedel,
          COALESCE(AVG(estimated_cost), 0) as ortalama_bedel
        FROM tenders
        WHERE 1=1 ${dateFilter}
      `);

      // Kurum bazlı
      const kurumResult = await query(`
        SELECT 
          organization_name,
          COUNT(*) as ihale_sayisi,
          SUM(estimated_cost) as toplam_bedel
        FROM tenders
        WHERE 1=1 ${dateFilter}
        GROUP BY organization_name
        ORDER BY ihale_sayisi DESC
        LIMIT 10
      `);

      // İl bazlı
      const ilResult = await query(`
        SELECT 
          city,
          COUNT(*) as ihale_sayisi,
          SUM(estimated_cost) as toplam_bedel
        FROM tenders
        WHERE city IS NOT NULL ${dateFilter}
        GROUP BY city
        ORDER BY ihale_sayisi DESC
        LIMIT 10
      `);

      // Yaklaşan ihaleler
      const yaklasanResult = await query(`
        SELECT id, title, organization_name, tender_date, estimated_cost, city
        FROM tenders
        WHERE tender_date > NOW()
        ORDER BY tender_date ASC
        LIMIT 5
      `);

      return {
        success: true,
        data: {
          genel: ozetResult.rows[0],
          kurum_bazli: kurumResult.rows,
          il_bazli: ilResult.rows,
          yaklasan_ihaleler: yaklasanResult.rows,
          donem: params.donem || 'tum_zamanlar',
        },
      };
    },
  },

  /**
   * İhale takvimi
   */
  get_ihale_takvim: {
    description: 'Belirli bir dönem için ihale takvimini getirir.',
    parameters: {
      type: 'object',
      properties: {
        ay: {
          type: 'number',
          description: 'Ay (1-12)',
        },
        yil: {
          type: 'number',
          description: 'Yıl',
        },
      },
    },
    handler: async (params) => {
      const now = new Date();
      const ay = params.ay || now.getMonth() + 1;
      const yil = params.yil || now.getFullYear();

      const result = await query(
        `
        SELECT 
          id, title, organization_name, tender_date, estimated_cost, city,
          EXTRACT(DAY FROM tender_date) as gun
        FROM tenders
        WHERE EXTRACT(MONTH FROM tender_date) = $1
        AND EXTRACT(YEAR FROM tender_date) = $2
        ORDER BY tender_date ASC
      `,
        [ay, yil]
      );

      // Günlere göre grupla
      const gunlukMap = {};
      result.rows.forEach((ihale) => {
        const gun = ihale.gun;
        if (!gunlukMap[gun]) {
          gunlukMap[gun] = [];
        }
        gunlukMap[gun].push(ihale);
      });

      return {
        success: true,
        data: {
          ay,
          yil,
          toplam_ihale: result.rows.length,
          gunluk: gunlukMap,
          liste: result.rows,
        },
      };
    },
  },

  /**
   * Kurum analizi
   */
  analyze_kurum: {
    description: 'Belirli bir kurumun ihale geçmişini ve trendini analiz eder.',
    parameters: {
      type: 'object',
      properties: {
        kurum: {
          type: 'string',
          description: 'Kurum/organizasyon adı',
        },
      },
      required: ['kurum'],
    },
    handler: async (params) => {
      const ozetResult = await query(
        `
        SELECT 
          organization_name,
          COUNT(*) as toplam_ihale,
          COUNT(CASE WHEN tender_date > NOW() THEN 1 END) as aktif_ihale,
          SUM(estimated_cost) as toplam_bedel,
          AVG(estimated_cost) as ortalama_bedel,
          MIN(tender_date) as ilk_ihale,
          MAX(tender_date) as son_ihale
        FROM tenders
        WHERE UPPER(organization_name) LIKE UPPER($1)
        GROUP BY organization_name
      `,
        [`%${params.kurum}%`]
      );

      if (ozetResult.rows.length === 0) {
        return { success: false, error: 'Bu kuruma ait ihale bulunamadı' };
      }

      // Son ihaleler
      const sonIhalelerResult = await query(
        `
        SELECT id, title, tender_date, estimated_cost, city
        FROM tenders
        WHERE UPPER(organization_name) LIKE UPPER($1)
        ORDER BY tender_date DESC
        LIMIT 10
      `,
        [`%${params.kurum}%`]
      );

      // Yıllık trend
      const trendResult = await query(
        `
        SELECT 
          EXTRACT(YEAR FROM tender_date) as yil,
          COUNT(*) as ihale_sayisi,
          SUM(estimated_cost) as toplam_bedel
        FROM tenders
        WHERE UPPER(organization_name) LIKE UPPER($1)
        GROUP BY EXTRACT(YEAR FROM tender_date)
        ORDER BY yil DESC
      `,
        [`%${params.kurum}%`]
      );

      return {
        success: true,
        data: {
          kurum: ozetResult.rows[0],
          son_ihaleler: sonIhalelerResult.rows,
          yillik_trend: trendResult.rows,
        },
      };
    },
  },

  /**
   * İhale döküman analizlerini getir
   * AI Agent'ın döküman içeriklerine erişmesi için
   */
  get_ihale_dokumanlari: {
    description:
      'Bir ihalenin döküman analizlerini getirir. Teknik şartlar, birim fiyatlar, notlar ve tam metin içerir.',
    parameters: {
      type: 'object',
      properties: {
        ihale_id: {
          type: 'number',
          description: 'İhale ID',
        },
        external_id: {
          type: 'string',
          description: 'İhale kayıt numarası (örn: 2024/12345)',
        },
      },
    },
    handler: async (params) => {
      // İhale ID'yi bul
      let tenderId = params.ihale_id;

      if (!tenderId && params.external_id) {
        const tenderResult = await query('SELECT id FROM tenders WHERE external_id = $1', [params.external_id]);
        if (tenderResult.rows.length > 0) {
          tenderId = tenderResult.rows[0].id;
        }
      }

      if (!tenderId) {
        return { success: false, error: 'İhale bulunamadı. ihale_id veya external_id gerekli.' };
      }

      // Döküman analizlerini çek
      const docsResult = await query(
        `
        SELECT 
          id, original_filename, doc_type, processing_status, 
          analysis_result
        FROM documents 
        WHERE tender_id = $1 
          AND analysis_result IS NOT NULL
        ORDER BY doc_type, created_at
      `,
        [tenderId]
      );

      if (docsResult.rows.length === 0) {
        return {
          success: false,
          error: 'Bu ihale için analiz edilmiş döküman bulunamadı.',
          ihale_id: tenderId,
        };
      }

      // Analiz sonuçlarını birleştir
      const combinedAnalysis = {
        teknik_sartlar: [],
        birim_fiyatlar: [],
        notlar: [],
        tam_metin: '',
        dokuman_sayisi: docsResult.rows.length,
      };

      for (const doc of docsResult.rows) {
        const analysis = doc.analysis_result || {};

        // Teknik şartları birleştir
        if (analysis.teknik_sartlar && Array.isArray(analysis.teknik_sartlar)) {
          combinedAnalysis.teknik_sartlar.push(...analysis.teknik_sartlar);
        }

        // Birim fiyatları birleştir
        if (analysis.birim_fiyatlar && Array.isArray(analysis.birim_fiyatlar)) {
          combinedAnalysis.birim_fiyatlar.push(...analysis.birim_fiyatlar);
        }

        // Notları birleştir
        if (analysis.notlar && Array.isArray(analysis.notlar)) {
          combinedAnalysis.notlar.push(...analysis.notlar);
        }

        // Tam metinleri birleştir
        if (analysis.tam_metin) {
          combinedAnalysis.tam_metin += `\n--- ${doc.original_filename} ---\n${analysis.tam_metin}`;
        }
      }

      // Tekrarları kaldır
      combinedAnalysis.teknik_sartlar = [...new Set(combinedAnalysis.teknik_sartlar)];
      combinedAnalysis.notlar = [...new Set(combinedAnalysis.notlar)];

      // Birim fiyatlardan tekrarları kaldır
      const uniqueBirimFiyatlar = [];
      const seen = new Set();
      for (const item of combinedAnalysis.birim_fiyatlar) {
        const key = typeof item === 'object' ? JSON.stringify(item) : item;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueBirimFiyatlar.push(item);
        }
      }
      combinedAnalysis.birim_fiyatlar = uniqueBirimFiyatlar;

      return {
        success: true,
        ihale_id: tenderId,
        data: combinedAnalysis,
        ozet: {
          teknik_sart_sayisi: combinedAnalysis.teknik_sartlar.length,
          birim_fiyat_sayisi: combinedAnalysis.birim_fiyatlar.length,
          not_sayisi: combinedAnalysis.notlar.length,
          dokuman_sayisi: combinedAnalysis.dokuman_sayisi,
          tam_metin_uzunluk: combinedAnalysis.tam_metin.length,
        },
        message: `${combinedAnalysis.dokuman_sayisi} döküman analizi getirildi`,
      };
    },
  },
  /**
   * İhale dökümanlarını indir ve analiz et
   * Tek veya çoklu ihale desteği
   */
  download_and_analyze_tender: {
    description: 'İhale dökümanlarını indirir ve AI ile analiz eder. Tek ihale (tender_id) veya çoklu ihale (tender_ids) destekler. İndirme arka planda çalışır.',
    parameters: {
      type: 'object',
      properties: {
        tender_id: {
          type: 'number',
          description: 'Tek ihale ID',
        },
        tender_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Çoklu ihale ID listesi (örn: [123, 456, 789])',
        },
      },
    },
    handler: async (params) => {
      const { tender_id, tender_ids } = params;

      // ID'leri normalize et
      let ids = [];
      if (tender_ids && Array.isArray(tender_ids)) {
        ids = tender_ids;
      } else if (tender_id) {
        ids = [tender_id];
      }

      if (ids.length === 0) {
        return { success: false, error: 'tender_id veya tender_ids gerekli' };
      }

      // Maksimum 10 ihale sınırı
      if (ids.length > 10) {
        return { success: false, error: 'Maksimum 10 ihale aynı anda indirilebilir' };
      }

      const results = [];
      const errors = [];

      for (const id of ids) {
        try {
          // 1. İhalenin varlığını kontrol et
          const tenderResult = await query(
            'SELECT id, title, external_id, organization_name FROM tenders WHERE id = $1',
            [id]
          );

          if (tenderResult.rows.length === 0) {
            errors.push({ ihale_id: id, error: 'İhale bulunamadı' });
            continue;
          }

          const tender = tenderResult.rows[0];

          // 2. Mevcut döküman durumunu kontrol et
          const existingDocs = await query(
            `SELECT id, processing_status FROM documents 
             WHERE tender_id = $1 AND source_type = 'download'`,
            [id]
          );

          const analyzedCount = existingDocs.rows.filter(d => d.processing_status === 'completed').length;
          const queuedCount = existingDocs.rows.filter(d => d.processing_status === 'queued').length;
          const processingCount = existingDocs.rows.filter(d => d.processing_status === 'processing').length;

          // Zaten analiz edilmişse atla
          if (analyzedCount > 0 && queuedCount === 0 && processingCount === 0) {
            results.push({
              ihale_id: id,
              baslik: tender.title,
              status: 'already_analyzed',
              dokuman_sayisi: analyzedCount,
            });
            continue;
          }

          // Devam eden işlem varsa atla
          if (queuedCount > 0 || processingCount > 0) {
            results.push({
              ihale_id: id,
              baslik: tender.title,
              status: 'in_progress',
              kuyrukta: queuedCount,
              isleniyor: processingCount,
            });
            continue;
          }

          // 3. Dökümanları indir
          logger.info(`[AI Tool] Batch indirme: İhale #${id}`, { module: 'ihale-tools', tender_id: id });
          
          const downloadResult = await documentStorageService.downloadTenderDocuments(id);

          results.push({
            ihale_id: id,
            baslik: tender.title,
            kurum: tender.organization_name,
            status: 'download_started',
            indirilen: downloadResult.downloaded || 0,
            kuyruga_eklenen: downloadResult.queued || 0,
          });

        } catch (error) {
          logger.error(`[AI Tool] Batch indirme hatası: İhale #${id}`, { error: error.message });
          errors.push({ ihale_id: id, error: error.message });
        }
      }

      // Özet oluştur
      const downloaded = results.filter(r => r.status === 'download_started').length;
      const alreadyDone = results.filter(r => r.status === 'already_analyzed').length;
      const inProgress = results.filter(r => r.status === 'in_progress').length;

      return {
        success: true,
        ozet: {
          toplam: ids.length,
          indirme_basladi: downloaded,
          zaten_analiz_edilmis: alreadyDone,
          devam_ediyor: inProgress,
          hata: errors.length,
        },
        sonuclar: results,
        hatalar: errors.length > 0 ? errors : undefined,
        message: `${downloaded} ihale için indirme başlatıldı. ${alreadyDone} ihale zaten analiz edilmiş. Sonuçlar için get_ihale_dokumanlari kullanın.`,
      };
    },
  },

};

export default ihaleTools;
