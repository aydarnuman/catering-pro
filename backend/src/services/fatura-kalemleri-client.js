/**
 * FATURA KALEMLERİ - INTERNAL API CLIENT
 *
 * Backend servisleri bu client üzerinden fatura kalem verilerine erişir.
 * Direkt DB sorgusu YASAKTIR (bu dosya hariç – tek merkez).
 *
 * Kullanım:
 * import { faturaKalemleriClient } from './fatura-kalemleri-client.js';
 * const fiyatlar = await faturaKalemleriClient.getGuncelFiyatlar();
 */

import { query } from '../database.js';

export const faturaKalemleriClient = {
  // ==================== FATURA İŞLEMLERİ ====================

  /**
   * Faturaları listele
   */
  async getFaturalar(options = {}) {
    const { baslangic, bitis, tedarikci_vkn, sadece_eslesmemis, limit = 100 } = options;

    let sql = `
      SELECT 
        ui.ettn,
        ui.invoice_no as fatura_no,
        ui.sender_vkn as tedarikci_vkn,
        ui.sender_name as tedarikci_ad,
        ui.invoice_date as fatura_tarihi,
        ui.payable_amount as toplam_tutar,
        COUNT(fk.id) as toplam_kalem,
        COUNT(fk.urun_id) as eslesen_kalem
      FROM uyumsoft_invoices ui
      LEFT JOIN fatura_kalemleri fk ON fk.fatura_ettn = ui.ettn
      WHERE 1=1
    `;

    const params = [];
    let idx = 1;

    if (baslangic) {
      sql += ` AND ui.invoice_date >= $${idx++}`;
      params.push(baslangic);
    }
    if (bitis) {
      sql += ` AND ui.invoice_date <= $${idx++}`;
      params.push(bitis);
    }
    if (tedarikci_vkn) {
      sql += ` AND ui.sender_vkn = $${idx++}`;
      params.push(tedarikci_vkn);
    }

    sql += ` GROUP BY ui.ettn, ui.invoice_no, ui.sender_vkn, ui.sender_name, ui.invoice_date, ui.payable_amount`;

    if (sadece_eslesmemis) {
      sql += ` HAVING COUNT(fk.id) > COUNT(fk.urun_id)`;
    }

    sql += ` ORDER BY ui.invoice_date DESC NULLS LAST LIMIT $${idx++}`;
    params.push(limit);

    const result = await query(sql, params);
    return result.rows;
  },

  /**
   * Fatura kalemlerini getir
   */
  async getKalemler(ettn) {
    const result = await query(
      `
      SELECT 
        fk.*,
        uk.kod as urun_kod,
        uk.ad as urun_ad,
        kat.ad as kategori_ad
      FROM fatura_kalemleri fk
      LEFT JOIN urun_kartlari uk ON uk.id = fk.urun_id
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      WHERE UPPER(TRIM(fk.fatura_ettn::text)) = UPPER(TRIM($1))
      ORDER BY fk.kalem_sira
    `,
      [ettn]
    );

    return result.rows;
  },

  /**
   * Fatura kalem sayısı (tek ETTN)
   */
  async getKalemSayisi(ettn) {
    const result = await query(
      `SELECT COUNT(*)::int as n FROM fatura_kalemleri WHERE UPPER(TRIM(fatura_ettn::text)) = UPPER(TRIM($1))`,
      [ettn]
    );
    return result.rows[0]?.n ?? 0;
  },

  /**
   * Birden fazla ETTN için kalem sayıları (ettn -> count)
   */
  async getKalemSayilari(ettnList) {
    if (!ettnList?.length) return {};
    const result = await query(
      `SELECT fatura_ettn as ettn, COUNT(*)::int as n FROM fatura_kalemleri WHERE fatura_ettn = ANY($1) GROUP BY fatura_ettn`,
      [ettnList]
    );
    return Object.fromEntries(result.rows.map((r) => [String(r.ettn), r.n]));
  },

  /**
   * Fatura detayı (başlık + kalemler)
   */
  async getFaturaDetay(ettn) {
    const faturaResult = await query(
      `SELECT * FROM uyumsoft_invoices WHERE UPPER(TRIM(ettn::text)) = UPPER(TRIM($1))`,
      [ettn]
    );

    if (faturaResult.rows.length === 0) return null;

    const kalemler = await this.getKalemler(ettn);

    return {
      fatura: faturaResult.rows[0],
      kalemler,
    };
  },

  // ==================== FİYAT İŞLEMLERİ ====================

  /**
   * Güncel fiyatları getir
   */
  async getGuncelFiyatlar(options = {}) {
    const { kategori_id, sadece_fiyatli } = options;

    let sql = `SELECT * FROM v_urun_guncel_fiyat WHERE 1=1`;
    const params = [];
    let idx = 1;

    if (kategori_id) {
      sql += ` AND kategori_id = $${idx++}`;
      params.push(kategori_id);
    }
    if (sadece_fiyatli) {
      sql += ` AND son_fiyat IS NOT NULL`;
    }

    sql += ` ORDER BY ad`;

    const result = await query(sql, params);
    return result.rows;
  },

  /**
   * Ürün fiyat geçmişi
   */
  async getFiyatGecmisi(urunId, limit = 50) {
    const result = await query(
      `
      SELECT * FROM v_urun_fiyat_gecmisi
      WHERE urun_id = $1
      ORDER BY fatura_tarihi DESC NULLS LAST
      LIMIT $2
    `,
      [urunId, limit]
    );

    return result.rows;
  },

  /**
   * Ürünün son fiyatı
   */
  async getSonFiyat(urunId) {
    const result = await query(
      `SELECT son_fiyat, son_fiyat_tarihi, ortalama_fiyat FROM v_urun_guncel_fiyat WHERE id = $1`,
      [urunId]
    );

    return result.rows[0] || null;
  },

  /**
   * Son 30 gün fatura kalem fiyatları (AI fiyat lookup)
   */
  async getSon30GunFaturaFiyatlari() {
    const result = await query(`
      SELECT DISTINCT ON (LOWER(fk.orijinal_urun_adi))
        fk.orijinal_urun_adi as urun_adi,
        fk.birim_fiyat as birim_fiyat,
        fk.birim as birim,
        COALESCE(kat.ad, 'Diğer') as kategori,
        u.invoice_date as fatura_tarihi,
        COALESCE(fk.tedarikci_ad, u.sender_name) as tedarikci,
        'fatura' as kaynak
      FROM fatura_kalemleri fk
      JOIN uyumsoft_invoices u ON u.ettn = fk.fatura_ettn
      LEFT JOIN urun_kartlari uk ON uk.id = fk.urun_id
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      WHERE u.invoice_date >= CURRENT_DATE - INTERVAL '30 days'
        AND fk.birim_fiyat > 0
      ORDER BY LOWER(fk.orijinal_urun_adi), u.invoice_date DESC
    `);
    return result.rows;
  },

  /**
   * Kategori bazlı ortalama fiyatlar (son 30 gün) – AI kategori fiyat
   */
  async getKategoriFiyatOzetiSon30Gun() {
    const result = await query(`
      SELECT 
        COALESCE(kat.ad, 'Diğer') as kategori,
        COUNT(*)::int as urun_sayisi,
        ROUND(AVG(fk.birim_fiyat)::numeric, 2) as ortalama_fiyat,
        ROUND(MIN(fk.birim_fiyat)::numeric, 2) as min_fiyat,
        ROUND(MAX(fk.birim_fiyat)::numeric, 2) as max_fiyat,
        MAX(u.invoice_date) as son_fatura_tarihi
      FROM fatura_kalemleri fk
      JOIN uyumsoft_invoices u ON u.ettn = fk.fatura_ettn
      LEFT JOIN urun_kartlari uk ON uk.id = fk.urun_id
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      WHERE u.invoice_date >= CURRENT_DATE - INTERVAL '30 days'
        AND fk.birim_fiyat > 0
      GROUP BY COALESCE(kat.ad, 'Diğer')
      ORDER BY urun_sayisi DESC
    `);
    return result.rows;
  },

  /**
   * Tedarikçi fiyat karşılaştırması
   */
  async getTedarikciKarsilastirma(urunId) {
    const result = await query(
      `
      SELECT 
        tedarikci_vkn,
        tedarikci_ad,
        COUNT(*)::int as fatura_sayisi,
        ROUND(AVG(birim_fiyat)::numeric, 4) as ortalama_fiyat,
        MIN(birim_fiyat) as min_fiyat,
        MAX(birim_fiyat) as max_fiyat,
        MAX(fatura_tarihi) as son_fatura
      FROM fatura_kalemleri
      WHERE urun_id = $1
      GROUP BY tedarikci_vkn, tedarikci_ad
      ORDER BY ortalama_fiyat ASC NULLS LAST
    `,
      [urunId]
    );

    return result.rows;
  },

  // ==================== RAPORLAR ====================

  /**
   * Kategori harcama özeti
   */
  async getKategoriHarcama(options = {}) {
    const { baslangic, bitis } = options;

    let sql = `
      SELECT 
        kat.id as kategori_id,
        kat.ad as kategori_ad,
        COUNT(fk.id)::int as kalem_sayisi,
        COALESCE(SUM(fk.tutar), 0)::numeric as toplam_tutar,
        ROUND(AVG(fk.birim_fiyat)::numeric, 4) as ortalama_fiyat
      FROM urun_kategorileri kat
      LEFT JOIN urun_kartlari uk ON uk.kategori_id = kat.id
      LEFT JOIN fatura_kalemleri fk ON fk.urun_id = uk.id
      WHERE 1=1
    `;

    const params = [];
    let idx = 1;

    if (baslangic) {
      sql += ` AND fk.fatura_tarihi >= $${idx++}`;
      params.push(baslangic);
    }
    if (bitis) {
      sql += ` AND fk.fatura_tarihi <= $${idx++}`;
      params.push(bitis);
    }

    sql += ` GROUP BY kat.id, kat.ad ORDER BY toplam_tutar DESC NULLS LAST`;

    const result = await query(sql, params);
    return result.rows;
  },

  /**
   * Kategori harcama – haftalık özet formatı (category, count, total)
   */
  async getKategoriHarcamaHaftalik(baslangicTarih) {
    const rows = await this.getKategoriHarcama({
      baslangic: baslangicTarih,
      bitis: new Date().toISOString().slice(0, 10),
    });
    return rows.map((r) => ({ category: r.kategori_ad, count: r.kalem_sayisi, total: r.toplam_tutar }));
  },

  /**
   * Kategori bazlı özet (invoices/summary/category ve invoice-ai için)
   */
  async getKategoriOzetSummary(options = {}) {
    const { startDate, endDate } = options;

    let sql = `
      SELECT 
        COALESCE(kat.ad, 'Diğer') as category,
        COUNT(DISTINCT fk.fatura_ettn)::int as invoice_count,
        SUM(fk.miktar)::numeric as total_quantity,
        SUM(fk.tutar)::numeric as total_amount,
        AVG(fk.birim_fiyat)::numeric as avg_unit_price
      FROM fatura_kalemleri fk
      JOIN uyumsoft_invoices u ON u.ettn = fk.fatura_ettn
      LEFT JOIN urun_kartlari uk ON uk.id = fk.urun_id
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;
    if (startDate) {
      sql += ` AND u.invoice_date >= $${idx++}`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND u.invoice_date <= $${idx++}`;
      params.push(endDate);
    }
    sql += ` GROUP BY COALESCE(kat.ad, 'Diğer') ORDER BY total_amount DESC NULLS LAST`;

    const result = await query(sql, params);
    return result.rows;
  },

  /**
   * Kategori bazlı özet + tedarikçi adları (invoice-ai kategori filtresi)
   */
  async getKategoriFaturaOzeti(options = {}) {
    const { categoryFilter, startDate, endDate } = options;
    const like = categoryFilter ? `%${String(categoryFilter)}%` : null;

    let sql = `
      SELECT 
        COALESCE(kat.ad, 'Diğer') as category,
        COUNT(DISTINCT fk.fatura_ettn)::int as invoice_count,
        SUM(fk.miktar)::numeric as total_quantity,
        SUM(fk.tutar)::numeric as total_amount,
        AVG(fk.birim_fiyat)::numeric as avg_unit_price,
        STRING_AGG(DISTINCT COALESCE(fk.tedarikci_ad, u.sender_name), ', ' ORDER BY COALESCE(fk.tedarikci_ad, u.sender_name)) as suppliers
      FROM fatura_kalemleri fk
      JOIN uyumsoft_invoices u ON u.ettn = fk.fatura_ettn
      LEFT JOIN urun_kartlari uk ON uk.id = fk.urun_id
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      WHERE (LOWER(COALESCE(kat.ad, '')) LIKE $1 OR LOWER(fk.orijinal_urun_adi) LIKE $1)
    `;
    const params = [like ?? '%'];
    let idx = 2;
    if (startDate) {
      sql += ` AND u.invoice_date >= $${idx++}`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND u.invoice_date <= $${idx++}`;
      params.push(endDate);
    }
    sql += ` GROUP BY COALESCE(kat.ad, 'Diğer')`;

    const result = await query(sql, params);
    return result.rows;
  },

  /**
   * Tedarikçi özeti
   */
  async getTedarikciOzet(options = {}) {
    const { baslangic, bitis, limit = 50 } = options;

    let sql = `
      SELECT 
        tedarikci_vkn,
        tedarikci_ad,
        COUNT(DISTINCT fatura_ettn)::int as fatura_sayisi,
        COUNT(*)::int as kalem_sayisi,
        COALESCE(SUM(tutar), 0)::numeric as toplam_tutar,
        MIN(fatura_tarihi) as ilk_fatura,
        MAX(fatura_tarihi) as son_fatura
      FROM fatura_kalemleri
      WHERE tedarikci_vkn IS NOT NULL
    `;

    const params = [];
    let idx = 1;

    if (baslangic) {
      sql += ` AND fatura_tarihi >= $${idx++}`;
      params.push(baslangic);
    }
    if (bitis) {
      sql += ` AND fatura_tarihi <= $${idx++}`;
      params.push(bitis);
    }

    sql += ` GROUP BY tedarikci_vkn, tedarikci_ad ORDER BY toplam_tutar DESC NULLS LAST LIMIT $${idx++}`;
    params.push(limit);

    const result = await query(sql, params);
    return result.rows;
  },

  /**
   * Eşleşme durumu özeti
   */
  async getEslesmeDurumu() {
    const result = await query(`SELECT * FROM v_fatura_eslesme_durumu`);

    const faturalar = result.rows;
    const toplam = faturalar.length;
    const tamEslesen = faturalar.filter((r) => parseFloat(r.eslesme_yuzdesi) === 100).length;
    const kismiEslesen = faturalar.filter((r) => {
      const y = parseFloat(r.eslesme_yuzdesi);
      return y > 0 && y < 100;
    }).length;
    const hicEslesmemis = faturalar.filter((r) => parseFloat(r.eslesme_yuzdesi) === 0).length;

    return {
      ozet: { toplam, tamEslesen, kismiEslesen, hicEslesmemis },
      faturalar,
    };
  },

  /**
   * Kategori bazlı harcama analizi (fatura-tools donem + kategori filtresi)
   */
  async getKategoriHarcamaAnaliz(options = {}) {
    const { baslangic, bitis, kategoriKod } = options;

    let sql = `
      SELECT 
        COALESCE(kat.ad, 'DİĞER') as kategori,
        COUNT(DISTINCT fk.fatura_ettn)::int as fatura_sayisi,
        COUNT(*)::int as kalem_sayisi,
        SUM(fk.tutar)::numeric as toplam_tutar,
        AVG(fk.birim_fiyat)::numeric as ortalama_birim_fiyat
      FROM fatura_kalemleri fk
      JOIN uyumsoft_invoices i ON i.ettn = fk.fatura_ettn
      LEFT JOIN urun_kartlari uk ON uk.id = fk.urun_id
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;
    if (baslangic) {
      sql += ` AND i.invoice_date >= $${idx++}`;
      params.push(baslangic);
    }
    if (bitis) {
      sql += ` AND i.invoice_date <= $${idx++}`;
      params.push(bitis);
    }
    if (kategoriKod) {
      sql += ` AND kat.kod = $${idx++}`;
      params.push(kategoriKod);
    }
    sql += ` GROUP BY COALESCE(kat.ad, 'DİĞER') ORDER BY toplam_tutar DESC NULLS LAST`;

    const result = await query(sql, params);
    return result.rows;
  },

  /**
   * En çok alınan ürünler (fatura-tools tedarikçi özeti)
   */
  async getEnCokAlinanUrunler(options = {}) {
    const { baslangic, bitis, tedarikciVkn, tedarikciUnvanIlike, limit = 10 } = options;

    let sql = `
      SELECT 
        fk.orijinal_urun_adi as description,
        kat.ad as ai_category,
        COUNT(*)::int as adet,
        SUM(fk.tutar)::numeric as toplam_tutar
      FROM fatura_kalemleri fk
      JOIN uyumsoft_invoices i ON i.ettn = fk.fatura_ettn
      LEFT JOIN urun_kartlari uk ON uk.id = fk.urun_id
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;
    if (baslangic) {
      sql += ` AND i.invoice_date >= $${idx++}`;
      params.push(baslangic);
    }
    if (bitis) {
      sql += ` AND i.invoice_date <= $${idx++}`;
      params.push(bitis);
    }
    if (tedarikciVkn) {
      sql += ` AND i.sender_vkn = $${idx++}`;
      params.push(tedarikciVkn);
    }
    if (tedarikciUnvanIlike) {
      sql += ` AND i.sender_name ILIKE $${idx++}`;
      params.push(tedarikciUnvanIlike);
    }
    sql += ` GROUP BY fk.orijinal_urun_adi, kat.ad ORDER BY toplam_tutar DESC NULLS LAST LIMIT $${idx++}`;
    params.push(limit);

    const result = await query(sql, params);
    return result.rows;
  },
};

export default faturaKalemleriClient;
