/**
 * Fatura AI Servisi
 * Fatura sorgularını SQL'e çevirir ve sonuçları yorumlar
 */

import { query } from '../database.js';
import { faturaKalemleriClient } from './fatura-kalemleri-client.js';

/**
 * Doğal dil sorgusunu SQL'e çevir
 */
export function parseInvoiceQuery(userQuery) {
  const lowerQuery = userQuery.toLowerCase();

  // Tarih aralığı tespit et
  const currentDate = new Date();
  let dateFilter = '';
  let dateParams = [];

  if (lowerQuery.includes('bu ay') || lowerQuery.includes('bu ayki')) {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    dateFilter = ' AND invoice_date >= $1 AND invoice_date <= $2';
    dateParams = [startOfMonth, endOfMonth];
  } else if (lowerQuery.includes('geçen ay')) {
    const startOfLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const endOfLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
    dateFilter = ' AND invoice_date >= $1 AND invoice_date <= $2';
    dateParams = [startOfLastMonth, endOfLastMonth];
  } else if (lowerQuery.includes('bu yıl')) {
    const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
    const endOfYear = new Date(currentDate.getFullYear(), 11, 31);
    dateFilter = ' AND invoice_date >= $1 AND invoice_date <= $2';
    dateParams = [startOfYear, endOfYear];
  }

  // Kategori tespit et
  let categoryFilter = '';
  const categories = {
    tavuk: ['tavuk', 'piliç', 'but', 'göğüs', 'kanat', 'ciğer'],
    et: ['et', 'kıyma', 'kuşbaşı', 'biftek', 'antrikot', 'dana', 'koyun', 'kuzu'],
    sebze: ['sebze', 'domates', 'biber', 'patlıcan', 'salatalık', 'marul', 'soğan', 'patates'],
    meyve: ['meyve', 'elma', 'portakal', 'muz', 'çilek', 'karpuz', 'kavun'],
    bakliyat: ['bakliyat', 'nohut', 'fasulye', 'mercimek', 'bulgur', 'pirinç'],
    süt: ['süt', 'yoğurt', 'peynir', 'ayran', 'tereyağı', 'kaşar'],
    yağ: ['yağ', 'zeytinyağı', 'ayçiçek', 'tereyağı', 'margarin'],
    baharat: ['baharat', 'tuz', 'karabiber', 'kimyon', 'kekik', 'pul biber'],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some((keyword) => lowerQuery.includes(keyword))) {
      categoryFilter = category;
      break;
    }
  }

  return {
    dateFilter,
    dateParams,
    categoryFilter,
    queryType: detectQueryType(lowerQuery),
  };
}

/**
 * Sorgu tipini tespit et
 */
function detectQueryType(query) {
  if (query.includes('toplam') || query.includes('kaç') || query.includes('ne kadar')) {
    return 'sum';
  } else if (query.includes('en çok') || query.includes('en fazla')) {
    return 'max';
  } else if (query.includes('en az')) {
    return 'min';
  } else if (query.includes('ortalama')) {
    return 'avg';
  } else if (query.includes('liste') || query.includes('göster')) {
    return 'list';
  } else if (query.includes('karşılaştır')) {
    return 'compare';
  }
  return 'sum'; // default
}

/**
 * Fatura sorgusunu çalıştır
 */
export async function executeInvoiceQuery(userQuery) {
  const parsed = parseInvoiceQuery(userQuery);
  const results = {};

  try {
    // Tek kaynak: faturaKalemleriClient
    if (parsed.categoryFilter) {
      const startDate =
        parsed.dateParams?.[0] != null
          ? typeof parsed.dateParams[0] === 'string'
            ? parsed.dateParams[0]
            : parsed.dateParams[0].toISOString?.().slice(0, 10)
          : undefined;
      const endDate =
        parsed.dateParams?.[1] != null
          ? typeof parsed.dateParams[1] === 'string'
            ? parsed.dateParams[1]
            : parsed.dateParams[1].toISOString?.().slice(0, 10)
          : undefined;
      const kategoriRows = await faturaKalemleriClient.getKategoriFaturaOzeti({
        categoryFilter: parsed.categoryFilter,
        startDate,
        endDate,
      });
      results.manual = kategoriRows;
    } else {
      // Genel özet sorgu
      let sql = `
        SELECT 
          invoice_type,
          COUNT(*) as count,
          SUM(subtotal) as subtotal,
          SUM(vat_total) as vat_total,
          SUM(total_amount) as total_amount
        FROM invoices
        WHERE status != 'cancelled'
      `;

      const params = [];

      if (parsed.dateFilter) {
        sql += parsed.dateFilter;
        params.push(...parsed.dateParams);
      }

      sql += ' GROUP BY invoice_type';

      const manualResult = await query(sql, params);
      results.manual = manualResult.rows;
    }

    // Uyumsoft faturalarından sorgula
    let uyumsoftSql = `
      SELECT 
        COUNT(*) as count,
        SUM(payable_amount) as total_amount,
        SUM(tax_amount) as total_vat,
        STRING_AGG(DISTINCT sender_name, ', ' ORDER BY sender_name) as suppliers
      FROM uyumsoft_invoices
      WHERE 1=1
    `;

    const uyumsoftParams = [];

    if (parsed.dateFilter) {
      uyumsoftSql += parsed.dateFilter;
      uyumsoftParams.push(...parsed.dateParams);
    }

    const uyumsoftResult = await query(uyumsoftSql, uyumsoftParams);
    results.uyumsoft = uyumsoftResult.rows;

    // Kategori sorgusu zaten fatura_kalemleri üzerinden (results.manual) yapıldı
    if (parsed.categoryFilter) {
      results.uyumsoftItems = results.manual || [];
    }

    // En çok alım yapılan tedarikçiler
    if (parsed.queryType === 'max' || userQuery.toLowerCase().includes('tedarikçi')) {
      const topSuppliersSQL = `
        SELECT 
          customer_name as supplier,
          COUNT(*) as invoice_count,
          SUM(total_amount) as total_amount
        FROM invoices
        WHERE invoice_type = 'purchase'
        AND status != 'cancelled'
        ${parsed.dateFilter}
        GROUP BY customer_name
        ORDER BY total_amount DESC
        LIMIT 10
      `;

      const topSuppliersResult = await query(topSuppliersSQL, parsed.dateParams);
      results.topSuppliers = topSuppliersResult.rows;

      // Uyumsoft'tan da tedarikçileri al
      const uyumsoftSuppliersSQL = `
        SELECT 
          sender_name as supplier,
          COUNT(*) as invoice_count,
          SUM(payable_amount) as total_amount
        FROM uyumsoft_invoices
        WHERE 1=1
        ${parsed.dateFilter}
        GROUP BY sender_name
        ORDER BY total_amount DESC
        LIMIT 10
      `;

      const uyumsoftSuppliersResult = await query(uyumsoftSuppliersSQL, parsed.dateParams);
      results.uyumsoftSuppliers = uyumsoftSuppliersResult.rows;
    }

    return {
      success: true,
      query: userQuery,
      parsed,
      results,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * AI yanıtını formatla
 */
export function formatInvoiceResponse(queryResult) {
  if (!queryResult.success) {
    return `Üzgünüm, sorgunuzu işlerken bir hata oluştu: ${queryResult.error}`;
  }

  const { results, parsed } = queryResult;
  let response = '';

  // Manuel faturalar özeti
  if (results.manual && results.manual.length > 0) {
    response += '📊 **Manuel Kayıtlı Faturalar:**\n';

    if (parsed.categoryFilter) {
      results.manual.forEach((row) => {
        response += `• ${row.category || parsed.categoryFilter}: `;
        response += `${row.invoice_count} fatura, `;
        response += `Toplam: ${formatMoney(row.total_amount)}, `;
        response += `Miktar: ${row.total_quantity}, `;
        response += `Ort. Birim Fiyat: ${formatMoney(row.avg_unit_price)}\n`;
        if (row.suppliers) {
          response += `  Tedarikçiler: ${row.suppliers}\n`;
        }
      });
    } else {
      results.manual.forEach((row) => {
        const type = row.invoice_type === 'sales' ? '💰 Satış' : '🛒 Alış';
        response += `• ${type}: ${row.count} fatura, Toplam: ${formatMoney(row.total_amount)}\n`;
      });
    }
    response += '\n';
  }

  // Uyumsoft faturaları özeti
  if (results.uyumsoft && results.uyumsoft.length > 0) {
    response += '📧 **E-Fatura (Uyumsoft):**\n';
    results.uyumsoft.forEach((row) => {
      response += `• ${row.count} fatura, Toplam: ${formatMoney(row.total_amount)}\n`;
      if (row.suppliers) {
        response += `  Tedarikçiler: ${row.suppliers.split(', ').slice(0, 5).join(', ')}`;
        if (row.suppliers.split(', ').length > 5) {
          response += ` ve ${row.suppliers.split(', ').length - 5} diğer`;
        }
        response += '\n';
      }
    });
    response += '\n';
  }

  // Uyumsoft kalem detayları
  if (results.uyumsoftItems && results.uyumsoftItems.length > 0) {
    response += '📦 **E-Fatura Kalem Detayları:**\n';
    results.uyumsoftItems.forEach((row) => {
      response += `• ${row.category}: `;
      response += `${row.item_count} kalem, `;
      response += `Toplam: ${formatMoney(row.total_amount)}, `;
      response += `Ort. Birim Fiyat: ${formatMoney(row.avg_unit_price)}\n`;
    });
    response += '\n';
  }

  // En çok alım yapılan tedarikçiler
  if (results.topSuppliers && results.topSuppliers.length > 0) {
    response += '🏢 **En Çok Alım Yapılan Firmalar (Manuel):**\n';
    results.topSuppliers.slice(0, 5).forEach((row, index) => {
      response += `${index + 1}. ${row.supplier}: ${formatMoney(row.total_amount)} (${row.invoice_count} fatura)\n`;
    });
    response += '\n';
  }

  if (results.uyumsoftSuppliers && results.uyumsoftSuppliers.length > 0) {
    response += '🏢 **En Çok Alım Yapılan Firmalar (E-Fatura):**\n';
    results.uyumsoftSuppliers.slice(0, 5).forEach((row, index) => {
      response += `${index + 1}. ${row.supplier}: ${formatMoney(row.total_amount)} (${row.invoice_count} fatura)\n`;
    });
  }

  // Boş sonuç
  if (!response) {
    response = 'Belirtilen kriterlere uygun fatura bulunamadı. ';
    if (parsed.dateFilter) {
      response += 'Tarih aralığını kontrol edin. ';
    }
    if (parsed.categoryFilter) {
      response += `"${parsed.categoryFilter}" kategorisinde kayıt olmayabilir.`;
    }
  }

  return response;
}

/**
 * Para formatla
 */
function formatMoney(value) {
  if (!value && value !== 0) return '₺0';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
  }).format(value);
}

export default {
  parseInvoiceQuery,
  executeInvoiceQuery,
  formatInvoiceResponse,
};
