/**
 * AI API Routes
 * Claude AI entegrasyonu için API endpoint'leri
 * AI Agent - Tüm sisteme hakim akıllı asistan
 */

import express from 'express';
import claudeAI from '../services/claude-ai.js';
import aiAgent from '../services/ai-agent.js';
import { executeInvoiceQuery, formatInvoiceResponse } from '../services/invoice-ai.js';

const router = express.Router();

/**
 * POST /api/ai/chat
 * AI ile sohbet et (Eski endpoint - geriye uyumluluk için)
 */
router.post('/chat', async (req, res) => {
  try {
    const { question, department = 'TÜM SİSTEM', promptTemplate = 'default' } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Soru boş olamaz'
      });
    }

    console.log(`🤖 [AI Chat] Soru: "${question}" | Departman: ${department} | Prompt: ${promptTemplate}`);

    // Fatura ile ilgili sorgu kontrolü
    const lowerQuestion = question.toLowerCase();
    const invoiceKeywords = ['fatura', 'tavuk', 'et', 'sebze', 'alım', 'satış', 'tedarikçi', 'toplam tutar', 'kdv', 'ödeme', 'gider', 'maliyet'];
    const isInvoiceQuery = invoiceKeywords.some(keyword => lowerQuestion.includes(keyword));

    let result;
    
    if (isInvoiceQuery) {
      // Fatura sorgusunu çalıştır
      console.log('📊 Fatura sorgusu tespit edildi, veritabanından sorgulama yapılıyor...');
      
      try {
        const invoiceResult = await executeInvoiceQuery(question);
        const formattedResponse = formatInvoiceResponse(invoiceResult);
        
        // AI'ya sonuçları yorumlatmak için gönder
        const enrichedQuestion = `
          Kullanıcı sorusu: ${question}
          
          Veritabanı sorgu sonuçları:
          ${formattedResponse}
          
          Bu sonuçları kullanarak kullanıcının sorusuna detaylı ve anlaşılır bir cevap ver.
          Rakamları ve önemli bilgileri vurgula.
        `;
        
        result = await claudeAI.askQuestion(enrichedQuestion, 'MUHASEBE', promptTemplate);
        
        // Orijinal soruyu da yanıta ekle
        if (result.success && formattedResponse) {
          result.response = `📊 **Veritabanı Sorgu Sonuçları:**\n\n${formattedResponse}\n\n---\n\n${result.response}`;
        }
      } catch (invoiceError) {
        console.error('❌ Fatura sorgu hatası:', invoiceError);
        // Hata durumunda normal AI'ya devam et
        result = await claudeAI.askQuestion(question, department, promptTemplate);
      }
    } else {
      // Normal AI sorgusu
      result = await claudeAI.askQuestion(question, department, promptTemplate);
    }

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        response: result.response
      });
    }

    console.log(`✅ [AI Chat] Cevap uzunluğu: ${result.response.length} karakter`);

    return res.json({
      success: true,
      response: result.response,
      department,
      promptTemplate,
      usage: result.usage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [AI Chat] Hata:', error);
    return res.status(500).json({
      success: false,
      error: 'Sunucu hatası',
      response: 'Üzgünüm, şu anda bir teknik sorun yaşıyorum. Lütfen daha sonra tekrar deneyin.'
    });
  }
});

/**
 * POST /api/ai/agent
 * AI Agent - Tool Calling ile akıllı asistan
 * Tüm sisteme erişebilir, veri okuyabilir ve yazabilir
 */
router.post('/agent', async (req, res) => {
  try {
    const { message, history = [], sessionId, department } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Mesaj boş olamaz'
      });
    }

    console.log(`🤖 [AI Agent] Mesaj: "${message.substring(0, 100)}..." | Session: ${sessionId || 'yok'} | Dept: ${department || 'genel'}`);

    // Options ile sessionId ve department gönder - hafıza için önemli
    const options = {
      sessionId: sessionId || undefined,
      userId: 'default',
      department: department || 'TÜM SİSTEM'
    };

    const result = await aiAgent.processQuery(message, history, options);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        response: result.response
      });
    }

    console.log(`✅ [AI Agent] Cevap hazırlandı | Tools: ${result.toolsUsed.length} | İterasyonlar: ${result.iterations} | Session: ${sessionId || 'yok'}`);

    return res.json({
      success: true,
      response: result.response,
      toolsUsed: result.toolsUsed,
      iterations: result.iterations,
      sessionId: result.sessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [AI Agent] Hata:', error);
    return res.status(500).json({
      success: false,
      error: 'Sunucu hatası',
      response: 'Üzgünüm, şu anda bir teknik sorun yaşıyorum. Lütfen daha sonra tekrar deneyin.'
    });
  }
});

/**
 * GET /api/ai/agent/tools
 * Mevcut tool'ları listele
 */
router.get('/agent/tools', async (req, res) => {
  try {
    const tools = aiAgent.getToolDefinitions();
    const toolList = aiAgent.listTools();
    
    return res.json({
      success: true,
      count: toolList.length,
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.input_schema
      }))
    });

  } catch (error) {
    console.error('❌ [AI Agent Tools] Hata:', error);
    return res.status(500).json({
      success: false,
      error: 'Tool listesi alınamadı'
    });
  }
});

/**
 * POST /api/ai/agent/execute
 * Belirli bir tool'u doğrudan çalıştır
 */
router.post('/agent/execute', async (req, res) => {
  try {
    const { tool, parameters = {} } = req.body;

    if (!tool) {
      return res.status(400).json({
        success: false,
        error: 'Tool adı gerekli'
      });
    }

    console.log(`🔧 [AI Agent] Tool çalıştırılıyor: ${tool}`);

    const result = await aiAgent.executeTool(tool, parameters);

    return res.json(result);

  } catch (error) {
    console.error('❌ [AI Agent Execute] Hata:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ai/templates
 * Kullanılabilir prompt şablonlarını listele
 */
router.get('/templates', async (req, res) => {
  try {
    const templates = claudeAI.getPromptTemplates();
    
    const formattedTemplates = Object.entries(templates).map(([id, template]) => ({
      id,
      name: template.name,
      description: template.prompt.split('\n')[0], // İlk satırı açıklama olarak al
      category: id.includes('cfo') || id.includes('risk') ? 'Muhasebe' : 
               id.includes('ihale') ? 'İhale' : 'Genel'
    }));

    return res.json({
      success: true,
      templates: formattedTemplates
    });

  } catch (error) {
    console.error('❌ [AI Templates] Hata:', error);
    return res.status(500).json({
      success: false,
      error: 'Şablonlar yüklenemedi'
    });
  }
});

/**
 * POST /api/ai/analyze-product
 * Tek ürün analizi (muhasebe için)
 */
router.post('/analyze-product', async (req, res) => {
  try {
    const { itemDescription } = req.body;

    if (!itemDescription || itemDescription.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Ürün açıklaması boş olamaz'
      });
    }

    console.log(`🔍 [Product Analysis] Analiz ediliyor: "${itemDescription}"`);

    const result = await claudeAI.analyzeProduct(itemDescription);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        rawResponse: result.rawResponse
      });
    }

    console.log(`✅ [Product Analysis] Kategori: ${result.data.category} | Güven: ${result.data.confidence}`);

    return res.json({
      success: true,
      analysis: result.data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [Product Analysis] Hata:', error);
    return res.status(500).json({
      success: false,
      error: 'Ürün analizi yapılamadı'
    });
  }
});

/**
 * POST /api/ai/analyze-products-batch
 * Toplu ürün analizi (muhasebe için)
 */
router.post('/analyze-products-batch', async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Ürün listesi geçersiz'
      });
    }

    if (items.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maksimum 50 ürün analiz edilebilir'
      });
    }

    console.log(`🔍 [Batch Analysis] ${items.length} ürün analiz ediliyor...`);

    const result = await claudeAI.analyzeBatchProducts(items);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        rawResponse: result.rawResponse
      });
    }

    console.log(`✅ [Batch Analysis] ${result.data.length} ürün analiz edildi`);

    return res.json({
      success: true,
      analyses: result.data,
      totalItems: items.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [Batch Analysis] Hata:', error);
    return res.status(500).json({
      success: false,
      error: 'Toplu ürün analizi yapılamadı'
    });
  }
});

/**
 * GET /api/ai/status
 * AI servis durumunu kontrol et
 */
router.get('/status', async (req, res) => {
  try {
    const hasApiKey = !!process.env.CLAUDE_API_KEY;
    
    return res.json({
      success: true,
      status: hasApiKey ? 'active' : 'inactive',
      hasApiKey,
      model: 'claude-3-5-sonnet-20241022',
      features: [
        'chat',
        'product-analysis',
        'batch-analysis'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [AI Status] Hata:', error);
    return res.status(500).json({
      success: false,
      error: 'Durum kontrol edilemedi'
    });
  }
});

export default router;
