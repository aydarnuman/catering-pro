/**
 * Claude AI Service
 * Anthropic Claude API entegrasyonu
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../database.js';
import logger from '../utils/logger.js';

class ClaudeAIService {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.model = "claude-3-haiku-20240307";
  }

  /**
   * Prompt şablonlarını yükle
   */
  getPromptTemplates() {
    return {
      'default': {
        name: '🤖 Varsayılan',
        prompt: `Sen yardımcı bir AI asistanısın. Türkçe cevap ver.
- Açık ve anlaşılır ol
- Sayıları formatla (1.000.000 TL)
- Kaynak belirt
- Kısa ve öz cevaplar ver`
      },
      'cfo-analiz': {
        name: '📈 CFO Analizi',
        prompt: `Sen deneyimli bir CFO'sun. Mali verileri analiz ediyorsun.
- Türkçe cevap ver
- Sayıları formatla (1.000.000 TL şeklinde)
- Risk uyarıları yap
- Stratejik öneriler sun
- Kaynak belirt
- Grafik önerileri yap
- Trend analizleri yap`
      },
      'risk-uzman': {
        name: '⚠️ Risk Uzmanı',
        prompt: `Sen bir risk analiz uzmanısın. Türkçe cevap ver.
- Potansiyel riskleri belirt
- Önlem önerileri sun
- Acil durumları vurgula
- Olasılık hesapları yap
- Risk seviyelerini belirt (Düşük/Orta/Yüksek)
- Öncelik sıralaması yap`
      },
      'ihale-uzman': {
        name: '📋 İhale Uzmanı',
        prompt: `Sen bir ihale uzmanısın. İhale süreçlerinde uzmansın.
- Türkçe cevap ver
- Rekabet analizi yap
- Fırsat değerlendirmeleri sun
- Süreç önerileri ver
- Başarı oranları hesapla
- Teklif stratejileri öner
- Yasal uyarılar yap`
      },
      'hizli-yanit': {
        name: '⚡ Hızlı Yanıt',
        prompt: `Kısa ve öz cevap ver. Türkçe kullan.
- Maksimum 3 cümle
- Ana noktaları belirt
- Sayıları formatla
- Gereksiz detaya girme`
      }
    };
  }

  /**
   * Departman verilerini hazırla
   */
  async getDepartmentData(department) {
    try {
      const data = {};

      if (department === 'TÜM SİSTEM' || department === 'İHALE') {
        try {
          // İhale verileri
          const tenderStats = await query(`
            SELECT 
              COUNT(*) as total_tenders,
              COUNT(CASE WHEN tender_date > NOW() THEN 1 END) as active_tenders,
              COUNT(CASE WHEN tender_date <= NOW() THEN 1 END) as expired_tenders
            FROM tenders
          `);

          const recentTenders = await query(`
            SELECT title, tender_date, organization 
            FROM tenders 
            WHERE tender_date > NOW() 
            ORDER BY tender_date ASC 
            LIMIT 5
          `);

          data.ihale = {
            totalTenders: parseInt(tenderStats.rows[0].total_tenders),
            activeTenders: parseInt(tenderStats.rows[0].active_tenders),
            expiredTenders: parseInt(tenderStats.rows[0].expired_tenders),
            recentTenders: recentTenders.rows.map(t => ({
              title: t.title,
              date: t.tender_date,
              organization: t.organization
            }))
          };
        } catch (dbError) {
          logger.warn('İhale verileri çekilemedi', { error: dbError.message });
          data.ihale = {
            error: 'Veritabanı bağlantısı yok',
            description: 'İhale verileri şu anda erişilebilir değil'
          };
        }
      }

      if (department === 'TÜM SİSTEM' || department === 'MUHASEBE') {
        try {
          // Uyumsoft servisinden gerçek fatura verilerini al
          const { faturaService } = await import('../scraper/uyumsoft/index.js');
          
          let uyumsoftData = null;
          let faturaListesi = [];
          
          if (faturaService && faturaService.hasCredentials()) {
            try {
              // Son sync verilerini al
              const lastSync = faturaService.getLastSync();
              
              // Gerçek fatura listesini çek (son 10 fatura)
              const faturaResult = await faturaService.getFaturaList('gelen', { 
                months: 1, 
                maxInvoices: 10 
              });
              
              if (faturaResult.success) {
                faturaListesi = faturaResult.data.map(f => ({
                  faturaNo: f.invoiceId,
                  ettn: f.documentId,
                  gonderenUnvan: f.targetTitle,
                  gonderenVkn: f.targetVkn,
                  tutar: f.payableAmount,
                  kdvHaricTutar: f.taxExclusiveAmount,
                  kdvTutar: f.taxTotal,
                  tarih: f.executionDate,
                  olusturmaTarihi: f.createDate,
                  durum: f.status,
                  paraBirimi: f.currency
                }));
              }
              
              uyumsoftData = {
                isConnected: true,
                lastSyncDate: lastSync?.lastSync,
                totalInvoices: lastSync?.lastFaturaCount || 0,
                syncCount: lastSync?.syncCount || 0,
                recentInvoices: faturaListesi.slice(0, 5), // Son 5 fatura
                totalAmount: faturaListesi.reduce((sum, f) => sum + (f.tutar || 0), 0)
              };
            } catch (uyumError) {
              logger.warn('Uyumsoft veri hatası', { error: uyumError.message });
            }
          }

          data.muhasebe = {
            description: 'Muhasebe Modülü - Gerçek Durum',
            features: [
              'Fatura Yönetimi - Manuel ve otomatik fatura oluşturma',
              'Uyumsoft e-Fatura Entegrasyonu - SOAP API ile otomatik fatura çekme', 
              'Cari Hesap Takibi - Müşteri ve tedarikçi yönetimi',
              'Gelir/Gider Analizi - Mali durum raporlama',
              'Stok Yönetimi - Ürün ve malzeme takibi',
              'Personel Takibi - Çalışan bilgileri',
              'Kasa/Banka İşlemleri - Nakit akış yönetimi',
              'Raporlama Sistemi - Detaylı mali raporlar'
            ],
            uyumsoft: uyumsoftData || {
              isConnected: false,
              status: 'Bağlantı kurulmamış'
            },
            integrations: ['Uyumsoft e-Fatura SOAP API'],
            status: 'Aktif ve çalışır durumda',
            lastUpdate: new Date().toISOString()
          };
        } catch (muhasebeError) {
          logger.warn('Muhasebe veri hatası', { error: muhasebeError.message });
          data.muhasebe = {
            description: 'Muhasebe modülü aktif ancak veri erişimi sınırlı',
            status: 'Kısmi erişim',
            error: muhasebeError.message
          };
        }
      }

      if (department === 'TÜM SİSTEM') {
        data.sistem = {
          name: 'Catering Pro',
          description: 'AI Destekli İhale ve Muhasebe Yönetim Sistemi',
          modules: [
            '🏢 İhale Merkezi - İhale listesi, AI analiz, döküman yönetimi, EKAP entegrasyonu',
            '💰 Muhasebe - Fatura yönetimi, e-fatura entegrasyonu, mali raporlar',
            '🤖 AI Asistan - Claude AI ile akıllı analiz ve soru-cevap sistemi',
            '⚙️ Ayarlar - Sistem konfigürasyonu ve AI prompt yönetimi'
          ],
          technologies: [
            'Frontend: Next.js 14, React 18, Mantine UI 7',
            'Backend: Node.js, Express.js, PostgreSQL',
            'AI: Claude 3 Haiku (Anthropic API)',
            'Scraping: Puppeteer (EKAP), Uyumsoft SOAP API',
            'Styling: Mantine UI, CSS Modules'
          ],
          features: [
            'AI destekli ihale analizi',
            'Otomatik e-fatura entegrasyonu',
            'Akıllı soru-cevap sistemi',
            'Departman bazlı AI prompt sistemi',
            'Gerçek zamanlı veri senkronizasyonu'
          ],
          currentVersion: '1.0.0',
          developmentStatus: 'Aktif geliştirme aşamasında',
          lastUpdate: new Date().toISOString()
        };
      }

      return data;

    } catch (error) {
      logger.error('Veri hazırlama hatası', { error: error.message, stack: error.stack });
      
      // Fallback: Minimal sistem bilgileri
      return {
        sistem: {
          name: 'Catering Pro',
          description: 'AI Destekli İhale ve Muhasebe Yönetim Sistemi',
          status: 'Çalışır durumda',
          error: 'Detaylı veriler şu anda erişilebilir değil'
        }
      };
    }
  }

  /**
   * AI'ya soru sor
   */
  async askQuestion(question, department = 'TÜM SİSTEM', promptTemplate = 'default') {
    try {
      // Prompt şablonunu al
      const templates = this.getPromptTemplates();
      const template = templates[promptTemplate] || templates['default'];

      // Departman verilerini al
      const departmentData = await this.getDepartmentData(department);

      // Sistem promptunu oluştur
      const systemPrompt = `${template.prompt}

DEPARTMAN: ${department}
DEPARTMAN VERİLERİ: ${JSON.stringify(departmentData, null, 2)}

Yukarıdaki veriler ışığında kullanıcının sorusunu yanıtla.`;

      // Claude API'ye gönder
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: question
          }
        ]
      });

      return {
        success: true,
        response: message.content[0].text,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens
        }
      };

    } catch (error) {
      logger.error('Claude API Error', { error: error.message, stack: error.stack });
      
      return {
        success: false,
        error: error.message,
        response: 'Üzgünüm, şu anda bir teknik sorun yaşıyorum. Lütfen daha sonra tekrar deneyin.'
      };
    }
  }

  /**
   * Ürün analizi (muhasebe için)
   */
  async analyzeProduct(itemDescription) {
    try {
      const prompt = `Bu fatura kalemini analiz et ve kategorize et:
"${itemDescription}"

JSON formatında döndür:
{
  "category": "ET|SEBZE|MEYVE|SÜT|TAHIL|İÇECEK|TEMİZLİK|DİĞER",
  "product": "ürün adı (sadeleştirilmiş)",
  "quantity": sayı_veya_null,
  "unit": "kg|adet|litre|ton|kutu|paket|null",
  "confidence": 0.0_ile_1.0_arası
}

Örnekler:
"Dana eti A kalite 2 kg" → {"category":"ET","product":"dana eti","quantity":2,"unit":"kg","confidence":0.95}
"Domates 5 kg" → {"category":"SEBZE","product":"domates","quantity":5,"unit":"kg","confidence":0.90}
"Temizlik malzemesi" → {"category":"TEMİZLİK","product":"temizlik malzemesi","quantity":null,"unit":null,"confidence":0.80}`;

      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 500,
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const responseText = message.content[0].text;
      
      // JSON parse et
      try {
        const parsed = JSON.parse(responseText);
        return {
          success: true,
          data: parsed
        };
      } catch (parseError) {
        return {
          success: false,
          error: 'JSON parse hatası',
          rawResponse: responseText
        };
      }

    } catch (error) {
      logger.error('Product Analysis Error', { error: error.message, stack: error.stack });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Batch ürün analizi
   */
  async analyzeBatchProducts(items) {
    try {
      const prompt = `Bu fatura kalemlerini toplu analiz et:
${items.map((item, i) => `${i+1}. ${item}`).join('\n')}

Her biri için JSON array döndür:
[
  {"category":"ET","product":"dana eti","quantity":2,"unit":"kg","confidence":0.95},
  {"category":"SEBZE","product":"domates","quantity":5,"unit":"kg","confidence":0.90}
]`;

      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const responseText = message.content[0].text;
      
      try {
        const parsed = JSON.parse(responseText);
        return {
          success: true,
          data: parsed
        };
      } catch (parseError) {
        return {
          success: false,
          error: 'JSON parse hatası',
          rawResponse: responseText
        };
      }

    } catch (error) {
      logger.error('Batch Analysis Error', { error: error.message, stack: error.stack });
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Singleton instance
const claudeAI = new ClaudeAIService();

export default claudeAI;
export { ClaudeAIService };
