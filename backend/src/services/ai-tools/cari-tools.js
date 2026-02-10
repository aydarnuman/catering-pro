/**
 * Cari Modülü AI Tools
 * Müşteri ve tedarikçi yönetimi için AI tool'ları
 */

import { query } from '../../database.js';

const cariTools = {
  /**
   * Carileri listele
   */
  list_cariler: {
    description: 'Cari hesapları (müşteri ve tedarikçiler) listeler. Tip, il veya bakiye bazında filtreleyebilir.',
    parameters: {
      type: 'object',
      properties: {
        tip: {
          type: 'string',
          enum: ['MÜŞTERİ', 'TEDARİKÇİ'],
          description: 'Cari tipi filtresi',
        },
        il: {
          type: 'string',
          description: 'İl filtresi',
        },
        unvan_arama: {
          type: 'string',
          description: 'Ünvan araması (kısmi eşleşme)',
        },
        bakiye_min: {
          type: 'number',
          description: 'Minimum bakiye',
        },
        bakiye_max: {
          type: 'number',
          description: 'Maksimum bakiye',
        },
        alacakli: {
          type: 'boolean',
          description: 'Sadece alacaklı olanları getir',
        },
        borclu: {
          type: 'boolean',
          description: 'Sadece borçlu olanları getir',
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
          id, unvan, tip, vergi_no, vergi_dairesi,
          yetkili, telefon, email, adres, il, ilce,
          bakiye, created_at
        FROM cariler
        WHERE 1=1
      `;
      const queryParams = [];
      let paramIndex = 1;

      if (params.tip) {
        sql += ` AND tip = $${paramIndex++}`;
        queryParams.push(params.tip);
      }

      if (params.il) {
        sql += ` AND UPPER(il) = UPPER($${paramIndex++})`;
        queryParams.push(params.il);
      }

      if (params.unvan_arama) {
        sql += ` AND UPPER(unvan) LIKE UPPER($${paramIndex++})`;
        queryParams.push(`%${params.unvan_arama}%`);
      }

      if (params.bakiye_min !== undefined) {
        sql += ` AND bakiye >= $${paramIndex++}`;
        queryParams.push(params.bakiye_min);
      }

      if (params.bakiye_max !== undefined) {
        sql += ` AND bakiye <= $${paramIndex++}`;
        queryParams.push(params.bakiye_max);
      }

      if (params.alacakli) {
        sql += ` AND bakiye > 0`;
      }

      if (params.borclu) {
        sql += ` AND bakiye < 0`;
      }

      sql += ` ORDER BY unvan LIMIT $${paramIndex}`;
      queryParams.push(params.limit || 100);

      const result = await query(sql, queryParams);

      return {
        success: true,
        data: result.rows,
        count: result.rows.length,
        message: `${result.rows.length} cari bulundu`,
      };
    },
  },

  /**
   * Cari detayı getir
   */
  get_cari_detay: {
    description: 'Tek bir carinin detaylı bilgilerini ve hareket özetini getirir.',
    parameters: {
      type: 'object',
      properties: {
        cari_id: {
          type: 'number',
          description: 'Cari ID',
        },
        unvan: {
          type: 'string',
          description: 'Cari ünvanı (arama)',
        },
        vergi_no: {
          type: 'string',
          description: 'Vergi numarası',
        },
      },
    },
    handler: async (params) => {
      let sql = 'SELECT * FROM cariler WHERE ';
      let queryParam = null;

      if (params.cari_id) {
        sql += 'id = $1';
        queryParam = params.cari_id;
      } else if (params.vergi_no) {
        sql += 'vergi_no = $1';
        queryParam = params.vergi_no;
      } else if (params.unvan) {
        sql += 'UPPER(unvan) LIKE UPPER($1) LIMIT 1';
        queryParam = `%${params.unvan}%`;
      } else {
        return { success: false, error: 'cari_id, unvan veya vergi_no gerekli' };
      }

      const result = await query(sql, [queryParam]);

      if (result.rows.length === 0) {
        return { success: false, error: 'Cari bulunamadı' };
      }

      const cari = result.rows[0];

      // Sipariş istatistikleri (tedarikçiyse)
      let siparisIstatistik = null;
      if (cari.tip === 'TEDARİKÇİ') {
        const siparisResult = await query(
          `
          SELECT 
            COUNT(*) as toplam_siparis,
            COUNT(CASE WHEN durum = 'teslim_alindi' THEN 1 END) as tamamlanan,
            COALESCE(SUM(toplam_tutar), 0) as toplam_tutar
          FROM siparisler
          WHERE tedarikci_id = $1
        `,
          [cari.id]
        );
        siparisIstatistik = siparisResult.rows[0];
      }

      return {
        success: true,
        data: {
          ...cari,
          siparis_istatistik: siparisIstatistik,
        },
      };
    },
  },

  /**
   * Cari özeti
   */
  get_cari_ozet: {
    description: 'Tüm carilerin genel özet istatistiklerini getirir.',
    parameters: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const ozetResult = await query(`
        SELECT 
          COUNT(*) as toplam_cari,
          COUNT(CASE WHEN tip = 'TEDARİKÇİ' THEN 1 END) as tedarikci_sayisi,
          COUNT(CASE WHEN tip = 'MÜŞTERİ' THEN 1 END) as musteri_sayisi,
          COUNT(CASE WHEN bakiye > 0 THEN 1 END) as alacakli_sayisi,
          COUNT(CASE WHEN bakiye < 0 THEN 1 END) as borclu_sayisi,
          SUM(CASE WHEN bakiye > 0 THEN bakiye ELSE 0 END) as toplam_alacak,
          ABS(SUM(CASE WHEN bakiye < 0 THEN bakiye ELSE 0 END)) as toplam_borc
        FROM cariler
      `);

      // En çok alım yapılan tedarikçiler
      const topTedarikciResult = await query(`
        SELECT 
          c.unvan, c.id,
          COUNT(s.id) as siparis_sayisi,
          COALESCE(SUM(s.toplam_tutar), 0) as toplam_tutar
        FROM cariler c
        LEFT JOIN siparisler s ON c.id = s.tedarikci_id
        WHERE c.tip = 'TEDARİKÇİ'
        GROUP BY c.id
        ORDER BY toplam_tutar DESC
        LIMIT 5
      `);

      return {
        success: true,
        data: {
          genel: ozetResult.rows[0],
          top_tedarikciler: topTedarikciResult.rows,
        },
      };
    },
  },

  /**
   * Yeni cari oluştur
   */
  create_cari: {
    description: 'Yeni bir cari hesap (müşteri veya tedarikçi) oluşturur.',
    parameters: {
      type: 'object',
      properties: {
        unvan: {
          type: 'string',
          description: 'Firma ünvanı (zorunlu)',
        },
        tip: {
          type: 'string',
          enum: ['MÜŞTERİ', 'TEDARİKÇİ'],
          description: 'Cari tipi (zorunlu)',
        },
        vergi_no: {
          type: 'string',
          description: 'Vergi numarası',
        },
        vergi_dairesi: {
          type: 'string',
          description: 'Vergi dairesi',
        },
        yetkili: {
          type: 'string',
          description: 'Yetkili kişi adı',
        },
        telefon: {
          type: 'string',
          description: 'Telefon numarası',
        },
        email: {
          type: 'string',
          description: 'E-posta adresi',
        },
        adres: {
          type: 'string',
          description: 'Adres',
        },
        il: {
          type: 'string',
          description: 'İl',
        },
        ilce: {
          type: 'string',
          description: 'İlçe',
        },
      },
      required: ['unvan', 'tip'],
    },
    handler: async (params) => {
      // Vergi no benzersizliğini kontrol et
      if (params.vergi_no) {
        const existing = await query('SELECT id FROM cariler WHERE vergi_no = $1', [params.vergi_no]);
        if (existing.rows.length > 0) {
          return { success: false, error: `Bu vergi numarası zaten kayıtlı` };
        }
      }

      const result = await query(
        `
        INSERT INTO cariler (unvan, tip, vergi_no, vergi_dairesi, yetkili, telefon, email, adres, il, ilce, bakiye)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)
        RETURNING *
      `,
        [
          params.unvan,
          params.tip,
          params.vergi_no || null,
          params.vergi_dairesi || null,
          params.yetkili || null,
          params.telefon || null,
          params.email || null,
          params.adres || null,
          params.il || null,
          params.ilce || null,
        ]
      );

      return {
        success: true,
        data: result.rows[0],
        message: `Cari oluşturuldu: ${params.unvan}`,
      };
    },
  },

  /**
   * Tedarikçi ara (sipariş için)
   */
  search_tedarikci: {
    description: 'Sipariş oluşturmak için tedarikçi arar.',
    parameters: {
      type: 'object',
      properties: {
        arama: {
          type: 'string',
          description: 'Arama terimi (ünvan içinde)',
        },
      },
      required: ['arama'],
    },
    handler: async (params) => {
      const result = await query(
        `
        SELECT id, unvan, telefon, email, il
        FROM cariler
        WHERE tip = 'TEDARİKÇİ' AND UPPER(unvan) LIKE UPPER($1)
        ORDER BY unvan
        LIMIT 10
      `,
        [`%${params.arama}%`]
      );

      return {
        success: true,
        data: result.rows,
        count: result.rows.length,
        message: result.rows.length > 0 ? `${result.rows.length} tedarikçi bulundu` : 'Tedarikçi bulunamadı',
      };
    },
  },
};

export default cariTools;

// ============================================================
// AUTO-DISCOVERY MANIFEST (opsiyonel — mevcut kayıt yöntemini etkilemez)
// ============================================================
export const manifest = {
  id: 'cari',
  name: 'Cari Hesap Yönetimi',
  department: 'CARİ',
  aiRole: {
    title: 'Cari Hesap Uzmanı',
    icon: '🏢',
    color: 'blue',
  },
  routes: ['/muhasebe/cariler'],
  contextType: 'cari',
  format: 'legacy',
  module: cariTools,
  version: '1.0.0',
  enabled: true,
};
