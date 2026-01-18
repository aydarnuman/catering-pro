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
    this.defaultModel = "claude-sonnet-4-20250514"; // Fallback model
    this.maxIterations = 10; // Sonsuz döngüyü önle
  }

  /**
   * Aktif AI modelini veritabanından al
   */
  async getActiveModel() {
    try {
      const result = await query(`
        SELECT setting_value FROM ai_settings WHERE setting_key = 'default_model'
      `);
      
      if (result.rows.length > 0 && result.rows[0].setting_value) {
        const model = result.rows[0].setting_value;
        // JSON string ise parse et, değilse direkt kullan
        return typeof model === 'string' && model.startsWith('"') 
          ? JSON.parse(model) 
          : model;
      }
      return this.defaultModel;
    } catch (error) {
      console.error('Model yükleme hatası, varsayılan kullanılıyor:', error.message);
      return this.defaultModel;
    }
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
      const result = await query(`
        INSERT INTO ai_conversations (session_id, user_id, role, content, tools_used)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [sessionId, userId, role, content, toolsUsed]);
      
      return { id: result.rows[0]?.id || null };
    } catch (error) {
      console.error('Konuşma kaydetme hatası:', error);
      return { id: null };
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
   * Veritabanından şablon al
   */
  async getTemplateFromDB(templateSlug) {
    if (!templateSlug || templateSlug === 'default') {
      return null;
    }
    
    try {
      const result = await query(`
        SELECT slug, name, prompt, category, description, preferred_model 
        FROM ai_prompt_templates 
        WHERE (slug = $1 OR id::text = $1) AND is_active = TRUE
      `, [templateSlug]);
      
      // Kullanım sayacını artır
      if (result.rows[0]) {
        await query(`UPDATE ai_prompt_templates SET usage_count = usage_count + 1 WHERE slug = $1`, [templateSlug]);
      }
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Şablon yükleme hatası:', error);
      return null;
    }
  }

  /**
   * Şablona göre model seç
   * Şablonun preferred_model'i varsa onu kullan, yoksa global ayarı kullan
   */
  async getModelForTemplate(template) {
    // Şablonun özel modeli varsa onu kullan
    if (template && template.preferred_model) {
      console.log(`🎯 [AI Agent] Şablon modeli: ${template.preferred_model}`);
      return template.preferred_model;
    }
    
    // Yoksa global ayarı kullan
    return await this.getActiveModel();
  }

  /**
   * Sistem prompt'u oluştur (hafıza + şablon ile zenginleştirilmiş)
   */
  async getSystemPrompt(memories = [], templatePrompt = null) {
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

    // Şablon varsa ekle
    let templateSection = '';
    if (templatePrompt) {
      templateSection = `
## 🎯 AKTİF ŞABLON DAVRANIŞI
${templatePrompt}

Bu şablona göre yanıtlarını şekillendir. Yukarıdaki yönergeleri takip et.
`;
    }
    
    return `Sen bir **Catering Pro AI Asistanı**sın. Türkçe konuşuyorsun.
${templateSection}
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

## 📍 SAYFA BAĞLAMI ÇOK ÖNEMLİ!
Kullanıcının mesajında "[SAYFA CONTEXT: ...]" etiketi varsa, SORULARI O BAĞLAMDA YORUMLA!

### İHALE SAYFASINDA İSEK (İhale Uzmanı Modal):
Kullanıcı İHALE ile ilgili soru soruyor demektir. Terminoloji:
- "iş bitirim" → İş Deneyim/Bitirme Belgesi (ihale şartnamesi için)
- "referans" → Benzer iş referansları (ihale yeterlilik için)
- "geçici teminat" → İhale geçici teminat mektubu
- "kesin teminat" → Sözleşme kesin teminatı
- "yaklaşık maliyet" → İdarenin belirlediği tahmini ihale bedeli
- "sınır değer" → Aşırı düşük sınır hesabı
- "itiraz" → İhale itiraz/şikayet süreci
- "şartname" → Teknik/İdari şartname
- "yeterlilik" → İhale yeterlilik kriterleri
- "zeyilname" → İhale değişiklik bildirimi
- "teklif" → İhale teklif dosyası

YANLIŞ: "iş bitirim" sorulduğunda personel kıdem tazminatından bahsetme!
DOĞRU: İhaledeki İş Deneyim/Bitirme Belgesi şartını açıkla!

### FATURA/CARİ SAYFASINDA İSEK:
Sorular muhasebe/finans bağlamında yorumlanmalı.

### PERSONEL SAYFASINDA İSEK:
Sorular HR/bordro/özlük bağlamında yorumlanmalı.

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
    const { sessionId, userId = 'default', templateSlug, pageContext } = options;
    
    try {
      console.log(`🤖 [AI Agent] Sorgu: "${userMessage.substring(0, 100)}..."`);
      if (templateSlug) console.log(`📋 [AI Agent] Şablon: ${templateSlug}`);
      if (pageContext?.type) console.log(`📍 [AI Agent] Sayfa Context: ${pageContext.type}${pageContext.id ? '#' + pageContext.id : ''}`);
      
      // Sayfa context'i varsa mesajı zenginleştir (OTOMATİK URL-BASED)
      let enrichedMessage = userMessage;
      let contextInfo = '';
      
      // Context type ve department bilgisini al
      const contextType = pageContext?.type || 'general';
      const department = pageContext?.department || 'TÜM SİSTEM';
      const pathname = pageContext?.pathname || '';
      
      // Context bilgisini oluştur
      let contextParts = [];
      
      if (contextType === 'tender') {
        contextParts.push('🏷️ İHALE/İHALE TAKİP SAYFASINDAYIM');
        contextParts.push('Tüm sorular İHALE bağlamında yorumlanmalı!');
        contextParts.push('Terminoloji: iş bitirim=İş Deneyim Belgesi, teminat=Geçici/Kesin Teminat, sözleşme=İhale Sözleşmesi');
        
        if (pageContext?.id) {
          contextParts.push(`İhale ID: ${pageContext.id}`);
        }
        if (pageContext?.data) {
          const d = pageContext.data;
          if (d.title) contextParts.push(`İhale: "${d.title}"`);
          if (d.organization) contextParts.push(`Kurum: "${d.organization}"`);
          if (d.city) contextParts.push(`Şehir: "${d.city}"`);
          if (d.deadline) contextParts.push(`Tarih: "${d.deadline}"`);
          if (d.estimated_cost) contextParts.push(`Tahmini Bedel: ${d.estimated_cost}`);
          if (d.yaklasik_maliyet) contextParts.push(`Yaklaşık Maliyet: ${d.yaklasik_maliyet}`);
          if (d.sinir_deger) contextParts.push(`Sınır Değer: ${d.sinir_deger}`);
          if (d.bizim_teklif) contextParts.push(`Bizim Teklif: ${d.bizim_teklif}`);
          if (d.teklif_listesi && d.teklif_listesi.length > 0) {
            contextParts.push(`Diğer Teklifler: ${d.teklif_listesi.join(', ')}`);
          }
          if (d.teknik_sart_sayisi > 0) contextParts.push(`Teknik Şart: ${d.teknik_sart_sayisi} adet`);
          if (d.birim_fiyat_sayisi > 0) contextParts.push(`Birim Fiyat: ${d.birim_fiyat_sayisi} adet`);
        }
      } else if (contextType === 'personel') {
        contextParts.push('👤 PERSONEL/HR SAYFASINDAYIM');
        contextParts.push('Tüm sorular İK/BORDRO/ÖZLÜK bağlamında yorumlanmalı!');
        contextParts.push('Terminoloji: iş bitirim=Kıdem/İhbar Tazminatı, sözleşme=İş Sözleşmesi, süre=Çalışma Süresi');
        if (pageContext?.id) contextParts.push(`Personel ID: ${pageContext.id}`);
      } else if (contextType === 'invoice') {
        contextParts.push('🧾 FATURA SAYFASINDAYIM');
        contextParts.push('Tüm sorular FATURA/MUHASEBE bağlamında yorumlanmalı!');
        if (pageContext?.id) contextParts.push(`Fatura ID: ${pageContext.id}`);
      } else if (contextType === 'cari') {
        contextParts.push('🏢 CARİ HESAP SAYFASINDAYIM');
        contextParts.push('Tüm sorular CARİ/ALACAK-BORÇ bağlamında yorumlanmalı!');
        if (pageContext?.id) contextParts.push(`Cari ID: ${pageContext.id}`);
      } else if (contextType === 'stok') {
        contextParts.push('📦 STOK/SATIN ALMA SAYFASINDAYIM');
        contextParts.push('Tüm sorular STOK/ENVANTER/TEDARİK bağlamında yorumlanmalı!');
      } else if (contextType === 'planlama') {
        contextParts.push('👨‍🍳 MENÜ/PLANLAMA SAYFASINDAYIM');
        contextParts.push('Tüm sorular MENÜ/REÇETE/GRAMAJ bağlamında yorumlanmalı!');
      } else if (contextType === 'muhasebe') {
        contextParts.push('💰 MUHASEBE/FİNANS SAYFASINDAYIM');
        contextParts.push('Tüm sorular GELİR-GİDER/KASA-BANKA bağlamında yorumlanmalı!');
      }
      
      // Genel bilgi ekle
      if (department && department !== 'TÜM SİSTEM') {
        contextParts.push(`Department: ${department}`);
      }
      if (pathname) {
        contextParts.push(`URL: ${pathname}`);
      }
      
      if (contextParts.length > 0) {
        contextInfo = `\n\n[SAYFA CONTEXT: ${contextParts.join(' | ')}]`;
        enrichedMessage = userMessage + contextInfo;
      }

      // 1. Hafızayı yükle
      const memories = await this.loadMemoryContext(userId);
      console.log(`📚 [AI Agent] ${memories.length} hafıza yüklendi`);

      // 2. Şablonu yükle (varsa) - preferred_model dahil
      let templatePrompt = null;
      let loadedTemplate = null;
      if (templateSlug && templateSlug !== 'default') {
        loadedTemplate = await this.getTemplateFromDB(templateSlug);
        if (loadedTemplate) {
          templatePrompt = loadedTemplate.prompt;
          console.log(`🎯 [AI Agent] Şablon yüklendi: ${loadedTemplate.name}`);
          if (loadedTemplate.preferred_model) {
            console.log(`🧠 [AI Agent] Şablon özel modeli: ${loadedTemplate.preferred_model}`);
          }
        }
      }

      // 3. Önceki konuşmaları yükle (session varsa)
      let previousConversations = [];
      if (sessionId && conversationHistory.length === 0) {
        previousConversations = await this.loadPreviousConversations(sessionId, 10);
        console.log(`💬 [AI Agent] ${previousConversations.length} önceki konuşma yüklendi`);
      }

      // 4. Kullanıcı mesajını kaydet
      if (sessionId) {
        await this.saveConversation(sessionId, 'user', userMessage, [], userId);
      }

      // 5. Mesaj geçmişini hazırla (zenginleştirilmiş mesaj ile)
      const messages = [
        ...previousConversations,
        ...conversationHistory,
        { role: 'user', content: enrichedMessage }
      ];

      // Tool tanımlarını al
      const tools = aiTools.getToolDefinitions();

      let iteration = 0;
      let finalResponse = null;
      let toolResults = [];

      // 6. System prompt'u hazırla (hafıza + şablon ile)
      const systemPrompt = await this.getSystemPrompt(memories, templatePrompt);

      // Modeli seç: Şablonun özel modeli varsa onu kullan, yoksa global ayarı
      const activeModel = await this.getModelForTemplate(loadedTemplate);
      console.log(`🧠 [AI Agent] Model: ${activeModel}`);

      // Tool calling döngüsü
      while (iteration < this.maxIterations) {
        iteration++;
        console.log(`🔄 [AI Agent] İterasyon ${iteration}`);

        // Claude API çağrısı
        const response = await this.client.messages.create({
          model: activeModel,
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
      let conversationId = null;
      if (sessionId && finalResponse) {
        const convResult = await this.saveConversation(
          sessionId, 
          'assistant', 
          finalResponse, 
          toolResults.map(t => t.tool), 
          userId
        );
        conversationId = convResult?.id;
      }

      // 7. Otomatik öğrenme - arka planda çalıştır
      this.extractLearningFromConversation(userMessage, finalResponse, conversationId)
        .then(result => {
          if (result.facts && result.facts.length > 0) {
            console.log(`📚 [AI Agent] Otomatik öğrenme: ${result.facts.length} fact`);
          }
        })
        .catch(err => console.error('Öğrenme hatası:', err.message));

      console.log(`✅ [AI Agent] Cevap hazırlandı (${iteration} iterasyon, model: ${activeModel})`);

      return {
        success: true,
        response: finalResponse,
        toolsUsed: toolResults.map(t => t.tool),
        toolResults: toolResults,
        iterations: iteration,
        sessionId: sessionId,
        model: activeModel,
        templateSlug: templateSlug || 'default'
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
      const activeModel = await this.getActiveModel();
      const response = await this.client.messages.create({
        model: activeModel,
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

  /**
   * Konuşmadan otomatik fact çıkarımı (Öğrenme)
   * Kullanıcı ile AI konuşmasından önemli bilgileri çıkarır
   */
  async extractLearningFromConversation(userMessage, aiResponse, conversationId = null) {
    try {
      // Otomatik öğrenme aktif mi kontrol et
      const settingResult = await query(`
        SELECT setting_value FROM ai_settings WHERE setting_key = 'auto_learn_enabled'
      `);
      const autoLearnEnabled = settingResult.rows[0]?.setting_value ?? true;
      
      if (!autoLearnEnabled) {
        console.log('📚 [AI Learning] Otomatik öğrenme devre dışı');
        return { success: true, facts: [] };
      }

      // Fact çıkarımı için prompt
      const extractionPrompt = `Aşağıdaki kullanıcı mesajı ve AI yanıtından önemli bilgileri çıkar.

KULLANICI: "${userMessage}"
AI YANIT: "${aiResponse}"

Şu kategorilerde bilgi ara:
1. **entity** - Şirketler, kişiler, projeler (örn: "ABC Gıda tedarikçimiz", "Ahmet müdürümüz")
2. **preference** - Kullanıcı tercihleri (örn: "her zaman PDF formatında rapor ister")
3. **pattern** - Tekrarlayan kalıplar (örn: "KYK siparişleri genelde pazartesi")
4. **correction** - Düzeltmeler (örn: "Yanlış: X, Doğru: Y")

JSON formatında döndür (boş olabilir):
{
  "facts": [
    {
      "fact_type": "entity|preference|pattern|correction",
      "entity_type": "tedarikci|proje|personel|urun|genel",
      "entity_name": "ABC Gıda",
      "fact_key": "tip",
      "fact_value": "ana tedarikçi",
      "confidence": 0.85
    }
  ]
}

ÖNEMLİ KURALLAR:
- Sadece yeni ve önemli bilgileri çıkar
- Confidence 0.6'nın altında olanları dahil etme
- Genel bilgiler değil, spesifik bilgiler
- Maksimum 3 fact

Eğer önemli bir bilgi yoksa: {"facts": []}`;

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514', // Fact çıkarımı için hızlı model yeterli
        max_tokens: 500,
        system: 'Sen bir bilgi çıkarım asistanısın. Sadece JSON formatında yanıt ver.',
        messages: [{ role: 'user', content: extractionPrompt }]
      });

      const responseText = response.content[0].text;
      
      // JSON parse et
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { success: true, facts: [] };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const facts = parsed.facts || [];

      if (facts.length === 0) {
        return { success: true, facts: [] };
      }

      // Fact'leri veritabanına kaydet
      for (const fact of facts) {
        if (fact.confidence >= 0.6) {
          await query(`
            INSERT INTO ai_learned_facts 
            (source_conversation_id, fact_type, entity_type, entity_name, fact_key, fact_value, confidence)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            conversationId,
            fact.fact_type,
            fact.entity_type || 'genel',
            fact.entity_name || null,
            fact.fact_key,
            fact.fact_value,
            fact.confidence
          ]);
        }
      }

      console.log(`📚 [AI Learning] ${facts.length} fact çıkarıldı ve kaydedildi`);

      return {
        success: true,
        facts,
        message: `${facts.length} yeni bilgi öğrenildi`
      };

    } catch (error) {
      console.error('❌ [AI Learning] Hata:', error);
      return { success: false, error: error.message, facts: [] };
    }
  }

  /**
   * Günlük sistem özeti oluştur
   */
  async createDailySnapshot() {
    try {
      console.log('📸 [AI Snapshot] Günlük özet oluşturuluyor...');

      // Bugünün snapshot'u var mı?
      const existingSnapshot = await query(`
        SELECT id FROM ai_system_snapshot 
        WHERE snapshot_type = 'daily' 
        AND DATE(created_at) = CURRENT_DATE
      `);

      if (existingSnapshot.rows.length > 0) {
        console.log('📸 [AI Snapshot] Bugünün özeti zaten var');
        return { success: true, message: 'Bugünün özeti mevcut' };
      }

      // Sistem verilerini topla
      const summaries = {};

      // Cari özeti
      const cariResult = await query(`
        SELECT 
          COUNT(*) as toplam,
          COUNT(CASE WHEN tip = 'musteri' THEN 1 END) as musteri,
          COUNT(CASE WHEN tip = 'tedarikci' THEN 1 END) as tedarikci,
          COALESCE(SUM(borc), 0) as toplam_borc,
          COALESCE(SUM(alacak), 0) as toplam_alacak
        FROM cariler
      `);
      summaries.cariler = cariResult.rows[0];

      // Fatura özeti
      const faturaResult = await query(`
        SELECT 
          COUNT(*) as toplam,
          COUNT(CASE WHEN fatura_tipi = 'satis' THEN 1 END) as satis,
          COUNT(CASE WHEN fatura_tipi = 'alis' THEN 1 END) as alis,
          COALESCE(SUM(toplam_tutar), 0) as toplam_tutar
        FROM e_faturalar
        WHERE DATE(fatura_tarihi) >= DATE_TRUNC('month', CURRENT_DATE)
      `);
      summaries.faturalar = faturaResult.rows[0];

      // Personel özeti
      const personelResult = await query(`
        SELECT 
          COUNT(*) as toplam,
          COUNT(CASE WHEN durum = 'aktif' THEN 1 END) as aktif,
          COALESCE(AVG(maas), 0) as ortalama_maas
        FROM personeller
      `);
      summaries.personel = personelResult.rows[0];

      // İhale özeti
      const ihaleResult = await query(`
        SELECT 
          COUNT(*) as toplam,
          COUNT(CASE WHEN status IN ('new', 'analyzing') THEN 1 END) as aktif
        FROM tenders
        WHERE DATE(tender_date) >= CURRENT_DATE - INTERVAL '30 days'
      `);
      summaries.ihaleler = ihaleResult.rows[0];

      // Stok özeti (varsa)
      try {
        const stokResult = await query(`
          SELECT 
            COUNT(*) as toplam_urun,
            COUNT(CASE WHEN mevcut_miktar <= minimum_stok THEN 1 END) as kritik
          FROM stok_kartlari
        `);
        summaries.stok = stokResult.rows[0];
      } catch {
        summaries.stok = { toplam_urun: 0, kritik: 0 };
      }

      // AI istatistikleri
      const aiResult = await query(`
        SELECT 
          COUNT(*) as toplam_konusma,
          COUNT(DISTINCT session_id) as benzersiz_oturum
        FROM ai_conversations
        WHERE DATE(created_at) = CURRENT_DATE
      `);
      summaries.ai = aiResult.rows[0];

      // Snapshot kaydet
      await query(`
        INSERT INTO ai_system_snapshot (snapshot_type, summary_data)
        VALUES ('daily', $1)
      `, [JSON.stringify(summaries)]);

      console.log('📸 [AI Snapshot] Günlük özet kaydedildi');

      return {
        success: true,
        snapshot: summaries,
        message: 'Günlük sistem özeti oluşturuldu'
      };

    } catch (error) {
      console.error('❌ [AI Snapshot] Hata:', error);
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
const aiAgent = new AIAgentService();

export default aiAgent;
export { AIAgentService };

