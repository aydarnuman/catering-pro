/**
 * FATURA KALEMLERİ API - TEK KAYNAK
 *
 * Bu API tüm sistemin fatura kalem verisi için TEK kaynağıdır.
 * Diğer servisler (AI, stok, invoices) bu API'yi kullanmalıdır.
 * Direkt DB sorgusu YASAKTIR (bu dosya hariç – tek kaynak).
 *
 * Tablo: fatura_kalemleri
 * View'lar: v_urun_guncel_fiyat, v_urun_fiyat_gecmisi, v_fatura_eslesme_durumu
 *
 * Kalemler uyumsoft_invoices'ta yoksa Uyumsoft UBL XML'den (getInboxInvoiceData) çekilir.
 */

import express from 'express';
import { parseStringPromise } from 'xml2js';
import { query } from '../database.js';
import { faturaService } from '../scraper/uyumsoft/index.js';

const router = express.Router();

// ==================== FATURA İŞLEMLERİ ====================

/**
 * GET /faturalar
 * Tüm faturaların kalem özetini getir
 */
router.get('/faturalar', async (req, res) => {
  try {
    const { baslangic, bitis, tedarikci_vkn, sadece_eslesmemis, limit = 100, offset = 0 } = req.query;

    let sql = `
      SELECT 
        ui.ettn,
        ui.invoice_no as fatura_no,
        ui.sender_vkn as tedarikci_vkn,
        ui.sender_name as tedarikci_ad,
        ui.invoice_date as fatura_tarihi,
        COALESCE(ui.payable_amount, ui.tax_amount + ui.taxable_amount, 0) as toplam_tutar,
        COUNT(fk.id) as toplam_kalem,
        COUNT(fk.urun_id) as eslesen_kalem,
        CASE 
          WHEN COUNT(fk.id) > 0 
          THEN ROUND(COUNT(fk.urun_id)::numeric / COUNT(fk.id)::numeric * 100, 1)
          ELSE 0 
        END as eslesme_yuzdesi
      FROM uyumsoft_invoices ui
      LEFT JOIN fatura_kalemleri fk ON fk.fatura_ettn = ui.ettn
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (baslangic) {
      sql += ` AND ui.invoice_date >= $${paramIndex++}`;
      params.push(baslangic);
    }
    if (bitis) {
      sql += ` AND ui.invoice_date <= $${paramIndex++}`;
      params.push(bitis);
    }
    if (tedarikci_vkn) {
      sql += ` AND ui.sender_vkn = $${paramIndex++}`;
      params.push(tedarikci_vkn);
    }

    sql += ` GROUP BY ui.ettn, ui.invoice_no, ui.sender_vkn, ui.sender_name, ui.invoice_date, ui.payable_amount, ui.tax_amount, ui.taxable_amount`;

    if (sadece_eslesmemis === 'true') {
      sql += ` HAVING COUNT(fk.id) > COUNT(fk.urun_id)`;
    }

    sql += ` ORDER BY ui.invoice_date DESC NULLS LAST LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit) || 100, Number(offset) || 0);

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /faturalar/:ettn/kalemler
 * Fatura kalemlerini getir (Uyumsoft'tan çekip cache'le)
 */
router.get('/faturalar/:ettn/kalemler', async (req, res) => {
  try {
    const ettnRaw = req.params.ettn ?? '';
    const ettn = String(ettnRaw).trim();

    // 1. Cache'de var mı?
    const cacheResult = await query(
      `
      SELECT
        fk.*,
        uk.kod as urun_kod,
        uk.ad as urun_ad,
        uk.kategori_id,
        kat.ad as kategori_ad,
        -- Standart birim fiyatı: Önce fatura kalemindeki kaydedilmiş değer, yoksa hesapla
        CASE
          WHEN fk.urun_id IS NOT NULL THEN
            COALESCE(
              fk.birim_fiyat_standart,
              fk.birim_fiyat / NULLIF(COALESCE(uk.birim_carpani, 1), 0)
            )
          ELSE NULL
        END as standart_birim_fiyat,
        -- Birim çarpanı: Ürün kartından
        COALESCE(uk.birim_carpani, 1) as birim_carpani,
        -- Standart birim: Ürün kartından
        COALESCE(uk.varsayilan_birim, 'KG') as standart_birim
      FROM fatura_kalemleri fk
      LEFT JOIN urun_kartlari uk ON uk.id = fk.urun_id
      LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      WHERE UPPER(TRIM(fk.fatura_ettn::text)) = UPPER(TRIM($1))
      ORDER BY fk.kalem_sira
    `,
      [ettn]
    );

    if (cacheResult.rows.length > 0) {
      const faturaResult = await query(
        `
        SELECT 
          ettn, invoice_no, sender_vkn, sender_name, 
          invoice_date, payable_amount as total_amount, tax_amount as vat_amount
        FROM uyumsoft_invoices WHERE UPPER(TRIM(ettn::text)) = UPPER(TRIM($1))
      `,
        [ettn]
      );

      return res.json({
        success: true,
        data: {
          fatura: faturaResult.rows[0] || null,
          kalemler: cacheResult.rows,
        },
        kaynak: 'cache',
      });
    }

    // 2. Cache'de yok; Uyumsoft UBL XML'den doğrudan çek (eski stok akışı gibi – DB/credentials zorunlu değil)
    let xmlResult;
    try {
      xmlResult = await faturaService.getFaturaXml(ettn);
    } catch (xmlErr) {
      return res.status(502).json({
        success: false,
        error:
          xmlErr?.message ||
          'Uyumsoft fatura XML alınamadı. Uyumsoft girişi (Scraper) ve bağlantıyı kontrol edip tekrar deneyin.',
      });
    }

    if (!xmlResult?.success || !xmlResult?.xml) {
      return res.status(502).json({
        success: false,
        error: 'Fatura XML alınamadı veya boş. Uyumsoft hesabınızı kontrol edin.',
      });
    }

    let parsed;
    try {
      parsed = await parseStringPromise(xmlResult.xml, {
        explicitArray: false,
        ignoreAttrs: false,
        tagNameProcessors: [(name) => name.replace(/^.*:/, '')],
      });
    } catch (_parseErr) {
      return res.status(400).json({
        success: false,
        error: 'Fatura XML parse edilemedi.',
      });
    }

    const topKeys = Object.keys(parsed || {});

    let invoice = parsed?.Invoice;
    if (!invoice && typeof parsed === 'object') {
      for (const k of topKeys) {
        const v = parsed[k];
        if (v && typeof v === 'object' && (v.Invoice || v.InvoiceLine)) {
          invoice = v.Invoice || v;
          break;
        }
      }
    }
    if (!invoice) {
      return res.status(400).json({
        success: false,
        error: "Fatura XML'de Invoice bulunamadı. Root: " + topKeys.join(', '),
      });
    }

    // Fatura özeti UBL'den (yedekteki gibi)
    const party = invoice.AccountingSupplierParty?.Party || {};
    const _val = (v) => (v != null && typeof v === 'object' && '_' in v ? v['_'] : v);
    const tedarikciVkn = _val(party.PartyIdentification?.ID) ?? party.PartyIdentification?.ID ?? '';
    const tedarikciAd = party.PartyName?.Name ?? tedarikciVkn;
    const faturaTarih = invoice.IssueDate ? String(invoice.IssueDate).slice(0, 10) : null;
    const faturaNo = _val(invoice.ID) ?? invoice.ID ?? '';
    const toplamTutar = parseFloat(
      _val(invoice.LegalMonetaryTotal?.PayableAmount) ?? invoice.LegalMonetaryTotal?.PayableAmount ?? 0
    );

    let invoiceLines = invoice.InvoiceLine;
    if (!Array.isArray(invoiceLines)) {
      invoiceLines = invoiceLines ? [invoiceLines] : [];
    }
    if (invoiceLines.length === 0 && invoice.InvoiceLines) {
      const pl = invoice.InvoiceLines;
      invoiceLines = Array.isArray(pl) ? pl : pl ? [pl] : [];
    }
    const invKeys = Object.keys(invoice || {});

    if (invoiceLines.length === 0) {
      return res.status(404).json({
        success: false,
        error:
          'Bu faturada kalem (InvoiceLine) bulunamadı. UBL yapısı farklı olabilir. Invoice alanları: ' +
          invKeys.slice(0, 15).join(', '),
      });
    }

    // UBL alanları: xml2js bazen '_' bazen ['_'] kullanır; yedekteki gibi her ikisini dene
    // INSERT ... RETURNING ile kalemleri topla (SELECT eşleşme sorununa güvenmiyoruz)
    const insertedRows = [];
    for (let i = 0; i < invoiceLines.length; i++) {
      const line = invoiceLines[i];
      const item = line.Item || {};
      const price = line.Price || {};
      const orijinalAd = item.Name || 'Bilinmiyor';
      const orijinalKod = _val(item.SellersItemIdentification?.ID) ?? item.SellersItemIdentification?.ID ?? null;
      const miktar = parseFloat(_val(line.InvoicedQuantity) || line.InvoicedQuantity || 0);
      const birim = line.InvoicedQuantity?.['$']?.unitCode ?? line.InvoicedQuantity?.$?.unitCode ?? 'C62';
      const birimFiyat = parseFloat(_val(price.PriceAmount) || price.PriceAmount || 0);
      const tutar = parseFloat(_val(line.LineExtensionAmount) || line.LineExtensionAmount || 0);
      const tax = line.TaxTotal?.TaxSubtotal || line.TaxTotal;
      const taxCat = tax?.TaxCategory ?? tax?.[0]?.TaxCategory;
      const kdvOrani = parseFloat(taxCat?.Percent || 0);
      const kdvTutari = parseFloat(_val(line.TaxTotal?.TaxAmount) || line.TaxTotal?.TaxAmount || 0);

      const ins = await query(
        `
        INSERT INTO fatura_kalemleri (
          fatura_ettn, kalem_sira, orijinal_urun_adi, orijinal_urun_kodu,
          miktar, birim, birim_fiyat, tutar, kdv_orani, kdv_tutari,
          tedarikci_vkn, tedarikci_ad, fatura_tarihi
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (fatura_ettn, kalem_sira) DO UPDATE SET
          orijinal_urun_adi = EXCLUDED.orijinal_urun_adi,
          miktar = EXCLUDED.miktar,
          birim_fiyat = EXCLUDED.birim_fiyat,
          tutar = EXCLUDED.tutar
        RETURNING *
      `,
        [
          ettn,
          i + 1,
          orijinalAd,
          orijinalKod,
          miktar,
          birim,
          birimFiyat,
          tutar,
          kdvOrani,
          kdvTutari,
          tedarikciVkn,
          tedarikciAd,
          faturaTarih,
        ]
      );
      if (ins.rows[0]) {
        const r = ins.rows[0];
        insertedRows.push({
          ...r,
          urun_kod: null,
          urun_ad: null,
          kategori_id: null,
          kategori_ad: null,
        });
      }
    }
    res.json({
      success: true,
      data: {
        fatura: {
          ettn,
          invoice_no: faturaNo,
          sender_vkn: tedarikciVkn,
          sender_name: tedarikciAd,
          invoice_date: faturaTarih,
          total_amount: toplamTutar,
        },
        kalemler: insertedRows,
      },
      kaynak: 'uyumsoft',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== EŞLEŞTİRME İŞLEMLERİ ====================

/**
 * Ürün kartı fiyatını güncelle ve fiyat geçmişine kaydet
 * STANDART BİRİM FİYATI hesaplanır (birim_carpani uygulanır)
 * @param {number} urunId - Ürün kartı ID
 * @param {number} birimFiyat - Fatura birim fiyat (koli/paket fiyatı olabilir)
 * @param {string} faturaTarihi - Fatura tarihi
 * @param {string} faturaEttn - Fatura ETTN
 * @param {string} tedarikciVkn - Tedarikçi VKN
 * @param {string} tedarikciAd - Tedarikçi adı
 * @returns {Object} Güncellenmiş ürün bilgisi ve eski fiyat
 */
async function urunFiyatGuncelle(urunId, birimFiyat, faturaTarihi, faturaEttn, _tedarikciVkn, tedarikciAd) {
  // Fiyat 0 veya null ise güncelleme yapma
  if (!birimFiyat || birimFiyat <= 0) {
    return { guncellendi: false, sebep: 'Geçersiz fiyat' };
  }

  // Mevcut ürün bilgisini al (birim_carpani dahil)
  const urunResult = await query(
    'SELECT id, ad, son_alis_fiyati, birim_carpani FROM urun_kartlari WHERE id = $1 AND aktif = true',
    [urunId]
  );

  if (urunResult.rows.length === 0) {
    return { guncellendi: false, sebep: 'Ürün bulunamadı' };
  }

  const urun = urunResult.rows[0];
  const eskiFiyat = urun.son_alis_fiyati;
  const birimCarpani = parseFloat(urun.birim_carpani) || 1;

  // STANDART BİRİM FİYATI hesapla (fatura fiyatı / birim çarpanı)
  const standartBirimFiyat = birimFiyat / birimCarpani;

  // Ürün kartı fiyatını güncelle (STANDART fiyat)
  await query(
    `UPDATE urun_kartlari
     SET son_alis_fiyati = $1,
         son_alis_tarihi = COALESCE($2::date, CURRENT_DATE),
         updated_at = NOW()
     WHERE id = $3`,
    [standartBirimFiyat, faturaTarihi, urunId]
  );

  // Fiyat geçmişine kaydet (STANDART fiyat)
  await query(
    `INSERT INTO urun_fiyat_gecmisi (urun_kart_id, fiyat, fatura_ettn, kaynak, aciklama, tarih)
     VALUES ($1, $2, $3, 'fatura_eslestirme', $4, COALESCE($5::date, CURRENT_DATE))
     ON CONFLICT DO NOTHING`,
    [
      urunId,
      standartBirimFiyat,
      faturaEttn,
      `Fatura eşleştirmesinden: ${tedarikciAd || 'Bilinmeyen tedarikçi'} (Çarpan: ${birimCarpani})`,
      faturaTarihi,
    ]
  );

  return {
    guncellendi: true,
    urun_ad: urun.ad,
    eski_fiyat: eskiFiyat,
    yeni_fiyat: standartBirimFiyat,
    fatura_fiyat: birimFiyat,
    birim_carpani: birimCarpani,
  };
}

/**
 * POST /faturalar/:ettn/kalemler/:sira/eslesdir
 * Tek kalemi ürün kartına eşleştir + fiyat güncelle
 */
router.post('/faturalar/:ettn/kalemler/:sira/eslesdir', async (req, res) => {
  try {
    const { ettn, sira } = req.params;
    const siraInt = parseInt(String(sira), 10);
    const ettnTrim = String(ettn ?? '').trim();
    const { urun_id, birim_carpani, standart_birim } = req.body;
    const userId = req.user?.id ?? null;

    // Parse birim çarpanı ve standart birim
    const carpanVal = birim_carpani != null && birim_carpani !== '' ? parseFloat(birim_carpani) : null;
    const birimVal = standart_birim && String(standart_birim).trim() ? String(standart_birim).trim() : null;

    // 0. Birim çarpanı/standart birim verilmişse ürün kartına yaz (kalıcı olsun)
    if (urun_id && (carpanVal != null || birimVal != null)) {
      await query(
        `UPDATE urun_kartlari SET
          birim_carpani = COALESCE($1, birim_carpani),
          varsayilan_birim = COALESCE($2, varsayilan_birim),
          updated_at = NOW()
         WHERE id = $3`,
        [carpanVal, birimVal, urun_id]
      );
    }

    // 1. Kalemi bul (önce mevcut değerleri alalım)
    const mevcutResult = await query(
      `SELECT * FROM fatura_kalemleri
       WHERE UPPER(TRIM(fatura_ettn::text)) = UPPER(TRIM($1)) AND kalem_sira = $2`,
      [ettnTrim, siraInt]
    );

    if (mevcutResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Kalem bulunamadı',
      });
    }

    const mevcutKalem = mevcutResult.rows[0];

    // 2. Standart birim fiyatı hesapla (birim çarpanı verilmişse kullan, yoksa 1)
    const efektifCarpan = carpanVal != null && !Number.isNaN(carpanVal) && carpanVal > 0 ? carpanVal : 1;
    const birimFiyat = mevcutKalem.birim_fiyat != null ? parseFloat(mevcutKalem.birim_fiyat) : 0;
    const stdFiyat = birimFiyat > 0 ? birimFiyat / efektifCarpan : null;

    // 3. Kalemi eşleştir (trigger birim_fiyat_standart'ı override edebilir)
    const result = await query(
      `UPDATE fatura_kalemleri
       SET urun_id = $1,
           eslestirme_tarihi = NOW(),
           eslestiren_kullanici = $4
       WHERE UPPER(TRIM(fatura_ettn::text)) = UPPER(TRIM($2)) AND kalem_sira = $3
       RETURNING *`,
      [urun_id, ettnTrim, siraInt, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Kalem güncellenemedi',
      });
    }

    // 4. birim_fiyat_standart'ı AYRI UPDATE ile yaz (trigger'dan SONRA, böylece override edilmez)
    if (stdFiyat != null) {
      await query(
        `UPDATE fatura_kalemleri
         SET birim_fiyat_standart = $1
         WHERE UPPER(TRIM(fatura_ettn::text)) = UPPER(TRIM($2)) AND kalem_sira = $3`,
        [stdFiyat, ettnTrim, siraInt]
      );
    }

    // 5. Güncel kalem verisini çek
    const kalemResult = await query(
      `SELECT * FROM fatura_kalemleri
       WHERE UPPER(TRIM(fatura_ettn::text)) = UPPER(TRIM($1)) AND kalem_sira = $2`,
      [ettnTrim, siraInt]
    );
    const kalem = kalemResult.rows[0];

    let fiyatBilgisi = null;

    // 2. Eğer urun_id varsa, fiyatı güncelle
    if (urun_id && kalem.birim_fiyat > 0) {
      fiyatBilgisi = await urunFiyatGuncelle(
        urun_id,
        kalem.birim_fiyat,
        kalem.fatura_tarihi,
        ettn,
        kalem.tedarikci_vkn,
        kalem.tedarikci_ad
      );
    }

    // 3. Güncellenmiş ürün bilgilerini al
    let urunBilgisi = null;
    if (urun_id) {
      const urunResult = await query(
        `SELECT uk.kod as urun_kod, uk.ad as urun_ad, uk.son_alis_fiyati, 
                kat.ad as kategori_ad
         FROM urun_kartlari uk
         LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
         WHERE uk.id = $1`,
        [urun_id]
      );
      if (urunResult.rows.length > 0) {
        urunBilgisi = urunResult.rows[0];
      }
    }

    res.json({
      success: true,
      data: {
        ...kalem,
        urun_kod: urunBilgisi?.urun_kod || null,
        urun_ad: urunBilgisi?.urun_ad || null,
        kategori_ad: urunBilgisi?.kategori_ad || null,
      },
      fiyat_guncelleme: fiyatBilgisi,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /faturalar/:ettn/toplu-eslesdir
 * Birden fazla kalemi toplu eşleştir
 */
router.post('/faturalar/:ettn/toplu-eslesdir', async (req, res) => {
  try {
    const { ettn } = req.params;
    const { eslesmeler } = req.body; // [{sira: 1, urun_id: 5}, ...]
    const userId = req.user?.id ?? null;

    if (!Array.isArray(eslesmeler) || eslesmeler.length === 0) {
      return res.status(400).json({ success: false, error: 'eslesmeler array olmalı ve boş olmamalı' });
    }

    const sonuclar = [];

    for (const e of eslesmeler) {
      const result = await query(
        `
        UPDATE fatura_kalemleri 
        SET urun_id = $1, eslestirme_tarihi = NOW(), eslestiren_kullanici = $4
        WHERE UPPER(TRIM(fatura_ettn::text)) = UPPER(TRIM($2)) AND kalem_sira = $3
        RETURNING kalem_sira, urun_id
      `,
        [e.urun_id, ettn, e.sira, userId]
      );

      if (result.rows.length > 0) {
        sonuclar.push(result.rows[0]);
      }
    }

    res.json({
      success: true,
      data: {
        eslesen: sonuclar.length,
        toplam: eslesmeler.length,
        sonuclar,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /faturalar/:ettn/otomatik-eslesdir
 * Eşleşmemiş kalemleri geçmiş eşleşmelere göre otomatik eşleştir
 */
router.post('/faturalar/:ettn/otomatik-eslesdir', async (req, res) => {
  try {
    const { ettn } = req.params;
    const userId = req.user?.id ?? null;

    // Eşleşmemiş kalemleri getir
    const kalemlerResult = await query(
      `
      SELECT kalem_sira, orijinal_urun_adi, tedarikci_vkn, tedarikci_ad, birim_fiyat, fatura_tarihi
      FROM fatura_kalemleri
      WHERE UPPER(TRIM(fatura_ettn::text)) = UPPER(TRIM($1)) AND urun_id IS NULL
      ORDER BY kalem_sira
      `,
      [ettn]
    );

    let basarili = 0;
    const patternGen = (ad) => `%${String(ad).trim()}%`;

    for (const kalem of kalemlerResult.rows) {
      const pattern = patternGen(kalem.orijinal_urun_adi);
      const tedarikciVkn =
        kalem.tedarikci_vkn && String(kalem.tedarikci_vkn).trim() ? String(kalem.tedarikci_vkn).trim() : null;

      // Öneri: geçmiş eşleşmelerden en çok eşleşen ürün
      const oneriResult = await query(
        `
        SELECT uk.id
        FROM fatura_kalemleri fk
        JOIN urun_kartlari uk ON uk.id = fk.urun_id
        WHERE fk.orijinal_urun_adi ILIKE $1
          AND ($2::text IS NULL OR $2 = '' OR fk.tedarikci_vkn = $2)
        GROUP BY uk.id
        ORDER BY COUNT(*) DESC
        LIMIT 1
        `,
        [pattern, tedarikciVkn]
      );

      if (oneriResult.rows.length === 0) continue;

      const urunId = oneriResult.rows[0].id;

      await query(
        `
        UPDATE fatura_kalemleri
        SET urun_id = $1, eslestirme_tarihi = NOW(), eslestiren_kullanici = $4
        WHERE UPPER(TRIM(fatura_ettn::text)) = UPPER(TRIM($2)) AND kalem_sira = $3
        `,
        [urunId, ettn, kalem.kalem_sira, userId]
      );

      if (kalem.birim_fiyat > 0) {
        await urunFiyatGuncelle(
          urunId,
          kalem.birim_fiyat,
          kalem.fatura_tarihi,
          ettn,
          kalem.tedarikci_vkn,
          kalem.tedarikci_ad
        );
      }
      basarili += 1;
    }

    res.json({
      success: true,
      data: { basarili },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /faturalar/:ettn/kalemler/:sira/eslesme
 * Eşleştirmeyi kaldır
 */
router.delete('/faturalar/:ettn/kalemler/:sira/eslesme', async (req, res) => {
  try {
    const { ettn, sira } = req.params;

    const result = await query(
      `
      UPDATE fatura_kalemleri 
      SET urun_id = NULL, eslestirme_tarihi = NULL, eslestiren_kullanici = NULL
      WHERE UPPER(TRIM(fatura_ettn::text)) = UPPER(TRIM($1)) AND kalem_sira = $2
      RETURNING *
    `,
      [ettn, sira]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kalem bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ÜRÜN ARAMA ====================

/**
 * GET /urunler/ara
 * Ürün kartlarında ara
 */
router.get('/urunler/ara', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q || String(q).length < 2) {
      return res.json({ success: true, data: [] });
    }

    const searchTerm = `%${String(q).trim()}%`;
    const limitNum = Math.min(Number(limit) || 20, 100);

    try {
      const result = await query(
        `
        SELECT 
          uk.id, uk.kod, uk.ad, uk.kategori_id,
          kat.ad as kategori_ad,
          vgf.son_fiyat, vgf.ortalama_fiyat
        FROM urun_kartlari uk
        LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
        LEFT JOIN v_urun_guncel_fiyat vgf ON vgf.id = uk.id
        WHERE uk.aktif = true AND (uk.ad ILIKE $1 OR uk.kod ILIKE $1)
        ORDER BY uk.ad ILIKE $1 DESC, uk.kod ILIKE $1 DESC, uk.ad
        LIMIT $2
      `,
        [searchTerm, limitNum]
      );
      return res.json({ success: true, data: result.rows });
    } catch (_simErr) {
      const result = await query(
        `
        SELECT 
          uk.id, uk.kod, uk.ad, uk.kategori_id,
          kat.ad as kategori_ad
        FROM urun_kartlari uk
        LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
        WHERE uk.aktif = true AND (uk.ad ILIKE $1 OR uk.kod ILIKE $1)
        ORDER BY uk.ad
        LIMIT $2
      `,
        [searchTerm, limitNum]
      );
      return res.json({ success: true, data: result.rows });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /urunler/oneriler
 * Kalem adına göre önerilen ürünler (geçmiş eşleşmeler + fuzzy)
 */
router.get('/urunler/oneriler', async (req, res) => {
  try {
    const { urun_adi, tedarikci_vkn } = req.query;

    if (!urun_adi) {
      return res.json({ success: true, data: [] });
    }

    const ad = String(urun_adi).trim();
    const pattern = `%${ad}%`;

    let result = await query(
      `
      SELECT DISTINCT
        uk.id, uk.kod, uk.ad,
        COUNT(*)::int as eslesme_sayisi,
        1 as oncelik
      FROM fatura_kalemleri fk
      JOIN urun_kartlari uk ON uk.id = fk.urun_id
      WHERE fk.orijinal_urun_adi ILIKE $1
        AND ($2::text IS NULL OR $2 = '' OR fk.tedarikci_vkn = $2)
      GROUP BY uk.id, uk.kod, uk.ad
      ORDER BY eslesme_sayisi DESC
      LIMIT 5
    `,
      [pattern, tedarikci_vkn && String(tedarikci_vkn).trim() ? String(tedarikci_vkn).trim() : null]
    );

    if (result.rows.length > 0) {
      return res.json({ success: true, data: result.rows });
    }

    try {
      result = await query(
        `
        SELECT 
          id, kod, ad,
          similarity(ad, $1)::numeric as benzerlik,
          2 as oncelik
        FROM urun_kartlari
        WHERE aktif = true AND similarity(ad, $1) > 0.3
        ORDER BY benzerlik DESC
        LIMIT 10
      `,
        [ad]
      );
    } catch (_) {
      result = await query(
        `
        SELECT id, kod, ad, 1::numeric as benzerlik, 2 as oncelik
        FROM urun_kartlari
        WHERE aktif = true AND ad ILIKE $1
        ORDER BY ad
        LIMIT 10
      `,
        [pattern]
      );
    }

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /urunler/hizli-olustur
 * Fatura kaleminden hızlı ürün kartı oluştur
 */
router.post('/urunler/hizli-olustur', async (req, res) => {
  try {
    const { ad, kod, kategori_id, birim } = req.body;

    if (!ad || !String(ad).trim()) {
      return res.status(400).json({ success: false, error: 'Ürün adı zorunlu' });
    }

    const result = await query(
      `
      INSERT INTO urun_kartlari (ad, kod, kategori_id, varsayilan_birim, created_at)
      VALUES ($1, $2, $3, COALESCE(NULLIF(TRIM($4), ''), 'ADET'), NOW())
      RETURNING *
    `,
      [String(ad).trim(), kod || null, kategori_id || null, birim || 'ADET']
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ success: false, error: 'Bu kod zaten kullanılıyor' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== FİYAT SORGULAMA ====================

/**
 * GET /fiyatlar/guncel
 * Tüm ürünlerin güncel fiyatları
 */
router.get('/fiyatlar/guncel', async (req, res) => {
  try {
    const { kategori_id, sadece_fiyatli } = req.query;

    let sql = `SELECT * FROM v_urun_guncel_fiyat WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (kategori_id) {
      sql += ` AND kategori_id = $${paramIndex++}`;
      params.push(kategori_id);
    }
    if (sadece_fiyatli === 'true') {
      sql += ` AND son_fiyat IS NOT NULL`;
    }

    sql += ` ORDER BY ad`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /fiyatlar/:urunId/gecmis
 * Ürünün fiyat geçmişi
 */
router.get('/fiyatlar/:urunId/gecmis', async (req, res) => {
  try {
    const { urunId } = req.params;
    const { limit = 50 } = req.query;

    const result = await query(
      `
      SELECT * FROM v_urun_fiyat_gecmisi
      WHERE urun_id = $1
      ORDER BY fatura_tarihi DESC NULLS LAST
      LIMIT $2
    `,
      [urunId, Math.min(Number(limit) || 50, 200)]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /fiyatlar/tedarikci-karsilastirma
 * Aynı ürün için tedarikçi fiyat karşılaştırması
 */
router.get('/fiyatlar/tedarikci-karsilastirma', async (req, res) => {
  try {
    const { urun_id } = req.query;

    if (!urun_id) {
      return res.status(400).json({ success: false, error: 'urun_id gerekli' });
    }

    const result = await query(
      `
      SELECT 
        tedarikci_vkn,
        tedarikci_ad,
        COUNT(*)::int as fatura_sayisi,
        ROUND(AVG(birim_fiyat)::numeric, 4) as ortalama_fiyat,
        MIN(birim_fiyat) as min_fiyat,
        MAX(birim_fiyat) as max_fiyat,
        MAX(fatura_tarihi) as son_fatura_tarihi
      FROM fatura_kalemleri
      WHERE urun_id = $1
      GROUP BY tedarikci_vkn, tedarikci_ad
      ORDER BY ortalama_fiyat ASC NULLS LAST
    `,
      [urun_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== RAF FİYATI (PİYASA) ====================

/**
 * GET /fiyatlar/:urunId/raf-fiyat
 * Ürünün son raf fiyatı araştırma sonuçları (Camgöz.net)
 */
router.get('/fiyatlar/:urunId/raf-fiyat', async (req, res) => {
  try {
    const { urunId } = req.params;

    // Detay satırları (market bazlı fiyatlar)
    const result = await query(
      `
      SELECT 
        pfg.id,
        pfg.urun_kart_id,
        pfg.stok_kart_id,
        pfg.urun_adi,
        pfg.piyasa_fiyat_min,
        pfg.piyasa_fiyat_max,
        pfg.piyasa_fiyat_ort,
        pfg.birim_fiyat,
        pfg.birim_tipi,
        pfg.kaynaklar,
        pfg.arastirma_tarihi,
        pfg.market_adi,
        pfg.marka,
        pfg.ambalaj_miktar,
        pfg.eslestirme_skoru,
        pfg.arama_terimi
      FROM piyasa_fiyat_gecmisi pfg
      WHERE pfg.stok_kart_id = $1
         OR pfg.urun_kart_id = $1
         OR pfg.urun_kart_id IN (
           SELECT uk2.id FROM urun_kartlari uk2
           WHERE LOWER(uk2.ad) = (SELECT LOWER(ad) FROM urun_kartlari WHERE id = $1)
         )
      ORDER BY pfg.arastirma_tarihi DESC NULLS LAST, pfg.birim_fiyat ASC NULLS LAST
      LIMIT 30
    `,
      [urunId]
    );

    // Özet bilgisi (IQR temizli tek satır)
    const ozetResult = await query(
      `SELECT * FROM urun_fiyat_ozet WHERE urun_kart_id = $1`,
      [urunId]
    ).catch(() => ({ rows: [] }));

    res.json({
      success: true,
      data: result.rows,
      ozet: ozetResult.rows[0] || null,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DEBUG ====================

/**
 * GET /debug/kalem/:ettn/:sira
 * Debug: Kalem ve ürün kartı bilgilerini göster
 */
router.get('/debug/kalem/:ettn/:sira', async (req, res) => {
  try {
    const ettn = String(req.params.ettn ?? '').trim();
    const sira = parseInt(String(req.params.sira), 10);

    const result = await query(
      `SELECT
         fk.id,
         fk.kalem_sira,
         fk.orijinal_urun_adi,
         fk.birim_fiyat,
         fk.birim_fiyat_standart,
         fk.urun_id,
         uk.ad as urun_ad,
         uk.birim_carpani as urun_birim_carpani,
         uk.varsayilan_birim as urun_varsayilan_birim
       FROM fatura_kalemleri fk
       LEFT JOIN urun_kartlari uk ON uk.id = fk.urun_id
       WHERE UPPER(TRIM(fk.fatura_ettn::text)) = UPPER(TRIM($1)) AND fk.kalem_sira = $2`,
      [ettn, sira]
    );

    res.json({
      success: true,
      debug: result.rows[0] || null,
      hesaplama: result.rows[0]
        ? {
            birim_fiyat: result.rows[0].birim_fiyat,
            urun_birim_carpani: result.rows[0].urun_birim_carpani,
            beklenen_standart_fiyat: result.rows[0].birim_fiyat / (result.rows[0].urun_birim_carpani || 1),
            kayitli_standart_fiyat: result.rows[0].birim_fiyat_standart,
          }
        : null,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== RAPORLAR ====================

/**
 * GET /raporlar/eslesme-durumu
 * Faturaların eşleşme durumu özeti
 */
router.get('/raporlar/eslesme-durumu', async (_req, res) => {
  try {
    const result = await query(`SELECT * FROM v_fatura_eslesme_durumu`);

    const toplam = result.rows.length;
    const tamEslesen = result.rows.filter((r) => Number(r.eslesme_yuzdesi) === 100).length;
    const kismiEslesen = result.rows.filter((r) => {
      const y = Number(r.eslesme_yuzdesi);
      return y > 0 && y < 100;
    }).length;
    const hicEslesmemis = result.rows.filter((r) => Number(r.eslesme_yuzdesi) === 0).length;

    res.json({
      success: true,
      data: {
        ozet: { toplam, tamEslesen, kismiEslesen, hicEslesmemis },
        faturalar: result.rows,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /raporlar/kategori-harcama
 * Kategorilere göre harcama özeti
 */
router.get('/raporlar/kategori-harcama', async (req, res) => {
  try {
    const { baslangic, bitis } = req.query;

    let sql = `
      SELECT 
        kat.id as kategori_id,
        kat.ad as kategori_ad,
        COUNT(fk.id)::int as kalem_sayisi,
        SUM(fk.tutar)::numeric as toplam_tutar,
        ROUND(AVG(fk.birim_fiyat)::numeric, 4) as ortalama_birim_fiyat
      FROM fatura_kalemleri fk
      JOIN urun_kartlari uk ON uk.id = fk.urun_id
      JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
      WHERE fk.urun_id IS NOT NULL
    `;

    const params = [];
    let paramIndex = 1;

    if (baslangic) {
      sql += ` AND fk.fatura_tarihi >= $${paramIndex++}`;
      params.push(baslangic);
    }
    if (bitis) {
      sql += ` AND fk.fatura_tarihi <= $${paramIndex++}`;
      params.push(bitis);
    }

    sql += ` GROUP BY kat.id, kat.ad ORDER BY toplam_tutar DESC NULLS LAST`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /raporlar/tedarikci-ozet
 * Tedarikçilere göre alım özeti
 */
router.get('/raporlar/tedarikci-ozet', async (req, res) => {
  try {
    const { baslangic, bitis } = req.query;

    let sql = `
      SELECT 
        tedarikci_vkn,
        tedarikci_ad,
        COUNT(DISTINCT fatura_ettn)::int as fatura_sayisi,
        COUNT(*)::int as kalem_sayisi,
        SUM(tutar)::numeric as toplam_tutar,
        MIN(fatura_tarihi) as ilk_fatura,
        MAX(fatura_tarihi) as son_fatura
      FROM fatura_kalemleri
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (baslangic) {
      sql += ` AND fatura_tarihi >= $${paramIndex++}`;
      params.push(baslangic);
    }
    if (bitis) {
      sql += ` AND fatura_tarihi <= $${paramIndex++}`;
      params.push(bitis);
    }

    sql += ` GROUP BY tedarikci_vkn, tedarikci_ad ORDER BY toplam_tutar DESC NULLS LAST`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
