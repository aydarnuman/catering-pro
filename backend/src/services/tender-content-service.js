/**
 * Tender Content Service
 * İhale içeriklerini (announcement_content, goods_services_content)
 * documents tablosuna kaydetme ve yönetme servisi
 */

import { pool } from '../database.js';

class TenderContentService {
  /**
   * İhale içeriklerini documents tablosuna kaydet
   * @param {number} tenderId - İhale ID
   * @returns {Object} - Kaydedilen dökümanlar
   */
  async createContentDocuments(tenderId) {
    const results = {
      tenderId,
      created: [],
      skipped: [],
      errors: [],
    };
    // İhale bilgilerini al
    const tenderResult = await pool.query(
      `SELECT id, title, announcement_content, goods_services_content 
         FROM tenders WHERE id = $1`,
      [tenderId]
    );

    if (tenderResult.rows.length === 0) {
      throw new Error(`İhale bulunamadı: ${tenderId}`);
    }

    const tender = tenderResult.rows[0];

    // Daha önce oluşturulmuş content dökümanları kontrol et
    const existingResult = await pool.query(
      `SELECT content_type FROM documents 
         WHERE tender_id = $1 AND source_type = 'content'`,
      [tenderId]
    );
    const existingTypes = existingResult.rows.map((r) => r.content_type);

    // 1. İhale İlanı (announcement_content)
    if (tender.announcement_content?.trim()) {
      if (existingTypes.includes('announcement')) {
        results.skipped.push('İhale İlanı (zaten mevcut)');
      } else {
        try {
          const docResult = await pool.query(
            `INSERT INTO documents (
                tender_id, filename, original_filename, file_type, file_size,
                file_path, content_text, content_type, doc_type, 
                source_type, processing_status, uploaded_by
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              RETURNING id, original_filename`,
            [
              tenderId,
              `ihale-ilani-${tenderId}.txt`,
              `İhale İlanı - ${tender.title}`,
              'text',
              tender.announcement_content.length,
              '', // file_path boş (content_text kullanılacak)
              tender.announcement_content,
              'announcement',
              'announcement',
              'content',
              'pending',
              'system',
            ]
          );

          results.created.push({
            id: docResult.rows[0].id,
            type: 'announcement',
            name: 'İhale İlanı',
            size: tender.announcement_content.length,
          });
        } catch (error) {
          results.errors.push(`İhale İlanı: ${error.message}`);
        }
      }
    } else {
      results.skipped.push('İhale İlanı (içerik yok)');
    }

    // 2. Mal/Hizmet Listesi (goods_services_content)
    if (
      tender.goods_services_content &&
      ((Array.isArray(tender.goods_services_content) && tender.goods_services_content.length > 0) ||
        (typeof tender.goods_services_content === 'object' && Object.keys(tender.goods_services_content).length > 0))
    ) {
      if (existingTypes.includes('goods_services')) {
        results.skipped.push('Mal/Hizmet Listesi (zaten mevcut)');
      } else {
        try {
          const contentText = Array.isArray(tender.goods_services_content)
            ? this.formatGoodsServicesAsText(tender.goods_services_content)
            : JSON.stringify(tender.goods_services_content, null, 2);

          const docResult = await pool.query(
            `INSERT INTO documents (
                tender_id, filename, original_filename, file_type, file_size,
                file_path, content_text, content_type, doc_type, 
                source_type, processing_status, uploaded_by
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              RETURNING id, original_filename`,
            [
              tenderId,
              `mal-hizmet-listesi-${tenderId}.json`,
              `Mal/Hizmet Listesi - ${tender.title}`,
              'json',
              contentText.length,
              '', // file_path boş
              contentText,
              'goods_services',
              'goods_services',
              'content',
              'pending',
              'system',
            ]
          );

          const itemCount = Array.isArray(tender.goods_services_content) ? tender.goods_services_content.length : 'N/A';

          results.created.push({
            id: docResult.rows[0].id,
            type: 'goods_services',
            name: 'Mal/Hizmet Listesi',
            size: contentText.length,
            itemCount,
          });
        } catch (error) {
          results.errors.push(`Mal/Hizmet Listesi: ${error.message}`);
        }
      }
    } else {
      results.skipped.push('Mal/Hizmet Listesi (içerik yok)');
    }

    return results;
  }

  /**
   * İhale için content dökümanlarını getir
   * @param {number} tenderId - İhale ID
   * @returns {Array} - Content dökümanları
   */
  async getContentDocuments(tenderId) {
    const result = await pool.query(
      `SELECT 
        id, tender_id, filename, original_filename, file_type, file_size,
        content_text, content_type, doc_type, source_type,
        processing_status, extracted_text, analysis_result, created_at
       FROM documents 
       WHERE tender_id = $1 AND source_type = 'content'
       ORDER BY content_type, created_at`,
      [tenderId]
    );

    return result.rows;
  }

  /**
   * Belirli bir content dökümanı kuyruğa ekle
   * @param {number} documentId - Döküman ID
   * @returns {Object} - Güncellenen döküman
   */
  async addContentToQueue(documentId) {
    const result = await pool.query(
      `UPDATE documents 
       SET processing_status = 'queued', 
           updated_at = NOW()
       WHERE id = $1 AND source_type = 'content'
       RETURNING id, original_filename, processing_status, content_type`,
      [documentId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Content döküman bulunamadı: ${documentId}`);
    }

    return result.rows[0];
  }

  /**
   * Mal/Hizmet listesini okunabilir metin formatına çevir
   * @param {Array} goodsServices - Mal/Hizmet array'i
   * @returns {string} - Formatlanmış metin
   */
  formatGoodsServicesAsText(goodsServices) {
    if (!Array.isArray(goodsServices) || goodsServices.length === 0) {
      return 'Mal/Hizmet listesi boş';
    }

    let text = 'MAL/HİZMET LİSTESİ\n';
    text += '='.repeat(50) + '\n\n';

    goodsServices.forEach((item, index) => {
      text += `${index + 1}. `;

      // Ortak alanları kontrol et
      if (item.mal_hizmet) text += `${item.mal_hizmet}\n`;
      if (item.birim) text += `   Birim: ${item.birim}\n`;
      if (item.miktar) text += `   Miktar: ${item.miktar}\n`;
      if (item.birim_fiyat) text += `   Birim Fiyat: ${item.birim_fiyat}\n`;
      if (item.toplam_fiyat) text += `   Toplam: ${item.toplam_fiyat}\n`;

      // Diğer alanları ekle
      Object.entries(item).forEach(([key, value]) => {
        if (!['mal_hizmet', 'birim', 'miktar', 'birim_fiyat', 'toplam_fiyat'].includes(key) && value) {
          text += `   ${key}: ${value}\n`;
        }
      });

      text += '\n';
    });

    return text;
  }

  /**
   * İhale için tüm dökümanları getir (content + download + upload)
   * @param {number} tenderId - İhale ID
   * @returns {Object} - Gruplandırılmış dökümanlar
   */
  async getAllDocuments(tenderId) {
    const result = await pool.query(
      `SELECT 
        id, tender_id, filename, original_filename, file_type, file_size,
        file_path, storage_path, storage_url, source_url, content_text,
        content_type, doc_type, source_type, is_extracted, parent_doc_id,
        processing_status, extracted_text, analysis_result, created_at
       FROM documents 
       WHERE tender_id = $1
       ORDER BY source_type, doc_type, created_at`,
      [tenderId]
    );

    const docs = result.rows;

    // Kaynak tipine göre grupla
    const grouped = {
      content: docs.filter((d) => d.source_type === 'content'),
      download: docs.filter((d) => d.source_type === 'download'),
      upload: docs.filter((d) => d.source_type === 'upload'),
    };

    return grouped;
  }
}

export default new TenderContentService();
