/**
 * Fatura Modülü AI Tools
 * Fatura ve e-fatura yönetimi için AI tool'ları
 */

import { query } from '../../database.js';
import { faturaKalemleriClient } from '../fatura-kalemleri-client.js';

const faturaTools = {
  
  /**
   * Faturaları listele (Uyumsoft e-fatura)
   */
  list_efaturalar: {
    description: 'Uyumsoft e-faturalarını listeler. Tarih, tedarikçi veya tutar bazında filtreleyebilir.',
    parameters: {
      type: 'object',
      properties: {
        tedarikci_vkn: {
          type: 'string',
          description: 'Tedarikçi vergi numarası'
        },
        tedarikci_unvan: {
          type: 'string',
          description: 'Tedarikçi ünvanı (arama)'
        },
        tarih_baslangic: {
          type: 'string',
          description: 'Başlangıç tarihi (YYYY-MM-DD)'
        },
        tarih_bitis: {
          type: 'string',
          description: 'Bitiş tarihi (YYYY-MM-DD)'
        },
        tutar_min: {
          type: 'number',
          description: 'Minimum tutar'
        },
        tutar_max: {
          type: 'number',
          description: 'Maksimum tutar'
        },
        donem: {
          type: 'string',
          enum: ['bu_ay', 'gecen_ay', 'bu_yil', 'son_3_ay', 'son_6_ay'],
          description: 'Dönem filtresi'
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
          id, ettn, invoice_id, sender_vkn, sender_name,
          invoice_date, payable_amount, tax_amount, currency, status
        FROM uyumsoft_invoices
        WHERE 1=1
      `;
      const queryParams = [];
      let paramIndex = 1;

      if (params.tedarikci_vkn) {
        sql += ` AND sender_vkn = $${paramIndex++}`;
        queryParams.push(params.tedarikci_vkn);
      }

      if (params.tedarikci_unvan) {
        sql += ` AND UPPER(sender_name) LIKE UPPER($${paramIndex++})`;
        queryParams.push(`%${params.tedarikci_unvan}%`);
      }

      // Dönem filtreleri
      if (params.donem) {
        const now = new Date();
        let startDate, endDate;
        
        switch (params.donem) {
          case 'bu_ay':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
          case 'gecen_ay':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
          case 'bu_yil':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
            break;
          case 'son_3_ay':
            startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            endDate = now;
            break;
          case 'son_6_ay':
            startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
            endDate = now;
            break;
        }
        
        if (startDate && endDate) {
          sql += ` AND invoice_date >= $${paramIndex++} AND invoice_date <= $${paramIndex++}`;
          queryParams.push(startDate.toISOString().split('T')[0]);
          queryParams.push(endDate.toISOString().split('T')[0]);
        }
      } else {
        if (params.tarih_baslangic) {
          sql += ` AND invoice_date >= $${paramIndex++}`;
          queryParams.push(params.tarih_baslangic);
        }

        if (params.tarih_bitis) {
          sql += ` AND invoice_date <= $${paramIndex++}`;
          queryParams.push(params.tarih_bitis);
        }
      }

      if (params.tutar_min !== undefined) {
        sql += ` AND payable_amount >= $${paramIndex++}`;
        queryParams.push(params.tutar_min);
      }

      if (params.tutar_max !== undefined) {
        sql += ` AND payable_amount <= $${paramIndex++}`;
        queryParams.push(params.tutar_max);
      }

      sql += ` ORDER BY invoice_date DESC LIMIT $${paramIndex}`;
      queryParams.push(params.limit || 50);

      const result = await query(sql, queryParams);

      // Toplam tutarı hesapla
      const toplamTutar = result.rows.reduce((sum, f) => sum + parseFloat(f.payable_amount || 0), 0);
      const toplamKdv = result.rows.reduce((sum, f) => sum + parseFloat(f.tax_amount || 0), 0);
      
      return {
        success: true,
        data: result.rows,
        count: result.rows.length,
        ozet: {
          fatura_sayisi: result.rows.length,
          toplam_tutar: toplamTutar,
          toplam_kdv: toplamKdv
        },
        message: `${result.rows.length} e-fatura bulundu, Toplam: ₺${toplamTutar.toLocaleString('tr-TR')}`
      };
    }
  },

  /**
   * E-Fatura detayı getir
   */
  get_efatura_detay: {
    description: 'Tek bir e-faturanın detaylı bilgilerini ve kalemlerini getirir.',
    parameters: {
      type: 'object',
      properties: {
        fatura_id: {
          type: 'number',
          description: 'Fatura ID'
        },
        ettn: {
          type: 'string',
          description: 'ETTN (Elektronik fatura numarası)'
        },
        invoice_id: {
          type: 'string',
          description: 'Fatura numarası (UYM-...)'
        }
      }
    },
    handler: async (params) => {
      let sql = 'SELECT * FROM uyumsoft_invoices WHERE ';
      let queryParam = null;

      if (params.fatura_id) {
        sql += 'id = $1';
        queryParam = params.fatura_id;
      } else if (params.ettn) {
        sql += 'ettn = $1';
        queryParam = params.ettn;
      } else if (params.invoice_id) {
        sql += 'invoice_id = $1';
        queryParam = params.invoice_id;
      } else {
        return { success: false, error: 'fatura_id, ettn veya invoice_id gerekli' };
      }

      const result = await query(sql, [queryParam]);
      
      if (result.rows.length === 0) {
        return { success: false, error: 'Fatura bulunamadı' };
      }

      const fatura = result.rows[0];

      // Kalemleri getir (tek kaynak: faturaKalemleriClient)
      const kalemler = await faturaKalemleriClient.getKalemler(fatura.ettn);

      return {
        success: true,
        data: {
          ...fatura,
          kalemler
        }
      };
    }
  },

  /**
   * Fatura özeti
   */
  get_fatura_ozet: {
    description: 'Faturaların genel özet istatistiklerini getirir.',
    parameters: {
      type: 'object',
      properties: {
        donem: {
          type: 'string',
          enum: ['bu_ay', 'gecen_ay', 'bu_yil', 'son_3_ay', 'son_6_ay'],
          description: 'Dönem filtresi'
        }
      }
    },
    handler: async (params) => {
      let dateFilter = '';
      
      if (params.donem) {
        const now = new Date();
        let startDate;
        
        switch (params.donem) {
          case 'bu_ay':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'gecen_ay':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            break;
          case 'bu_yil':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          case 'son_3_ay':
            startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            break;
          case 'son_6_ay':
            startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
            break;
        }
        
        if (startDate) {
          dateFilter = `AND invoice_date >= '${startDate.toISOString().split('T')[0]}'`;
        }
      }

      const ozetResult = await query(`
        SELECT 
          COUNT(*) as fatura_sayisi,
          COALESCE(SUM(payable_amount), 0) as toplam_tutar,
          COALESCE(SUM(tax_amount), 0) as toplam_kdv,
          COALESCE(AVG(payable_amount), 0) as ortalama_tutar,
          COUNT(DISTINCT sender_vkn) as tedarikci_sayisi
        FROM uyumsoft_invoices
        WHERE 1=1 ${dateFilter}
      `);

      // Tedarikçi bazlı özet
      const tedarikciResult = await query(`
        SELECT 
          sender_name,
          sender_vkn,
          COUNT(*) as fatura_sayisi,
          SUM(payable_amount) as toplam_tutar
        FROM uyumsoft_invoices
        WHERE 1=1 ${dateFilter}
        GROUP BY sender_vkn, sender_name
        ORDER BY toplam_tutar DESC
        LIMIT 10
      `);

      // Aylık trend
      const trendResult = await query(`
        SELECT 
          TO_CHAR(invoice_date, 'YYYY-MM') as ay,
          COUNT(*) as fatura_sayisi,
          SUM(payable_amount) as toplam_tutar
        FROM uyumsoft_invoices
        WHERE invoice_date >= NOW() - INTERVAL '6 months'
        GROUP BY TO_CHAR(invoice_date, 'YYYY-MM')
        ORDER BY ay DESC
      `);

      return {
        success: true,
        data: {
          genel: ozetResult.rows[0],
          tedarikci_bazli: tedarikciResult.rows,
          aylik_trend: trendResult.rows,
          donem: params.donem || 'tum_zamanlar'
        }
      };
    }
  },

  /**
   * Tedarikçi bazlı fatura analizi
   */
  analyze_tedarikci_faturalar: {
    description: 'Belirli bir tedarikçinin fatura geçmişini ve trendini analiz eder.',
    parameters: {
      type: 'object',
      properties: {
        tedarikci_vkn: {
          type: 'string',
          description: 'Tedarikçi vergi numarası'
        },
        tedarikci_unvan: {
          type: 'string',
          description: 'Tedarikçi ünvanı (arama)'
        }
      }
    },
    handler: async (params) => {
      let whereClause = '';
      let queryParam = null;

      if (params.tedarikci_vkn) {
        whereClause = 'sender_vkn = $1';
        queryParam = params.tedarikci_vkn;
      } else if (params.tedarikci_unvan) {
        whereClause = 'UPPER(sender_name) LIKE UPPER($1)';
        queryParam = `%${params.tedarikci_unvan}%`;
      } else {
        return { success: false, error: 'tedarikci_vkn veya tedarikci_unvan gerekli' };
      }

      // Genel özet
      const ozetResult = await query(`
        SELECT 
          sender_name,
          sender_vkn,
          COUNT(*) as toplam_fatura,
          SUM(payable_amount) as toplam_tutar,
          AVG(payable_amount) as ortalama_tutar,
          MIN(invoice_date) as ilk_fatura,
          MAX(invoice_date) as son_fatura
        FROM uyumsoft_invoices
        WHERE ${whereClause}
        GROUP BY sender_vkn, sender_name
      `, [queryParam]);

      if (ozetResult.rows.length === 0) {
        return { success: false, error: 'Bu tedarikçiye ait fatura bulunamadı' };
      }

      // Aylık trend
      const trendResult = await query(`
        SELECT 
          TO_CHAR(invoice_date, 'YYYY-MM') as ay,
          COUNT(*) as fatura_sayisi,
          SUM(payable_amount) as toplam_tutar
        FROM uyumsoft_invoices
        WHERE ${whereClause}
        GROUP BY TO_CHAR(invoice_date, 'YYYY-MM')
        ORDER BY ay DESC
        LIMIT 12
      `, [queryParam]);

      // En çok alınan ürünler (tek kaynak: faturaKalemleriClient)
      const enCokAlinan = await faturaKalemleriClient.getEnCokAlinanUrunler({
        tedarikciVkn: params.tedarikci_vkn || undefined,
        tedarikciUnvanIlike: params.tedarikci_unvan ? `%${params.tedarikci_unvan}%` : undefined,
        limit: 10
      });

      return {
        success: true,
        data: {
          tedarikci: ozetResult.rows[0],
          aylik_trend: trendResult.rows,
          en_cok_alinan_urunler: enCokAlinan
        }
      };
    }
  },

  /**
   * Kategori bazlı harcama analizi
   */
  analyze_kategori_harcama: {
    description: 'Ürün kategorilerine göre harcama analizi yapar.',
    parameters: {
      type: 'object',
      properties: {
        donem: {
          type: 'string',
          enum: ['bu_ay', 'gecen_ay', 'bu_yil', 'son_3_ay', 'son_6_ay'],
          description: 'Dönem filtresi'
        },
        kategori: {
          type: 'string',
          enum: ['ET', 'SEBZE', 'MEYVE', 'SÜT', 'TAHIL', 'İÇECEK', 'TEMİZLİK', 'DİĞER'],
          description: 'Belirli bir kategori'
        }
      }
    },
    handler: async (params) => {
      let baslangic;
      let bitis;
      const now = new Date();
      if (params.donem) {
        switch (params.donem) {
          case 'bu_ay':
            baslangic = new Date(now.getFullYear(), now.getMonth(), 1);
            bitis = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
          case 'gecen_ay':
            baslangic = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            bitis = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
          case 'bu_yil':
            baslangic = new Date(now.getFullYear(), 0, 1);
            bitis = new Date(now.getFullYear(), 11, 31);
            break;
          case 'son_3_ay':
            baslangic = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            bitis = new Date();
            break;
          case 'son_6_ay':
            baslangic = new Date(now.getFullYear(), now.getMonth() - 6, 1);
            bitis = new Date();
            break;
          default:
            break;
        }
      }
      const baslangicStr = baslangic ? baslangic.toISOString().slice(0, 10) : undefined;
      const bitisStr = bitis ? bitis.toISOString().slice(0, 10) : undefined;

      // Tek kaynak: faturaKalemleriClient
      const kategoriler = await faturaKalemleriClient.getKategoriHarcamaAnaliz({
        baslangic: baslangicStr,
        bitis: bitisStr,
        kategoriKod: params.kategori || undefined
      });

      return {
        success: true,
        data: {
          kategoriler,
          donem: params.donem || 'tum_zamanlar'
        }
      };
    }
  }
};

export default faturaTools;

