/**
 * Uyumsoft Fatura Servisi
 * API tabanlı fatura yönetimi
 */

import { UyumsoftApiClient } from './api-client.js';
import UyumsoftSession from './session.js';

class FaturaService {
  constructor() {
    this.session = new UyumsoftSession();
    this.client = null;
  }

  /**
   * API client'ı başlat
   */
  initClient() {
    const credentials = this.session.loadCredentials();
    if (!credentials) {
      throw new Error('Kayıtlı kimlik bilgisi bulunamadı. Önce giriş yapın.');
    }
    this.client = new UyumsoftApiClient(credentials.username, credentials.password);
    return this.client;
  }

  /**
   * Bağlantı durumunu kontrol et
   */
  async testConnection() {
    try {
      this.initClient();
      const result = await this.client.testConnection();
      return {
        success: result.success,
        message: result.message || 'Bağlantı başarılı',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Kullanıcı bilgilerini al
   */
  async getUserInfo() {
    try {
      this.initClient();
      const result = await this.client.whoAmI();
      
      if (!result.success) {
        throw new Error('Kullanıcı bilgisi alınamadı');
      }

      return {
        success: true,
        user: {
          username: result.value?.User?.Username,
          name: result.value?.User?.Name,
          surname: result.value?.User?.Surname,
          email: result.value?.User?.Email,
        },
        customer: {
          name: result.value?.Customer?.Name,
          vkn: result.value?.Customer?.VkTckNo,
          taxOffice: result.value?.Customer?.TaxOffice,
        },
        company: {
          branchName: result.value?.Company?.BranchName,
          email: result.value?.Company?.Email,
          phone: result.value?.Company?.PhoneNumber,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Fatura listesini çek
   * @param {Object} options - Seçenekler
   * @param {number} options.months - Kaç ay geriye git (default: 3) (startDate/endDate yoksa kullanılır)
   * @param {string|Date} options.startDate - Başlangıç tarihi (YYYY-MM-DD veya Date)
   * @param {string|Date} options.endDate - Bitiş tarihi (YYYY-MM-DD veya Date)
   * @param {number} options.maxInvoices - Maksimum fatura sayısı (default: 1000)
   * @param {number} options.pageSize - Sayfa başı kayıt (default: 100)
   */
  async syncFaturalar(options = {}) {
    const {
      months = 3,
      maxInvoices = 1000,
      pageSize = 100,
      startDate: optStart,
      endDate: optEnd,
    } = options;

    try {
      this.initClient();

      const endDate = optEnd
        ? (typeof optEnd === 'string' ? new Date(optEnd) : optEnd)
        : new Date();
      const startDate = optStart
        ? (typeof optStart === 'string' ? new Date(optStart) : optStart)
        : (() => { const d = new Date(); d.setMonth(d.getMonth() - months); return d; })();

      console.log(`📥 Fatura senkronizasyonu başlıyor...`);
      console.log(`   Tarih aralığı: ${startDate.toLocaleDateString('tr-TR')} - ${endDate.toLocaleDateString('tr-TR')}`);
      console.log(`   Maksimum fatura: ${maxInvoices}`);

      const allInvoices = [];
      let pageIndex = 0;
      let totalCount = 0;

      // İlk sayfayı çek ve toplam sayıyı öğren
      const firstPage = await this.client.getInboxInvoiceList({
        pageIndex: 0,
        pageSize,
        startDate,
        endDate,
      });

      totalCount = firstPage.totalCount;
      console.log(`   Toplam fatura: ${totalCount}`);

      allInvoices.push(...firstPage.invoices);

      // Kalan sayfaları çek
      const totalPages = Math.min(
        firstPage.totalPages,
        Math.ceil(maxInvoices / pageSize)
      );

      for (pageIndex = 1; pageIndex < totalPages && allInvoices.length < maxInvoices; pageIndex++) {
        console.log(`   Sayfa ${pageIndex + 1}/${totalPages} çekiliyor...`);
        
        const page = await this.client.getInboxInvoiceList({
          pageIndex,
          pageSize,
          startDate,
          endDate,
        });

        allInvoices.push(...page.invoices);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Limiti uygula
      const invoices = allInvoices.slice(0, maxInvoices);

      // Sync bilgisini kaydet
      this.session.saveLastSync(new Date().toISOString(), invoices.length);

      console.log(`✅ Senkronizasyon tamamlandı: ${invoices.length} fatura`);

      return {
        success: true,
        data: invoices,
        total: totalCount,
        fetched: invoices.length,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      };

    } catch (error) {
      console.error('❌ Senkronizasyon hatası:', error.message);
      return {
        success: false,
        message: error.message,
        data: [],
      };
    }
  }

  /**
   * Tek bir faturanın detayını al
   * @param {string} ettn - Fatura ETTN (DocumentId)
   */
  async getFaturaDetail(ettn) {
    try {
      this.initClient();

      console.log(`🔍 Fatura detayı çekiliyor: ${ettn}`);

      // HTML görünümü al
      const viewResult = await this.client.getInboxInvoiceView(ettn);
      
      return {
        success: true,
        ettn,
        html: viewResult.html,
        isVerified: viewResult.isVerified,
        signingDate: viewResult.signingDate,
      };

    } catch (error) {
      console.error('❌ Fatura detay hatası:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Fatura PDF'ini al
   * @param {string} ettn - Fatura ETTN (DocumentId)
   */
  async getFaturaPdf(ettn) {
    try {
      this.initClient();

      console.log(`📄 Fatura PDF çekiliyor: ${ettn}`);

      const pdfResult = await this.client.getInboxInvoicePdf(ettn);
      
      return {
        success: true,
        ettn,
        pdfBase64: pdfResult.pdfBase64,
      };

    } catch (error) {
      console.error('❌ Fatura PDF hatası:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Fatura XML'ini al
   * @param {string} ettn - Fatura ETTN (DocumentId)
   */
  async getFaturaXml(ettn) {
    try {
      this.initClient();

      console.log(`📋 Fatura XML çekiliyor: ${ettn}`);

      const xmlResult = await this.client.getInboxInvoiceData(ettn);
      
      // Base64'den XML'e çevir
      const xmlContent = xmlResult.xmlBase64 
        ? Buffer.from(xmlResult.xmlBase64, 'base64').toString('utf-8')
        : null;

      return {
        success: true,
        ettn,
        xml: xmlContent,
      };

    } catch (error) {
      console.error('❌ Fatura XML hatası:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Kayıtlı kimlik bilgisi var mı?
   */
  hasCredentials() {
    return this.session.loadCredentials() !== null;
  }

  /**
   * Kimlik bilgilerini kaydet
   */
  saveCredentials(username, password) {
    return this.session.saveCredentials(username, password);
  }

  /**
   * Son sync bilgisini al
   */
  getLastSync() {
    return this.session.getSyncData();
  }
}

// Singleton instance
const faturaService = new FaturaService();

export { FaturaService, faturaService };
export default faturaService;

