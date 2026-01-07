/**
 * Satın Alma Modülü AI Tools
 * Sipariş ve proje yönetimi için AI tool'ları
 */

import { query } from '../../database.js';

const satinAlmaTools = {
  
  // ============ OKUMA (Query) İŞLEMLERİ ============
  
  /**
   * Siparişleri listele
   */
  list_siparisler: {
    description: 'Siparişleri listeler. Proje, tedarikçi, durum veya tarih bazında filtreleyebilir.',
    parameters: {
      type: 'object',
      properties: {
        proje_id: {
          type: 'number',
          description: 'Belirli bir projenin siparişlerini getir'
        },
        proje_kodu: {
          type: 'string',
          description: 'Proje kodu ile filtrele (örn: KYK, HASTANE)'
        },
        tedarikci_id: {
          type: 'number', 
          description: 'Belirli bir tedarikçinin siparişlerini getir'
        },
        durum: {
          type: 'string',
          enum: ['talep', 'onay_bekliyor', 'onaylandi', 'siparis_verildi', 'teslim_alindi', 'iptal'],
          description: 'Sipariş durumu filtresi'
        },
        oncelik: {
          type: 'string',
          enum: ['dusuk', 'normal', 'yuksek', 'acil'],
          description: 'Öncelik filtresi'
        },
        tarih_baslangic: {
          type: 'string',
          description: 'Başlangıç tarihi (YYYY-MM-DD)'
        },
        tarih_bitis: {
          type: 'string',
          description: 'Bitiş tarihi (YYYY-MM-DD)'
        },
        limit: {
          type: 'number',
          description: 'Maksimum kayıt sayısı (varsayılan: 50)'
        }
      }
    },
    handler: async (params) => {
      let sql = `
        SELECT 
          s.*,
          p.kod as proje_kod, p.ad as proje_ad, p.renk as proje_renk,
          c.unvan as tedarikci_unvan
        FROM siparisler s
        LEFT JOIN projeler p ON s.proje_id = p.id
        LEFT JOIN cariler c ON s.tedarikci_id = c.id
        WHERE 1=1
      `;
      const queryParams = [];
      let paramIndex = 1;

      if (params.proje_id) {
        sql += ` AND s.proje_id = $${paramIndex++}`;
        queryParams.push(params.proje_id);
      }

      if (params.proje_kodu) {
        sql += ` AND UPPER(p.kod) = UPPER($${paramIndex++})`;
        queryParams.push(params.proje_kodu);
      }

      if (params.tedarikci_id) {
        sql += ` AND s.tedarikci_id = $${paramIndex++}`;
        queryParams.push(params.tedarikci_id);
      }

      if (params.durum) {
        sql += ` AND s.durum = $${paramIndex++}`;
        queryParams.push(params.durum);
      }

      if (params.oncelik) {
        sql += ` AND s.oncelik = $${paramIndex++}`;
        queryParams.push(params.oncelik);
      }

      if (params.tarih_baslangic) {
        sql += ` AND s.siparis_tarihi >= $${paramIndex++}`;
        queryParams.push(params.tarih_baslangic);
      }

      if (params.tarih_bitis) {
        sql += ` AND s.siparis_tarihi <= $${paramIndex++}`;
        queryParams.push(params.tarih_bitis);
      }

      sql += ` ORDER BY s.created_at DESC LIMIT $${paramIndex}`;
      queryParams.push(params.limit || 50);

      const result = await query(sql, queryParams);
      
      return {
        success: true,
        data: result.rows,
        count: result.rows.length,
        message: `${result.rows.length} sipariş bulundu`
      };
    }
  },

  /**
   * Sipariş detayı getir
   */
  get_siparis_detay: {
    description: 'Tek bir siparişin detaylı bilgilerini ve kalemlerini getirir.',
    parameters: {
      type: 'object',
      properties: {
        siparis_id: {
          type: 'number',
          description: 'Sipariş ID'
        },
        siparis_no: {
          type: 'string',
          description: 'Sipariş numarası (örn: SA-2026-001)'
        }
      }
    },
    handler: async (params) => {
      let sql = `
        SELECT 
          s.*,
          p.kod as proje_kod, p.ad as proje_ad, p.renk as proje_renk,
          p.adres as proje_adres, p.yetkili as proje_yetkili, p.telefon as proje_telefon,
          c.unvan as tedarikci_unvan, c.vergi_no as tedarikci_vkn,
          c.adres as tedarikci_adres, c.telefon as tedarikci_telefon, c.email as tedarikci_email
        FROM siparisler s
        LEFT JOIN projeler p ON s.proje_id = p.id
        LEFT JOIN cariler c ON s.tedarikci_id = c.id
        WHERE 
      `;
      
      const queryParams = [];
      
      if (params.siparis_id) {
        sql += 's.id = $1';
        queryParams.push(params.siparis_id);
      } else if (params.siparis_no) {
        sql += 's.siparis_no = $1';
        queryParams.push(params.siparis_no);
      } else {
        return { success: false, error: 'siparis_id veya siparis_no gerekli' };
      }

      const siparisResult = await query(sql, queryParams);
      
      if (siparisResult.rows.length === 0) {
        return { success: false, error: 'Sipariş bulunamadı' };
      }

      const siparis = siparisResult.rows[0];

      // Kalemleri getir
      const kalemlerResult = await query(
        'SELECT * FROM siparis_kalemleri WHERE siparis_id = $1 ORDER BY id',
        [siparis.id]
      );

      return {
        success: true,
        data: {
          ...siparis,
          kalemler: kalemlerResult.rows
        }
      };
    }
  },

  /**
   * Projeleri listele
   */
  list_projeler: {
    description: 'Tüm projeleri ve her projenin sipariş istatistiklerini getirir.',
    parameters: {
      type: 'object',
      properties: {
        aktif: {
          type: 'boolean',
          description: 'Sadece aktif projeleri getir (varsayılan: true)'
        }
      }
    },
    handler: async (params) => {
      let sql = `
        SELECT 
          p.*,
          COUNT(s.id) as siparis_sayisi,
          COUNT(CASE WHEN s.durum = 'bekliyor' THEN 1 END) as bekleyen_siparis,
          COUNT(CASE WHEN s.durum = 'tedarikciye_gonderildi' THEN 1 END) as gonderilen_siparis,
          COALESCE(SUM(s.toplam_tutar), 0) as toplam_harcama
        FROM projeler p
        LEFT JOIN siparisler s ON p.id = s.proje_id
      `;

      if (params.aktif !== false) {
        sql += ' WHERE p.aktif = true';
      }

      sql += ' GROUP BY p.id ORDER BY p.ad';

      const result = await query(sql);
      
      return {
        success: true,
        data: result.rows,
        count: result.rows.length
      };
    }
  },

  /**
   * Satın alma özeti
   */
  get_ozet: {
    description: 'Satın alma modülünün genel özet istatistiklerini getirir.',
    parameters: {
      type: 'object',
      properties: {
        donem: {
          type: 'string',
          enum: ['bugun', 'bu_hafta', 'bu_ay', 'bu_yil'],
          description: 'Dönem filtresi'
        }
      }
    },
    handler: async (params) => {
      let dateFilter = '';
      
      if (params.donem === 'bugun') {
        dateFilter = "AND s.siparis_tarihi = CURRENT_DATE";
      } else if (params.donem === 'bu_hafta') {
        dateFilter = "AND s.siparis_tarihi >= date_trunc('week', CURRENT_DATE)";
      } else if (params.donem === 'bu_ay') {
        dateFilter = "AND s.siparis_tarihi >= date_trunc('month', CURRENT_DATE)";
      } else if (params.donem === 'bu_yil') {
        dateFilter = "AND s.siparis_tarihi >= date_trunc('year', CURRENT_DATE)";
      }

      const ozetResult = await query(`
        SELECT 
          COUNT(*) as toplam_siparis,
          COUNT(CASE WHEN durum = 'bekliyor' THEN 1 END) as bekleyen,
          COUNT(CASE WHEN durum = 'tedarikciye_gonderildi' THEN 1 END) as gonderilen,
          COUNT(CASE WHEN durum = 'teslim_alindi' THEN 1 END) as teslim_alinan,
          COUNT(CASE WHEN oncelik = 'acil' THEN 1 END) as acil_siparis,
          COALESCE(SUM(toplam_tutar), 0) as toplam_tutar
        FROM siparisler s
        WHERE 1=1 ${dateFilter}
      `);

      const projeBazliResult = await query(`
        SELECT 
          p.kod, p.ad, p.renk,
          COUNT(s.id) as siparis_sayisi,
          COALESCE(SUM(s.toplam_tutar), 0) as toplam_tutar
        FROM projeler p
        LEFT JOIN siparisler s ON p.id = s.proje_id ${dateFilter.replace('s.', 's.')}
        WHERE p.aktif = true
        GROUP BY p.id
        ORDER BY toplam_tutar DESC
      `);

      return {
        success: true,
        data: {
          genel: ozetResult.rows[0],
          proje_bazli: projeBazliResult.rows,
          donem: params.donem || 'tum_zamanlar'
        }
      };
    }
  },

  // ============ YAZMA (Action) İŞLEMLERİ ============

  /**
   * Yeni sipariş oluştur
   */
  create_siparis: {
    description: 'Yeni bir satın alma siparişi oluşturur.',
    parameters: {
      type: 'object',
      properties: {
        baslik: {
          type: 'string',
          description: 'Sipariş başlığı (zorunlu)'
        },
        proje_kodu: {
          type: 'string',
          description: 'Proje kodu (örn: KYK, HASTANE)'
        },
        proje_id: {
          type: 'number',
          description: 'Proje ID (proje_kodu yerine kullanılabilir)'
        },
        tedarikci_unvan: {
          type: 'string',
          description: 'Tedarikçi ünvanı (arama yapılır)'
        },
        tedarikci_id: {
          type: 'number',
          description: 'Tedarikçi ID'
        },
        oncelik: {
          type: 'string',
          enum: ['dusuk', 'normal', 'yuksek', 'acil'],
          description: 'Öncelik seviyesi (varsayılan: normal)'
        },
        teslim_tarihi: {
          type: 'string',
          description: 'İstenen teslim tarihi (YYYY-MM-DD)'
        },
        notlar: {
          type: 'string',
          description: 'Sipariş notları'
        },
        kalemler: {
          type: 'array',
          description: 'Sipariş kalemleri listesi',
          items: {
            type: 'object',
            properties: {
              urun_adi: { type: 'string' },
              miktar: { type: 'number' },
              birim: { type: 'string' },
              tahmini_fiyat: { type: 'number' }
            }
          }
        }
      },
      required: ['baslik']
    },
    handler: async (params) => {
      // Proje bul (kod ile)
      let projeId = params.proje_id;
      if (!projeId && params.proje_kodu) {
        const projeResult = await query(
          'SELECT id FROM projeler WHERE UPPER(kod) = UPPER($1)',
          [params.proje_kodu]
        );
        if (projeResult.rows.length > 0) {
          projeId = projeResult.rows[0].id;
        }
      }

      // Tedarikçi bul (ünvan ile)
      let tedarikciId = params.tedarikci_id;
      if (!tedarikciId && params.tedarikci_unvan) {
        const tedarikciResult = await query(
          "SELECT id FROM cariler WHERE UPPER(unvan) LIKE UPPER($1) AND tip = 'TEDARİKÇİ' LIMIT 1",
          [`%${params.tedarikci_unvan}%`]
        );
        if (tedarikciResult.rows.length > 0) {
          tedarikciId = tedarikciResult.rows[0].id;
        }
      }

      // Sipariş numarası oluştur
      const year = new Date().getFullYear();
      const countResult = await query(
        "SELECT COUNT(*) FROM siparisler WHERE siparis_no LIKE $1",
        [`SA-${year}-%`]
      );
      const count = parseInt(countResult.rows[0].count) + 1;
      const siparisNo = `SA-${year}-${count.toString().padStart(3, '0')}`;

      // Toplam tutarı hesapla
      let toplamTutar = 0;
      if (params.kalemler && params.kalemler.length > 0) {
        toplamTutar = params.kalemler.reduce((sum, k) => 
          sum + (k.miktar || 0) * (k.tahmini_fiyat || 0), 0
        );
      }

      // Siparişi oluştur
      const siparisResult = await query(`
        INSERT INTO siparisler (
          siparis_no, proje_id, tedarikci_id, baslik, 
          siparis_tarihi, teslim_tarihi, oncelik, toplam_tutar, notlar, durum
        ) VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7, $8, 'talep')
        RETURNING *
      `, [
        siparisNo,
        projeId,
        tedarikciId,
        params.baslik,
        params.teslim_tarihi || null,
        params.oncelik || 'normal',
        toplamTutar,
        params.notlar || null
      ]);

      const siparis = siparisResult.rows[0];

      // Kalemleri ekle
      if (params.kalemler && params.kalemler.length > 0) {
        for (const kalem of params.kalemler) {
          await query(`
            INSERT INTO siparis_kalemleri (siparis_id, urun_adi, miktar, birim, tahmini_fiyat)
            VALUES ($1, $2, $3, $4, $5)
          `, [siparis.id, kalem.urun_adi, kalem.miktar, kalem.birim || 'adet', kalem.tahmini_fiyat || 0]);
        }
      }

      return {
        success: true,
        data: siparis,
        message: `Sipariş oluşturuldu: ${siparisNo}`
      };
    }
  },

  /**
   * Sipariş durumunu güncelle
   */
  update_siparis_durum: {
    description: 'Bir siparişin durumunu günceller.',
    parameters: {
      type: 'object',
      properties: {
        siparis_id: {
          type: 'number',
          description: 'Sipariş ID'
        },
        siparis_no: {
          type: 'string',
          description: 'Sipariş numarası'
        },
        durum: {
          type: 'string',
          enum: ['talep', 'onay_bekliyor', 'onaylandi', 'siparis_verildi', 'teslim_alindi', 'iptal'],
          description: 'Yeni durum'
        }
      },
      required: ['durum']
    },
    handler: async (params) => {
      let whereClause = '';
      let queryParam = null;

      if (params.siparis_id) {
        whereClause = 'id = $2';
        queryParam = params.siparis_id;
      } else if (params.siparis_no) {
        whereClause = 'siparis_no = $2';
        queryParam = params.siparis_no;
      } else {
        return { success: false, error: 'siparis_id veya siparis_no gerekli' };
      }

      const result = await query(
        `UPDATE siparisler SET durum = $1, updated_at = NOW() WHERE ${whereClause} RETURNING *`,
        [params.durum, queryParam]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Sipariş bulunamadı' };
      }

      const durumText = {
        'bekliyor': 'Bekliyor',
        'tedarikciye_gonderildi': 'Tedarikçiye Gönderildi',
        'teslim_alindi': 'Teslim Alındı',
        'iptal': 'İptal Edildi'
      };

      return {
        success: true,
        data: result.rows[0],
        message: `Sipariş durumu güncellendi: ${durumText[params.durum]}`
      };
    }
  },

  /**
   * Yeni proje oluştur
   */
  create_proje: {
    description: 'Yeni bir proje/şube oluşturur.',
    parameters: {
      type: 'object',
      properties: {
        kod: {
          type: 'string',
          description: 'Proje kodu (benzersiz, kısa, örn: KYK)'
        },
        ad: {
          type: 'string',
          description: 'Proje adı'
        },
        adres: {
          type: 'string',
          description: 'Proje adresi'
        },
        yetkili: {
          type: 'string',
          description: 'Yetkili kişi adı'
        },
        telefon: {
          type: 'string',
          description: 'İletişim telefonu'
        },
        renk: {
          type: 'string',
          description: 'Renk kodu (hex, örn: #10b981)'
        }
      },
      required: ['kod', 'ad']
    },
    handler: async (params) => {
      // Kod benzersizliğini kontrol et
      const existing = await query('SELECT id FROM projeler WHERE UPPER(kod) = UPPER($1)', [params.kod]);
      if (existing.rows.length > 0) {
        return { success: false, error: `"${params.kod}" kodlu proje zaten mevcut` };
      }

      const result = await query(`
        INSERT INTO projeler (kod, ad, adres, yetkili, telefon, renk)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        params.kod.toUpperCase(),
        params.ad,
        params.adres || null,
        params.yetkili || null,
        params.telefon || null,
        params.renk || '#6366f1'
      ]);

      return {
        success: true,
        data: result.rows[0],
        message: `Proje oluşturuldu: ${params.ad} (${params.kod})`
      };
    }
  },

  /**
   * Proje sil
   */
  delete_proje: {
    description: 'Bir projeyi siler. İlişkili siparişler NULL olarak güncellenir.',
    parameters: {
      type: 'object',
      properties: {
        proje_id: {
          type: 'number',
          description: 'Proje ID'
        },
        proje_kodu: {
          type: 'string',
          description: 'Proje kodu'
        }
      }
    },
    handler: async (params) => {
      let whereClause = '';
      let queryParam = null;

      if (params.proje_id) {
        whereClause = 'id = $1';
        queryParam = params.proje_id;
      } else if (params.proje_kodu) {
        whereClause = 'UPPER(kod) = UPPER($1)';
        queryParam = params.proje_kodu;
      } else {
        return { success: false, error: 'proje_id veya proje_kodu gerekli' };
      }

      // Önce proje bilgisini al
      const projeResult = await query(`SELECT * FROM projeler WHERE ${whereClause}`, [queryParam]);
      if (projeResult.rows.length === 0) {
        return { success: false, error: 'Proje bulunamadı' };
      }

      const proje = projeResult.rows[0];

      // Siparişlerin proje_id'sini NULL yap
      await query('UPDATE siparisler SET proje_id = NULL WHERE proje_id = $1', [proje.id]);

      // Projeyi sil
      await query('DELETE FROM projeler WHERE id = $1', [proje.id]);

      return {
        success: true,
        message: `Proje silindi: ${proje.ad} (${proje.kod})`
      };
    }
  }
};

export default satinAlmaTools;

