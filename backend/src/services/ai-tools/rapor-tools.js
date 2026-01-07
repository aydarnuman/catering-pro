/**
 * Rapor Modülü AI Tools
 * Çapraz modül raporlama ve analitik için AI tool'ları
 */

import { query } from '../../database.js';

const raporTools = {
  
  /**
   * Genel sistem özeti
   */
  get_sistem_ozet: {
    description: 'Tüm sistemin genel durumu hakkında özet bilgi getirir. Dashboard için ideal.',
    parameters: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      // Satın alma özeti
      const satinAlmaResult = await query(`
        SELECT 
          COUNT(*) as toplam_siparis,
          COUNT(CASE WHEN durum = 'bekliyor' THEN 1 END) as bekleyen,
          COUNT(CASE WHEN durum = 'tedarikciye_gonderildi' THEN 1 END) as gonderilen,
          COUNT(CASE WHEN oncelik = 'acil' THEN 1 END) as acil,
          COALESCE(SUM(toplam_tutar), 0) as toplam_tutar
        FROM siparisler
        WHERE siparis_tarihi >= date_trunc('month', CURRENT_DATE)
      `);

      // Cari özeti
      const cariResult = await query(`
        SELECT 
          COUNT(*) as toplam_cari,
          COUNT(CASE WHEN tip = 'TEDARİKÇİ' THEN 1 END) as tedarikci,
          COUNT(CASE WHEN tip = 'MÜŞTERİ' THEN 1 END) as musteri,
          SUM(CASE WHEN bakiye > 0 THEN bakiye ELSE 0 END) as toplam_alacak,
          ABS(SUM(CASE WHEN bakiye < 0 THEN bakiye ELSE 0 END)) as toplam_borc
        FROM cariler
      `);

      // Fatura özeti
      const faturaResult = await query(`
        SELECT 
          COUNT(*) as fatura_sayisi,
          COALESCE(SUM(payable_amount), 0) as toplam_tutar
        FROM uyumsoft_invoices
        WHERE invoice_date >= date_trunc('month', CURRENT_DATE)
      `);

      // İhale özeti
      const ihaleResult = await query(`
        SELECT 
          COUNT(*) as toplam_ihale,
          COUNT(CASE WHEN tender_date > NOW() THEN 1 END) as aktif,
          COUNT(CASE WHEN tender_date > NOW() AND tender_date < NOW() + INTERVAL '7 days' THEN 1 END) as bu_hafta
        FROM tenders
      `);

      // Proje özeti
      const projeResult = await query(`
        SELECT COUNT(*) as aktif_proje FROM projeler WHERE aktif = true
      `);

      return {
        success: true,
        data: {
          satin_alma: satinAlmaResult.rows[0],
          cariler: cariResult.rows[0],
          faturalar: faturaResult.rows[0],
          ihaleler: ihaleResult.rows[0],
          projeler: projeResult.rows[0],
          tarih: new Date().toISOString()
        },
        message: 'Sistem özeti hazırlandı'
      };
    }
  },

  /**
   * Proje bazlı harcama raporu
   */
  rapor_proje_harcama: {
    description: 'Projelerin harcama raporunu getirir. Bütçe takibi için kullanılır.',
    parameters: {
      type: 'object',
      properties: {
        proje_kodu: {
          type: 'string',
          description: 'Belirli bir projenin kodu (örn: KYK)'
        },
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
          dateFilter = `AND s.siparis_tarihi >= '${startDate.toISOString().split('T')[0]}'`;
        }
      }

      let projeFilter = '';
      if (params.proje_kodu) {
        projeFilter = `AND UPPER(p.kod) = UPPER('${params.proje_kodu}')`;
      }

      const result = await query(`
        SELECT 
          p.kod,
          p.ad,
          p.renk,
          COUNT(s.id) as siparis_sayisi,
          COUNT(CASE WHEN s.durum = 'teslim_alindi' THEN 1 END) as tamamlanan,
          COUNT(CASE WHEN s.durum = 'bekliyor' THEN 1 END) as bekleyen,
          COALESCE(SUM(s.toplam_tutar), 0) as toplam_harcama,
          COALESCE(AVG(s.toplam_tutar), 0) as ortalama_siparis
        FROM projeler p
        LEFT JOIN siparisler s ON p.id = s.proje_id ${dateFilter}
        WHERE p.aktif = true ${projeFilter}
        GROUP BY p.id
        ORDER BY toplam_harcama DESC
      `);

      // Aylık trend (proje bazlı)
      const trendResult = await query(`
        SELECT 
          p.kod,
          TO_CHAR(s.siparis_tarihi, 'YYYY-MM') as ay,
          COUNT(s.id) as siparis_sayisi,
          COALESCE(SUM(s.toplam_tutar), 0) as toplam_tutar
        FROM projeler p
        LEFT JOIN siparisler s ON p.id = s.proje_id
        WHERE p.aktif = true ${projeFilter}
        AND s.siparis_tarihi >= NOW() - INTERVAL '6 months'
        GROUP BY p.kod, TO_CHAR(s.siparis_tarihi, 'YYYY-MM')
        ORDER BY p.kod, ay DESC
      `);

      return {
        success: true,
        data: {
          projeler: result.rows,
          aylik_trend: trendResult.rows,
          donem: params.donem || 'tum_zamanlar'
        }
      };
    }
  },

  /**
   * Tedarikçi performans raporu
   */
  rapor_tedarikci_performans: {
    description: 'Tedarikçilerin performans raporunu getirir. Sipariş, fatura ve teslimat analizi.',
    parameters: {
      type: 'object',
      properties: {
        tedarikci_id: {
          type: 'number',
          description: 'Belirli bir tedarikçi ID'
        },
        donem: {
          type: 'string',
          enum: ['bu_ay', 'gecen_ay', 'bu_yil', 'son_3_ay', 'son_6_ay'],
          description: 'Dönem filtresi'
        },
        limit: {
          type: 'number',
          description: 'Maksimum tedarikçi sayısı'
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
          dateFilter = `AND s.siparis_tarihi >= '${startDate.toISOString().split('T')[0]}'`;
        }
      }

      let tedarikciFilter = '';
      if (params.tedarikci_id) {
        tedarikciFilter = `AND c.id = ${params.tedarikci_id}`;
      }

      // Sipariş bazlı performans
      const siparisResult = await query(`
        SELECT 
          c.id,
          c.unvan,
          COUNT(s.id) as toplam_siparis,
          COUNT(CASE WHEN s.durum = 'teslim_alindi' THEN 1 END) as tamamlanan,
          COALESCE(SUM(s.toplam_tutar), 0) as siparis_tutari
        FROM cariler c
        LEFT JOIN siparisler s ON c.id = s.tedarikci_id ${dateFilter}
        WHERE c.tip = 'TEDARİKÇİ' ${tedarikciFilter}
        GROUP BY c.id
        ORDER BY siparis_tutari DESC
        LIMIT $1
      `, [params.limit || 20]);

      // Fatura bazlı (Uyumsoft)
      const faturaResult = await query(`
        SELECT 
          sender_name as unvan,
          sender_vkn as vkn,
          COUNT(*) as fatura_sayisi,
          COALESCE(SUM(payable_amount), 0) as fatura_tutari
        FROM uyumsoft_invoices
        WHERE 1=1
        GROUP BY sender_vkn, sender_name
        ORDER BY fatura_tutari DESC
        LIMIT $1
      `, [params.limit || 20]);

      return {
        success: true,
        data: {
          siparis_bazli: siparisResult.rows,
          fatura_bazli: faturaResult.rows,
          donem: params.donem || 'tum_zamanlar'
        }
      };
    }
  },

  /**
   * Dönemsel karşılaştırma raporu
   */
  rapor_donem_karsilastirma: {
    description: 'İki dönem arasında karşılaştırma raporu getirir.',
    parameters: {
      type: 'object',
      properties: {
        donem1: {
          type: 'string',
          enum: ['bu_ay', 'gecen_ay', 'bu_yil', 'gecen_yil'],
          description: 'İlk dönem'
        },
        donem2: {
          type: 'string',
          enum: ['bu_ay', 'gecen_ay', 'bu_yil', 'gecen_yil'],
          description: 'İkinci dönem (karşılaştırma)'
        }
      },
      required: ['donem1', 'donem2']
    },
    handler: async (params) => {
      const getDateRange = (donem) => {
        const now = new Date();
        let start, end;
        
        switch (donem) {
          case 'bu_ay':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
          case 'gecen_ay':
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
          case 'bu_yil':
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31);
            break;
          case 'gecen_yil':
            start = new Date(now.getFullYear() - 1, 0, 1);
            end = new Date(now.getFullYear() - 1, 11, 31);
            break;
        }
        
        return { start, end };
      };

      const range1 = getDateRange(params.donem1);
      const range2 = getDateRange(params.donem2);

      // Dönem 1 verileri
      const donem1Result = await query(`
        SELECT 
          COUNT(*) as siparis_sayisi,
          COALESCE(SUM(toplam_tutar), 0) as siparis_tutari
        FROM siparisler
        WHERE siparis_tarihi >= $1 AND siparis_tarihi <= $2
      `, [range1.start, range1.end]);

      // Dönem 2 verileri
      const donem2Result = await query(`
        SELECT 
          COUNT(*) as siparis_sayisi,
          COALESCE(SUM(toplam_tutar), 0) as siparis_tutari
        FROM siparisler
        WHERE siparis_tarihi >= $1 AND siparis_tarihi <= $2
      `, [range2.start, range2.end]);

      // Fatura karşılaştırma
      const fatura1Result = await query(`
        SELECT COUNT(*) as fatura_sayisi, COALESCE(SUM(payable_amount), 0) as fatura_tutari
        FROM uyumsoft_invoices
        WHERE invoice_date >= $1 AND invoice_date <= $2
      `, [range1.start, range1.end]);

      const fatura2Result = await query(`
        SELECT COUNT(*) as fatura_sayisi, COALESCE(SUM(payable_amount), 0) as fatura_tutari
        FROM uyumsoft_invoices
        WHERE invoice_date >= $1 AND invoice_date <= $2
      `, [range2.start, range2.end]);

      // Değişim hesapla
      const siparisDegisim = donem2Result.rows[0].siparis_sayisi > 0
        ? ((donem1Result.rows[0].siparis_sayisi - donem2Result.rows[0].siparis_sayisi) / donem2Result.rows[0].siparis_sayisi * 100).toFixed(1)
        : 0;

      const tutarDegisim = parseFloat(donem2Result.rows[0].siparis_tutari) > 0
        ? ((parseFloat(donem1Result.rows[0].siparis_tutari) - parseFloat(donem2Result.rows[0].siparis_tutari)) / parseFloat(donem2Result.rows[0].siparis_tutari) * 100).toFixed(1)
        : 0;

      return {
        success: true,
        data: {
          donem1: {
            ad: params.donem1,
            siparis: donem1Result.rows[0],
            fatura: fatura1Result.rows[0]
          },
          donem2: {
            ad: params.donem2,
            siparis: donem2Result.rows[0],
            fatura: fatura2Result.rows[0]
          },
          degisim: {
            siparis_sayisi_yuzde: siparisDegisim,
            siparis_tutari_yuzde: tutarDegisim
          }
        }
      };
    }
  },

  /**
   * Kritik uyarılar
   */
  get_kritik_uyarilar: {
    description: 'Dikkat edilmesi gereken kritik durumları listeler.',
    parameters: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      const uyarilar = [];

      // Acil siparişler
      const acilResult = await query(`
        SELECT COUNT(*) as sayi FROM siparisler 
        WHERE oncelik = 'acil' AND durum = 'bekliyor'
      `);
      if (parseInt(acilResult.rows[0].sayi) > 0) {
        uyarilar.push({
          tip: 'acil_siparis',
          seviye: 'yuksek',
          mesaj: `${acilResult.rows[0].sayi} adet acil sipariş bekliyor`,
          sayi: parseInt(acilResult.rows[0].sayi)
        });
      }

      // Geciken siparişler
      const gecikenResult = await query(`
        SELECT COUNT(*) as sayi FROM siparisler 
        WHERE teslim_tarihi < CURRENT_DATE AND durum != 'teslim_alindi' AND durum != 'iptal'
      `);
      if (parseInt(gecikenResult.rows[0].sayi) > 0) {
        uyarilar.push({
          tip: 'geciken_siparis',
          seviye: 'yuksek',
          mesaj: `${gecikenResult.rows[0].sayi} adet sipariş teslim tarihini geçti`,
          sayi: parseInt(gecikenResult.rows[0].sayi)
        });
      }

      // Yaklaşan ihaleler
      const yaklasanIhale = await query(`
        SELECT COUNT(*) as sayi FROM tenders 
        WHERE tender_date > NOW() AND tender_date < NOW() + INTERVAL '3 days'
      `);
      if (parseInt(yaklasanIhale.rows[0].sayi) > 0) {
        uyarilar.push({
          tip: 'yaklasan_ihale',
          seviye: 'orta',
          mesaj: `${yaklasanIhale.rows[0].sayi} adet ihale 3 gün içinde`,
          sayi: parseInt(yaklasanIhale.rows[0].sayi)
        });
      }

      // Yüksek bakiyeli cariler
      const yuksekBakiye = await query(`
        SELECT COUNT(*) as sayi FROM cariler 
        WHERE ABS(bakiye) > 100000
      `);
      if (parseInt(yuksekBakiye.rows[0].sayi) > 0) {
        uyarilar.push({
          tip: 'yuksek_bakiye',
          seviye: 'orta',
          mesaj: `${yuksekBakiye.rows[0].sayi} cari hesapta 100.000₺ üzeri bakiye var`,
          sayi: parseInt(yuksekBakiye.rows[0].sayi)
        });
      }

      return {
        success: true,
        data: {
          uyarilar,
          toplam_uyari: uyarilar.length,
          yuksek_seviye: uyarilar.filter(u => u.seviye === 'yuksek').length
        }
      };
    }
  }
};

export default raporTools;

