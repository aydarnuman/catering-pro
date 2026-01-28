/**
 * Uyumsoft Satış Faturası Servisi
 * E-fatura/E-arşiv fatura oluşturma ve gönderme
 */

import { query } from '../database.js';
import { faturaService } from '../scraper/uyumsoft/index.js';
import { faturaKalemleriClient } from './fatura-kalemleri-client.js';

class UyumsoftSalesService {
  /**
   * Manuel faturayı Uyumsoft'a gönder
   */
  async sendInvoiceToUyumsoft(invoiceId) {
    try {
      // 1. Manuel faturayı veritabanından al
      const invoice = await query(`
        SELECT 
          i.*,
          c.vergi_no as customer_vkn,
          c.email as customer_email,
          c.adres as customer_address
        FROM invoices i
        LEFT JOIN cariler c ON i.customer_id = c.id
        WHERE i.id = $1
      `, [invoiceId]);

      if (!invoice.rows.length) {
        throw new Error('Fatura bulunamadı');
      }

      const inv = invoice.rows[0];

      // 2. Uyumsoft formatına dönüştür
      const uyumsoftInvoice = {
        invoiceType: inv.invoice_type === 'sales' ? 'SATIŞ' : 'ALIŞ',
        invoiceProfile: 'TEMEL', // veya TİCARİ
        issueDate: inv.invoice_date,
        dueDate: inv.due_date,
        customer: {
          vkn: inv.customer_vkn,
          title: inv.customer_name,
          email: inv.customer_email,
          address: inv.customer_address,
        },
        lines: [],
        notes: inv.notes
      };

      // Kalem verisi tek kaynak: faturaKalemleriClient. ETTN ile kalem okumak için: faturaKalemleriClient.getKalemler(ettn)
      // Manuel invoice_id ile fatura_kalemleri eşleşmez (fatura_kalemleri fatura_ettn kullanır). Boş lines ile devam eder.
      uyumsoftInvoice.lines = [];

      // 4. Uyumsoft'a gönder
      const result = await faturaService.createAndSendInvoice(uyumsoftInvoice);

      // 5. ETTN'yi kaydet
      if (result.success && result.ettn) {
        await query(`
          UPDATE invoices 
          SET 
            ettn = $1,
            uyumsoft_status = 'sent',
            uyumsoft_sent_at = NOW()
          WHERE id = $2
        `, [result.ettn, invoiceId]);
      }

      return result;

    } catch (error) {
      console.error('Uyumsoft satış faturası hatası:', error);
      throw error;
    }
  }

  /**
   * Giden faturaları listele
   */
  async getOutgoingInvoices(params = {}) {
    const { startDate, endDate, limit = 100 } = params;

    try {
      // Uyumsoft'tan giden faturaları çek
      const result = await faturaService.getOutgoingInvoices({
        startDate,
        endDate,
        limit
      });

      // Veritabanına kaydet
      for (const invoice of result.data) {
        await query(`
          INSERT INTO uyumsoft_invoices (
            ettn, invoice_no, invoice_type,
            invoice_date, receiver_vkn, receiver_name,
            taxable_amount, tax_amount, payable_amount,
            currency, status, direction
          ) VALUES (
            $1, $2, 'outgoing', $3, $4, $5, $6, $7, $8, $9, $10, 'sent'
          ) ON CONFLICT (ettn) DO UPDATE SET
            status = EXCLUDED.status,
            updated_at = NOW()
        `, [
          invoice.ettn,
          invoice.invoiceNo,
          invoice.invoiceDate,
          invoice.receiverVkn,
          invoice.receiverTitle,
          invoice.taxExclusiveAmount,
          invoice.taxAmount,
          invoice.payableAmount,
          invoice.currency
        ]);
      }

      return result;

    } catch (error) {
      console.error('Giden fatura listesi hatası:', error);
      throw error;
    }
  }

  /**
   * E-arşiv fatura oluştur
   */
  async createEArchiveInvoice(data) {
    // Bireysel müşteriler için e-arşiv
    const invoice = {
      ...data,
      scenario: 'EARSIV',
      sendType: 'ELEKTRONIK' // veya KAGIT
    };

    return await faturaService.createEArchiveInvoice(invoice);
  }

  /**
   * Fatura iptal et
   */
  async cancelInvoice(ettn, reason) {
    return await faturaService.cancelInvoice(ettn, reason);
  }

  /**
   * Fatura durumu sorgula
   */
  async getInvoiceStatus(ettn) {
    return await faturaService.getInvoiceStatus(ettn);
  }
}

export default new UyumsoftSalesService();
