/**
 * İhale Modülü AI Tools
 * İhale takip ve analizi için AI tool'ları
 */

import { query } from '../../database.js';

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
          description: 'Kurum/organizasyon adı (arama)'
        },
        il: {
          type: 'string',
          description: 'İl filtresi'
        },
        aktif: {
          type: 'boolean',
          description: 'Sadece aktif (tarihi geçmemiş) ihaleleri getir'
        },
        tarih_baslangic: {
          type: 'string',
          description: 'İhale tarihi başlangıç (YYYY-MM-DD)'
        },
        tarih_bitis: {
          type: 'string',
          description: 'İhale tarihi bitiş (YYYY-MM-DD)'
        },
        tutar_min: {
          type: 'number',
          description: 'Minimum tahmini bedel'
        },
        tutar_max: {
          type: 'number',
          description: 'Maksimum tahmini bedel'
        },
        arama: {
          type: 'string',
          description: 'Başlık veya açıklamada arama'
        },
        limit: {
          type: 'number',
          description: 'Maksimum kayıt sayısı'
        }
      }
    },
    handler: async (params) => {
      let sql = `
        SELECT 
          id, external_id, title, organization_name, tender_date,
          estimated_cost, city, source, status, created_at
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
          toplam_tahmini_bedel: toplamTutar
        },
        message: `${result.rows.length} ihale bulundu`
      };
    }
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
          description: 'İhale ID'
        },
        external_id: {
          type: 'string',
          description: 'İhale kayıt numarası'
        }
      }
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
      const benzerResult = await query(`
        SELECT id, title, organization_name, tender_date, estimated_cost
        FROM tenders
        WHERE id != $1
        AND organization_name = $2
        ORDER BY tender_date DESC
        LIMIT 5
      `, [ihale.id, ihale.organization_name]);

      return {
        success: true,
        data: {
          ...ihale,
          benzer_ihaleler: benzerResult.rows
        }
      };
    }
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
          description: 'Dönem filtresi'
        }
      }
    },
    handler: async (params) => {
      let dateFilter = '';
      
      if (params.donem) {
        const now = new Date();
        
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
          donem: params.donem || 'tum_zamanlar'
        }
      };
    }
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
          description: 'Ay (1-12)'
        },
        yil: {
          type: 'number',
          description: 'Yıl'
        }
      }
    },
    handler: async (params) => {
      const now = new Date();
      const ay = params.ay || (now.getMonth() + 1);
      const yil = params.yil || now.getFullYear();

      const result = await query(`
        SELECT 
          id, title, organization_name, tender_date, estimated_cost, city,
          EXTRACT(DAY FROM tender_date) as gun
        FROM tenders
        WHERE EXTRACT(MONTH FROM tender_date) = $1
        AND EXTRACT(YEAR FROM tender_date) = $2
        ORDER BY tender_date ASC
      `, [ay, yil]);

      // Günlere göre grupla
      const gunlukMap = {};
      result.rows.forEach(ihale => {
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
          liste: result.rows
        }
      };
    }
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
          description: 'Kurum/organizasyon adı'
        }
      },
      required: ['kurum']
    },
    handler: async (params) => {
      const ozetResult = await query(`
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
      `, [`%${params.kurum}%`]);

      if (ozetResult.rows.length === 0) {
        return { success: false, error: 'Bu kuruma ait ihale bulunamadı' };
      }

      // Son ihaleler
      const sonIhalelerResult = await query(`
        SELECT id, title, tender_date, estimated_cost, city
        FROM tenders
        WHERE UPPER(organization_name) LIKE UPPER($1)
        ORDER BY tender_date DESC
        LIMIT 10
      `, [`%${params.kurum}%`]);

      // Yıllık trend
      const trendResult = await query(`
        SELECT 
          EXTRACT(YEAR FROM tender_date) as yil,
          COUNT(*) as ihale_sayisi,
          SUM(estimated_cost) as toplam_bedel
        FROM tenders
        WHERE UPPER(organization_name) LIKE UPPER($1)
        GROUP BY EXTRACT(YEAR FROM tender_date)
        ORDER BY yil DESC
      `, [`%${params.kurum}%`]);

      return {
        success: true,
        data: {
          kurum: ozetResult.rows[0],
          son_ihaleler: sonIhalelerResult.rows,
          yillik_trend: trendResult.rows
        }
      };
    }
  }
};

export default ihaleTools;

