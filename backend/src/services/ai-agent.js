/**
 * AI Agent Service
 * Claude AI ile Tool Calling entegrasyonu
 * Tüm sisteme hakim, veri okuyabilen ve yazabilen akıllı asistan
 * + Hafıza Sistemi Entegrasyonu
 */

import Anthropic from '@anthropic-ai/sdk';
import aiTools from './ai-tools/index.js';
import { query } from '../database.js';

class AIAgentService {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.model = "claude-sonnet-4-20250514"; // Claude Sonnet 4
    this.maxIterations = 10; // Sonsuz döngüyü önle
  }

  /**
   * Hafızadan context yükle
   */
  async loadMemoryContext(userId = 'default') {
    try {
      const result = await query(`
        SELECT memory_type, category, key, value, importance
        FROM ai_memory 
        WHERE user_id = $1 
        ORDER BY importance DESC, usage_count DESC
        LIMIT 30
      `, [userId]);
      
      return result.rows;
    } catch (error) {
      console.error('Hafıza yükleme hatası:', error);
      return [];
    }
  }

  /**
   * Konuşmayı kaydet
   */
  async saveConversation(sessionId, role, content, toolsUsed = [], userId = 'default') {
    try {
      await query(`
        INSERT INTO ai_conversations (session_id, user_id, role, content, tools_used)
        VALUES ($1, $2, $3, $4, $5)
      `, [sessionId, userId, role, content, toolsUsed]);
    } catch (error) {
      console.error('Konuşma kaydetme hatası:', error);
    }
  }

  /**
   * Önceki konuşmaları yükle
   */
  async loadPreviousConversations(sessionId, limit = 10) {
    try {
      const result = await query(`
        SELECT role, content, tools_used, created_at
        FROM ai_conversations 
        WHERE session_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `, [sessionId, limit]);
      
      return result.rows.reverse().map(row => ({
        role: row.role,
        content: row.content
      }));
    } catch (error) {
      console.error('Konuşma yükleme hatası:', error);
      return [];
    }
  }

  /**
   * Yeni bilgi öğren
   */
  async learn(learnings, userId = 'default') {
    try {
      for (const learning of learnings) {
        await query(`
          INSERT INTO ai_memory (user_id, memory_type, category, key, value, importance)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (user_id, memory_type, key) 
          DO UPDATE SET 
            value = EXCLUDED.value,
            importance = GREATEST(ai_memory.importance, EXCLUDED.importance),
            usage_count = ai_memory.usage_count + 1,
            last_used_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        `, [userId, learning.memory_type, learning.category, learning.key, learning.value, learning.importance || 5]);
      }
      return true;
    } catch (error) {
      console.error('Öğrenme hatası:', error);
      return false;
    }
  }

  /**
   * Sistem prompt'u oluştur (hafıza ile zenginleştirilmiş)
   */
  async getSystemPrompt(memories = []) {
    const context = aiTools.getSystemContext();
    
    // Hafızaları organize et
    let memorySection = '';
    if (memories.length > 0) {
      const facts = memories.filter(m => m.memory_type === 'fact');
      const preferences = memories.filter(m => m.memory_type === 'preference');
      const patterns = memories.filter(m => m.memory_type === 'pattern');
      
      memorySection = `
## HAFIZAM (Bildiğim Şeyler)
${facts.map(f => `- ${f.key}: ${f.value}`).join('\n')}

## KULLANICI TERCİHLERİ
${preferences.map(p => `- ${p.key}: ${p.value}`).join('\n')}

## ÖĞRENDİĞİM KALIPLAR
${patterns.map(p => `- ${p.key}: ${p.value}`).join('\n')}
`;
    }
    
    return `Sen bir **Catering Pro AI Asistanı**sın. Türkçe konuşuyorsun.
${memorySection}

## KİMLİĞİN
Bir catering şirketinin operasyon yöneticisisin. Akıllı, yardımcı ve dikkatlisin.

## ALTIN KURALLAR (HER ZAMAN UYGULA!)

### 1. ASLA EKSİK BİLGİYLE İŞLEM YAPMA
- Sipariş oluşturmadan ÖNCE şunları mutlaka sor:
  * Ne sipariş edilecek? (ürün adı)
  * Ne kadar? (miktar + birim)
  * Hangi proje için? (KYK, HASTANE, MERKEZ)
  * Hangi tedarikçiden/firmadan? (ABC Süt, XYZ Gıda vs.)
- Bu 4 bilgi OLMADAN sipariş OLUŞTURMA!
- Eksik bilgi varsa TOOL ÇAĞIRMA, önce sor!

### 2. ONAY AL
- Her yazma işleminden ÖNCE özet göster ve "Onaylıyor musunuz?" sor
- Örnek: "KYK için 500 Lt süt siparişi oluşturacağım. Onaylıyor musunuz?"
- Kullanıcı "evet/tamam/onayla" demeden işlem YAPMA

### 3. ADIM ADIM YÖNLENDIR
Sipariş akışı - TÜM BİLGİLER ZORUNLU:
1. "Hangi ürünü sipariş etmek istiyorsunuz?"
2. "Ne kadar? (örn: 500 kg, 100 adet)"
3. "Hangi proje için? (KYK, HASTANE, MERKEZ)"
4. "Hangi firmadan/tedarikçiden alacağız?" ← ZORUNLU!
5. Özet göster → Onay al → İşlemi yap

⚠️ TEDARİKÇİ BİLGİSİ OLMADAN SİPARİŞ OLUŞTURMA!

### 4. AKILLI SORULAR SOR
- Belirsiz: "Süt sipariş et" → "Kaç litre süt istiyorsunuz?"
- Eksik proje: "Hangi proje/şube için?"
- Eksik miktar: "Ne kadar sipariş edeyim?"

## ÖRNEK DİYALOGLAR

❌ YANLIŞ:
Kullanıcı: "Sipariş oluştur"
AI: [Hemen tool çağırır, boş sipariş oluşturur]

✅ DOĞRU:
Kullanıcı: "Sipariş oluştur"
AI: "Tabii! Sipariş oluşturmak için şu bilgiler lazım:
1. Hangi ürünü sipariş edeceğiz?
2. Ne kadar miktar?
3. Hangi proje için (KYK, HASTANE, MERKEZ)?
4. Hangi firmadan/tedarikçiden?"

✅ DOĞRU (eksik bilgi):
Kullanıcı: "KYK için 500 litre süt sipariş et"
AI: "Harika! KYK için 500 litre süt. 
Hangi tedarikçiden/firmadan alacağız? (örn: ABC Süt, XYZ Gıda)"

✅ DOĞRU (tam bilgi):
Kullanıcı: "ABC Süt'ten KYK için 500 litre süt sipariş et"
AI: "Şu siparişi oluşturacağım:
📦 Ürün: Süt
📊 Miktar: 500 litre
🏢 Proje: KYK
🏭 Tedarikçi: ABC Süt
Onaylıyor musunuz?"
[Kullanıcı onaylarsa tool çağır]

## TOOL KULLANIMI
- OKUMA işlemleri (liste, özet, rapor): Direkt çağır
- YAZMA işlemleri (oluştur, güncelle, sil): ÖNCE onay al, SONRA çağır

## 🧠 BİLGİ KAYNAKLARI HİYERARŞİSİ (ÇOK ÖNEMLİ!)

### SIRA:
1. **VERİTABANI** → Şirket verisi için (personel, fatura, sipariş, cari)
2. **MEVZUAT_SORGULA** → Yasa, SGK, KİK, teşvik bilgisi için (YEREL)
3. **WEB_ARAMA** → SADECE yukarıdakiler yetmezse (SON ÇARE)

### KURALLAR:
- "Ahmet'in maaşı?" → VERİTABANI
- "SGK prim oranı?" → mevzuat_sorgula (sgk_oranlari)
- "Kıdem tazminatı nasıl hesaplanır?" → mevzuat_sorgula (is_kanunu)
- "KİK doğrudan temin limiti?" → mevzuat_sorgula (kik_mevzuat)
- "Yeni çıkan tebliğ?" → web_arama (güncellik gerekli)
- "Asgari ücret ne kadar?" → guncel_degerler

### MEVZUAT UZMANI OLARAK:
- İş hukuku, SGK mevzuatı, KİK kuralları hakkında bilgi verebilirsin
- Kıdem, ihbar tazminatı hesaplama kurallarını biliyorsun
- İhale mevzuatı ve yemek ihalesi özel kurallarını biliyorsun
- Teşvik ve indirimler hakkında bilgi verebilirsin

### ⚠️ WEB ARAMA SADECE:
- Bilgi bankasında olmayan güncel bilgi gerektiğinde
- Kullanıcı açıkça "internetten araştır" dediğinde
- Spesifik haber/duyuru sorulduğunda

## Mevcut Projeler
Sistemde şu projeler var: KYK, HASTANE, MERKEZ
Kullanıcı proje belirtmezse sor.

## Mevcut Durumlar
Sipariş durumları: talep → onay_bekliyor → onaylandi → siparis_verildi → teslim_alindi

Şu an tarih: ${new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  }

  /**
   * Kullanıcı sorusunu işle (Tool Calling ile)
   */
  async processQuery(userMessage, conversationHistory = [], options = {}) {
    const { sessionId, userId = 'default' } = options;
    
    try {
      console.log(`🤖 [AI Agent] Sorgu: "${userMessage.substring(0, 100)}..."`);

      // 1. Hafızayı yükle
      const memories = await this.loadMemoryContext(userId);
      console.log(`📚 [AI Agent] ${memories.length} hafıza yüklendi`);

      // 2. Önceki konuşmaları yükle (session varsa)
      let previousConversations = [];
      if (sessionId && conversationHistory.length === 0) {
        previousConversations = await this.loadPreviousConversations(sessionId, 10);
        console.log(`💬 [AI Agent] ${previousConversations.length} önceki konuşma yüklendi`);
      }

      // 3. Kullanıcı mesajını kaydet
      if (sessionId) {
        await this.saveConversation(sessionId, 'user', userMessage, [], userId);
      }

      // 4. Mesaj geçmişini hazırla
      const messages = [
        ...previousConversations,
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ];

      // Tool tanımlarını al
      const tools = aiTools.getToolDefinitions();

      let iteration = 0;
      let finalResponse = null;
      let toolResults = [];

      // 5. System prompt'u hazırla (hafıza ile)
      const systemPrompt = await this.getSystemPrompt(memories);

      // Tool calling döngüsü
      while (iteration < this.maxIterations) {
        iteration++;
        console.log(`🔄 [AI Agent] İterasyon ${iteration}`);

        // Claude API çağrısı
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 4096,
          system: systemPrompt,
          tools: tools,
          messages: messages
        });

        // Stop reason kontrol
        if (response.stop_reason === 'end_turn') {
          // Normal cevap - döngüden çık
          const textContent = response.content.find(c => c.type === 'text');
          finalResponse = textContent ? textContent.text : 'İşlem tamamlandı.';
          break;
        }

        if (response.stop_reason === 'tool_use') {
          // Tool çağrısı var
          const toolUses = response.content.filter(c => c.type === 'tool_use');
          
          // Assistant mesajını ekle
          messages.push({ role: 'assistant', content: response.content });

          // Her tool için çağrı yap
          const toolResultContents = [];
          
          for (const toolUse of toolUses) {
            console.log(`🔧 [AI Agent] Tool çağırılıyor: ${toolUse.name}`);
            
            const result = await aiTools.executeTool(toolUse.name, toolUse.input);
            
            toolResults.push({
              tool: toolUse.name,
              input: toolUse.input,
              result: result
            });

            toolResultContents.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(result, null, 2)
            });
          }

          // Tool sonuçlarını mesajlara ekle
          messages.push({ role: 'user', content: toolResultContents });
        } else {
          // Beklenmeyen stop reason
          console.log(`⚠️ [AI Agent] Beklenmeyen stop_reason: ${response.stop_reason}`);
          const textContent = response.content.find(c => c.type === 'text');
          finalResponse = textContent ? textContent.text : 'Bir sorun oluştu.';
          break;
        }
      }

      if (iteration >= this.maxIterations) {
        console.log(`⚠️ [AI Agent] Maksimum iterasyon sayısına ulaşıldı`);
        finalResponse = 'İşlem çok uzun sürdü, lütfen sorunuzu basitleştirin.';
      }

      // 6. Asistan cevabını kaydet
      if (sessionId && finalResponse) {
        await this.saveConversation(
          sessionId, 
          'assistant', 
          finalResponse, 
          toolResults.map(t => t.tool), 
          userId
        );
      }

      console.log(`✅ [AI Agent] Cevap hazırlandı (${iteration} iterasyon)`);

      return {
        success: true,
        response: finalResponse,
        toolsUsed: toolResults.map(t => t.tool),
        toolResults: toolResults,
        iterations: iteration,
        sessionId: sessionId
      };

    } catch (error) {
      console.error('❌ [AI Agent] Hata:', error);
      
      return {
        success: false,
        error: error.message,
        response: `Üzgünüm, bir hata oluştu: ${error.message}`
      };
    }
  }

  /**
   * Hızlı sorgu (tool kullanmadan)
   */
  async quickQuery(question) {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: 'Sen yardımcı bir asistansın. Kısa ve öz Türkçe cevaplar ver.',
        messages: [{ role: 'user', content: question }]
      });

      return {
        success: true,
        response: response.content[0].text
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Belirli bir tool'u doğrudan çalıştır
   */
  async executeTool(toolName, parameters) {
    return await aiTools.executeTool(toolName, parameters);
  }

  /**
   * Mevcut tool'ları listele
   */
  listTools() {
    return aiTools.listTools();
  }

  /**
   * Tool tanımlarını al
   */
  getToolDefinitions() {
    return aiTools.getToolDefinitions();
  }
}

// Singleton instance
const aiAgent = new AIAgentService();

export default aiAgent;
export { AIAgentService };

