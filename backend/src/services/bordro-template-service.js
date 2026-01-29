/**
 * Bordro Template Servisi
 *
 * Bordro dosya formatlarını kaydetme, eşleştirme ve hızlı parse için
 */

import crypto from 'node:crypto';
import { query } from '../database.js';

/**
 * Dosya formatından imza oluştur
 * İlk birkaç satırın hash'i - aynı format dosyalarını tanımak için
 */
export function createFormatSignature(excelData) {
  try {
    // İlk 3 satırın kolon isimlerini al
    const headers = excelData.headers || [];
    const firstRows = (excelData.json || []).slice(0, 3);

    // Kolon sayısı + başlık isimleri + veri tipleri
    const signatureData = {
      kolonSayisi: headers.length,
      basliklar: headers.slice(0, 20), // İlk 20 kolon
      veriTipleri: firstRows.map((row) =>
        Object.keys(row)
          .map((key) => typeof row[key])
          .slice(0, 20)
      ),
    };

    const hash = crypto.createHash('sha256').update(JSON.stringify(signatureData)).digest('hex').substring(0, 16); // İlk 16 karakter yeterli

    return hash;
  } catch (_error) {
    return null;
  }
}

/**
 * Kolon harfini sayıya çevir (A=0, B=1, ... Z=25, AA=26)
 */
function columnToIndex(col) {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return index - 1;
}

/**
 * Sayıyı kolon harfine çevir (0=A, 1=B, ... 25=Z, 26=AA)
 */
function indexToColumn(index) {
  let col = '';
  index++;
  while (index > 0) {
    const remainder = (index - 1) % 26;
    col = String.fromCharCode('A'.charCodeAt(0) + remainder) + col;
    index = Math.floor((index - 1) / 26);
  }
  return col;
}

/**
 * Template'e göre Excel verisi parse et
 */
export function parseWithTemplate(excelData, template) {
  try {
    const mapping = template.kolon_mapping;
    const startRow = template.veri_baslangic_satiri || 2;
    const rows = excelData.json || [];

    const records = [];
    const warnings = [];

    // Her satırı parse et
    for (let i = startRow - 1; i < rows.length; i++) {
      const row = rows[i];
      const record = {};
      let hasData = false;

      // Her alan için mapping'e göre değer al
      for (const [field, config] of Object.entries(mapping)) {
        const colIndex = columnToIndex(config.kolon);
        const colKey = Object.keys(row)[colIndex];
        let value = row[colKey];

        if (value !== null && value !== undefined && value !== '') {
          hasData = true;

          // Tip dönüşümü
          switch (config.tip) {
            case 'number':
              // Türk formatını düzelt (1.234,56 -> 1234.56)
              if (typeof value === 'string') {
                value = value.replace(/\./g, '').replace(',', '.');
              }
              value = parseFloat(value) || 0;
              break;

            case 'date':
              // Tarih formatı varsa dönüştür
              if (config.format && typeof value === 'string') {
                // Basit format dönüşümü
                value = convertDateFormat(value, config.format);
              }
              break;
            default:
              value = String(value).trim();
          }
        }

        record[field] = value || null;
      }

      // En az bir veri varsa kayıt ekle
      if (hasData && record.personel_adi) {
        records.push(record);
      }
    }

    return {
      success: true,
      records,
      warnings,
      total: records.length,
      template_kullanildi: template.ad,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      records: [],
      warnings: ['Template ile parse başarısız'],
    };
  }
}

/**
 * Tarih formatı dönüştür
 */
function convertDateFormat(dateStr, format) {
  try {
    const parts = dateStr.split(/[/.-]/);

    if (format === 'DD.MM.YYYY' || format === 'DD/MM/YYYY') {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    } else if (format === 'MM/DD/YYYY') {
      return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    } else if (format === 'YYYY-MM-DD') {
      return dateStr;
    }

    return dateStr;
  } catch {
    return dateStr;
  }
}

/**
 * Dosya imzasına göre template bul
 */
export async function findTemplateBySignature(signature, projeId = null) {
  try {
    let sql = `
      SELECT * FROM bordro_templates 
      WHERE format_imza = $1 AND aktif = TRUE
    `;
    const params = [signature];

    // Proje varsa önce projeye özel template'i ara
    if (projeId) {
      sql = `
        SELECT * FROM bordro_templates 
        WHERE format_imza = $1 AND aktif = TRUE
        ORDER BY 
          CASE WHEN proje_id = $2 THEN 0 ELSE 1 END,
          kullanim_sayisi DESC
        LIMIT 1
      `;
      params.push(projeId);
    } else {
      sql += ' ORDER BY kullanim_sayisi DESC LIMIT 1';
    }

    const result = await query(sql, params);
    return result.rows[0] || null;
  } catch (_error) {
    return null;
  }
}

/**
 * Tüm template'leri listele
 */
export async function listTemplates(projeId = null) {
  try {
    let sql = `
      SELECT t.*, p.ad as proje_adi
      FROM bordro_templates t
      LEFT JOIN projeler p ON t.proje_id = p.id
      WHERE t.aktif = TRUE
    `;
    const params = [];

    if (projeId) {
      sql += ' AND (t.proje_id = $1 OR t.proje_id IS NULL)';
      params.push(projeId);
    }

    sql += ' ORDER BY t.kullanim_sayisi DESC, t.created_at DESC';

    const result = await query(sql, params);
    return result.rows;
  } catch (_error) {
    return [];
  }
}

/**
 * Yeni template kaydet
 */
export async function saveTemplate(templateData) {
  const { ad, aciklama, proje_id, kolon_mapping, baslik_satiri, veri_baslangic_satiri, format_imza } = templateData;

  const sql = `
      INSERT INTO bordro_templates (
        ad, aciklama, proje_id, kolon_mapping, 
        baslik_satiri, veri_baslangic_satiri, format_imza
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (proje_id, ad) 
      DO UPDATE SET 
        kolon_mapping = EXCLUDED.kolon_mapping,
        baslik_satiri = EXCLUDED.baslik_satiri,
        veri_baslangic_satiri = EXCLUDED.veri_baslangic_satiri,
        format_imza = EXCLUDED.format_imza,
        aciklama = EXCLUDED.aciklama,
        updated_at = NOW()
      RETURNING *
    `;

  const result = await query(sql, [
    ad,
    aciklama || null,
    proje_id || null,
    JSON.stringify(kolon_mapping),
    baslik_satiri || 1,
    veri_baslangic_satiri || 2,
    format_imza || null,
  ]);

  return result.rows[0];
}

/**
 * Template kullanım sayısını artır
 */
export async function incrementTemplateUsage(templateId) {
  try {
    await query(
      `
      UPDATE bordro_templates 
      SET kullanim_sayisi = kullanim_sayisi + 1,
          son_kullanim = NOW()
      WHERE id = $1
    `,
      [templateId]
    );
  } catch (_error) {}
}

/**
 * Template sil
 */
export async function deleteTemplate(templateId) {
  await query(
    `
      UPDATE bordro_templates 
      SET aktif = FALSE 
      WHERE id = $1
    `,
    [templateId]
  );
  return true;
}

/**
 * Template güncelle
 */
export async function updateTemplate(templateId, updates) {
  const allowedFields = ['ad', 'aciklama', 'kolon_mapping', 'baslik_satiri', 'veri_baslangic_satiri'];
  const setClause = [];
  const params = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      setClause.push(`${key} = $${paramIndex}`);
      params.push(key === 'kolon_mapping' ? JSON.stringify(value) : value);
      paramIndex++;
    }
  }

  if (setClause.length === 0) {
    throw new Error('Güncellenecek alan bulunamadı');
  }

  params.push(templateId);

  const sql = `
      UPDATE bordro_templates 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

  const result = await query(sql, params);
  return result.rows[0];
}

/**
 * AI sonucundan template oluştur
 * AI'ın bulduğu kolon eşleştirmelerini template'e dönüştür
 */
export function createMappingFromAIResult(aiResult, excelData) {
  try {
    // AI sonucundan ilk kaydı al ve hangi kolonlardan geldiğini tahmin et
    const firstRecord = aiResult.records?.[0];
    if (!firstRecord) return null;

    const headers = excelData.headers || [];
    const mapping = {};

    // Bilinen alanlar ve olası başlık eşleşmeleri
    const fieldMatchers = {
      personel_adi: ['AD SOYAD', 'ADI SOYADI', 'PERSONEL', 'İSİM', 'AD', 'ÇALIŞAN'],
      tc_kimlik: ['TC', 'TC KİMLİK', 'T.C.', 'KİMLİK NO', 'TC NO'],
      sgk_no: ['SGK', 'SGK NO', 'SİGORTA NO', 'SSK NO'],
      brut_maas: ['BRÜT', 'BRÜT ÜCRET', 'BRÜT MAAŞ', 'GROSS'],
      net_maas: ['NET', 'NET ÜCRET', 'NET MAAŞ', 'ÖDENECEK', 'NET ÖDENECEK'],
      sgk_isci: ['SGK İŞÇİ', 'İŞÇİ PRİMİ', 'SGK KESİNTİSİ'],
      gelir_vergisi: ['GELİR VERGİSİ', 'GV', 'VERGİ'],
      damga_vergisi: ['DAMGA', 'DAMGA VERGİSİ', 'DV'],
      agi_tutari: ['AGİ', 'ASGARİ GEÇİM'],
      ise_giris_tarihi: ['İŞE GİRİŞ', 'BAŞLAMA', 'GİRİŞ TARİHİ'],
      departman: ['DEPARTMAN', 'BİRİM', 'BÖLÜM'],
      pozisyon: ['POZİSYON', 'GÖREV', 'UNVAN'],
    };

    // Her alan için en iyi kolon eşleşmesini bul
    for (const [field, matchers] of Object.entries(fieldMatchers)) {
      for (let i = 0; i < headers.length; i++) {
        const header = (headers[i] || '').toString().toUpperCase().trim();

        for (const matcher of matchers) {
          if (header.includes(matcher)) {
            mapping[field] = {
              kolon: indexToColumn(i),
              tip: ['brut_maas', 'net_maas', 'sgk_isci', 'gelir_vergisi', 'damga_vergisi', 'agi_tutari'].includes(field)
                ? 'number'
                : field === 'ise_giris_tarihi'
                  ? 'date'
                  : 'string',
            };

            if (field === 'ise_giris_tarihi') {
              mapping[field].format = 'DD.MM.YYYY';
            }

            break;
          }
        }

        if (mapping[field]) break;
      }
    }

    return Object.keys(mapping).length > 0 ? mapping : null;
  } catch (_error) {
    return null;
  }
}

export default {
  createFormatSignature,
  parseWithTemplate,
  findTemplateBySignature,
  listTemplates,
  saveTemplate,
  incrementTemplateUsage,
  deleteTemplate,
  updateTemplate,
  createMappingFromAIResult,
};
