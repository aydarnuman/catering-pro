/**
 * AI Tools Registry
 * Tüm modüllerin AI tool'larını merkezi olarak yönetir
 * Yeni modül eklendiğinde sadece buraya register edilir
 */

import satinAlmaTools from './satin-alma-tools.js';
import cariTools from './cari-tools.js';
import faturaTools from './fatura-tools.js';
import ihaleTools from './ihale-tools.js';
import raporTools from './rapor-tools.js';
import { personelToolDefinitions, personelToolImplementations } from './personel-tools.js';
import { webToolDefinitions, webToolImplementations } from './web-tools.js';

class AIToolsRegistry {
  constructor() {
    this.tools = new Map();
    this.toolDefinitions = [];
    
    // Tüm modül tool'larını register et
    this.registerModule('satin_alma', satinAlmaTools);
    this.registerModule('cari', cariTools);
    this.registerModule('fatura', faturaTools);
    this.registerModule('ihale', ihaleTools);
    this.registerModule('rapor', raporTools);
    
    // Personel modülü (yeni format)
    this.registerPersonelModule();
    
    // Web/Mevzuat modülü
    this.registerWebModule();
  }
  
  /**
   * Web/Mevzuat modülünü register et
   */
  registerWebModule() {
    console.log('🔧 [AI Tools] web/mevzuat modülü register ediliyor...');
    
    for (const toolDef of webToolDefinitions) {
      const handler = webToolImplementations[toolDef.name];
      if (handler) {
        this.tools.set(toolDef.name, handler.bind(webToolImplementations));
        this.toolDefinitions.push(toolDef);
      }
    }
    
    console.log(`✅ [AI Tools] web/mevzuat: ${webToolDefinitions.length} tool eklendi`);
  }

  /**
   * Personel modülünü register et (özel format)
   */
  registerPersonelModule() {
    console.log('🔧 [AI Tools] personel modülü register ediliyor...');
    
    for (const toolDef of personelToolDefinitions) {
      const handler = personelToolImplementations[toolDef.name];
      if (handler) {
        this.tools.set(toolDef.name, handler.bind(personelToolImplementations));
        this.toolDefinitions.push(toolDef);
      }
    }
    
    console.log(`✅ [AI Tools] personel: ${personelToolDefinitions.length} tool eklendi`);
  }

  /**
   * Modül tool'larını register et
   */
  registerModule(moduleName, moduleTools) {
    console.log(`🔧 [AI Tools] ${moduleName} modülü register ediliyor...`);
    
    for (const [toolName, tool] of Object.entries(moduleTools)) {
      const fullName = `${moduleName}_${toolName}`;
      this.tools.set(fullName, tool.handler);
      this.toolDefinitions.push({
        name: fullName,
        description: tool.description,
        input_schema: tool.parameters
      });
    }
    
    console.log(`✅ [AI Tools] ${moduleName}: ${Object.keys(moduleTools).length} tool eklendi`);
  }

  /**
   * Claude API için tool tanımlarını al
   */
  getToolDefinitions() {
    return this.toolDefinitions;
  }

  /**
   * Tool'u çalıştır
   */
  async executeTool(toolName, parameters) {
    const handler = this.tools.get(toolName);
    
    if (!handler) {
      return {
        success: false,
        error: `Tool bulunamadı: ${toolName}`
      };
    }

    try {
      console.log(`🔧 [AI Tools] Çalıştırılıyor: ${toolName}`, parameters);
      const result = await handler(parameters);
      console.log(`✅ [AI Tools] ${toolName} tamamlandı`);
      return result;
    } catch (error) {
      console.error(`❌ [AI Tools] ${toolName} hatası:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Mevcut tool'ları listele (debug için)
   */
  listTools() {
    return Array.from(this.tools.keys());
  }

  /**
   * Sistem özeti (AI context için)
   */
  getSystemContext() {
    return {
      availableModules: [
        'satin_alma - Satın alma ve sipariş yönetimi',
        'cari - Müşteri ve tedarikçi yönetimi', 
        'fatura - Fatura ve e-fatura yönetimi',
        'ihale - İhale takip ve analiz',
        'rapor - Raporlama ve analitik',
        'personel - Personel, bordro, izin ve kıdem yönetimi'
      ],
      totalTools: this.tools.size,
      capabilities: [
        'Veri sorgulama (siparişler, cariler, faturalar, ihaleler, personeller)',
        'Kayıt oluşturma (sipariş, proje, cari, izin talebi)',
        'Kayıt güncelleme (durum, öncelik, bilgiler)',
        'Kayıt silme',
        'Raporlama (proje bazlı, tedarikçi bazlı, dönemsel)',
        'Bordro ve maaş hesaplama',
        'Kıdem ve ihbar tazminatı hesaplama',
        'İzin yönetimi ve bakiye sorgulama',
        'SGK, vergi ve mevzuat bilgisi',
        'Analiz ve öneriler'
      ]
    };
  }
}

// Singleton instance
const aiTools = new AIToolsRegistry();

export default aiTools;
export { AIToolsRegistry };

