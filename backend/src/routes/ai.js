/**
 * AI API Routes
 * Claude AI entegrasyonu için API endpoint'leri
 * AI Agent - Tüm sisteme hakim akıllı asistan
 */

import express from 'express';
import claudeAI from '../services/claude-ai.js';
import aiAgent from '../services/ai-agent.js';
import { executeInvoiceQuery, formatInvoiceResponse } from '../services/invoice-ai.js';
import { query } from '../database.js';
import { authenticate, optionalAuth, requireAdmin, requireSuperAdmin } from '../middleware/auth.js';
import aiTools from '../services/ai-tools/index.js';
import logger from '../utils/logger.js';
import SettingsVersionService from '../services/settings-version-service.js';

const router = express.Router();

// Tüm AI endpoint'leri için authentication gerekli (status ve chat hariç)
// Status public kalabilir (health check amaçlı)

/**
 * POST /api/ai/chat
 * AI ile sohbet et (Eski endpoint - geriye uyumluluk için)
 */
router.post('/chat', optionalAuth, async (req, res) => {
  try {
    const { question, department = 'TÜM SİSTEM', promptTemplate = 'default' } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Soru boş olamaz'
      });
    }

    logger.debug(`[AI Chat] Soru: "${question}" | Departman: ${department} | Prompt: ${promptTemplate}`);

    // Fatura ile ilgili sorgu kontrolü
    const lowerQuestion = question.toLowerCase();
    const invoiceKeywords = ['fatura', 'tavuk', 'et', 'sebze', 'alım', 'satış', 'tedarikçi', 'toplam tutar', 'kdv', 'ödeme', 'gider', 'maliyet'];
    const isInvoiceQuery = invoiceKeywords.some(keyword => lowerQuestion.includes(keyword));

    let result;
    
    if (isInvoiceQuery) {
      // Fatura sorgusunu çalıştır
      logger.debug('[AI Chat] Fatura sorgusu tespit edildi, veritabanından sorgulama yapılıyor');
      
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
        logger.error('[AI Chat] Fatura sorgu hatası', { error: invoiceError.message, stack: invoiceError.stack });
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

    logger.debug(`[AI Chat] Cevap uzunluğu: ${result.response.length} karakter`);

    return res.json({
      success: true,
      response: result.response,
      department,
      promptTemplate,
      usage: result.usage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[AI Chat] Hata', { error: error.message, stack: error.stack });
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
router.post('/agent', optionalAuth, async (req, res) => {
  try {
    const { message, systemContext, history = [], sessionId, department, templateSlug, pageContext } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Mesaj boş olamaz'
      });
    }

    logger.debug(`[AI Agent] Mesaj: "${message.substring(0, 100)}..." | Session: ${sessionId || 'yok'} | Dept: ${department || 'genel'} | Şablon: ${templateSlug || 'default'} | Context: ${pageContext?.type || 'genel'}${pageContext?.id ? '#' + pageContext.id : ''}`);

    // Options ile sessionId, department, templateSlug, pageContext ve systemContext gönder
    const options = {
      sessionId: sessionId || undefined,
      userId: 'default',
      department: department || 'TÜM SİSTEM',
      templateSlug: templateSlug || 'default',
      pageContext: pageContext || undefined,
      systemContext: systemContext || undefined  // İhale verileri context'i (kaydedilmeyecek)
    };

    const result = await aiAgent.processQuery(message, history, options);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        response: result.response
      });
    }

    logger.info(`[AI Agent] Cevap hazırlandı | Tools: ${result.toolsUsed.length} | İterasyonlar: ${result.iterations} | Session: ${sessionId || 'yok'}`);

    return res.json({
      success: true,
      response: result.response,
      toolsUsed: result.toolsUsed,
      iterations: result.iterations,
      sessionId: result.sessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[AI Agent] Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Sunucu hatası',
      response: 'Üzgünüm, şu anda bir teknik sorun yaşıyorum. Lütfen daha sonra tekrar deneyin.'
    });
  }
});

// ============================================================
// NORMAL AI ENDPOINT'LERİ
// ============================================================
// NOT: God Mode endpoint'leri aşağıda tanımlı (satır ~1970)

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
    logger.error('[AI Agent Tools] Hata', { error: error.message, stack: error.stack });
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

    logger.debug(`[AI Agent] Tool çalıştırılıyor: ${tool}`);

    const result = await aiAgent.executeTool(tool, parameters);

    return res.json(result);

  } catch (error) {
    logger.error('[AI Agent Execute] Hata', { error: error.message, stack: error.stack, tool });
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ai/templates
 * Kullanılabilir prompt şablonlarını listele (veritabanından)
 */
router.get('/templates', async (req, res) => {
  try {
    const { category, active_only } = req.query;
    
    let sql = `
      SELECT id, slug, name, description, prompt, category, icon, color,
             is_active, is_default, is_system, usage_count, created_at, updated_at,
             preferred_model
      FROM ai_prompt_templates
      WHERE 1=1
    `;
    const params = [];
    
    if (active_only !== 'false') {
      sql += ` AND is_active = TRUE`;
    }
    
    if (category) {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }
    
    sql += ` ORDER BY is_default DESC, usage_count DESC, name ASC`;
    
    const result = await query(sql, params);
    
    return res.json({
      success: true,
      templates: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    logger.error('[AI Templates] Hata', { error: error.message, stack: error.stack });
    
    // Fallback: Service'den al (tablo henüz oluşturulmamışsa)
    try {
      const templates = claudeAI.getPromptTemplates();
      const formattedTemplates = Object.entries(templates).map(([id, template]) => ({
        id: 0,
        slug: id,
        name: template.name,
        description: template.prompt.split('\n')[0],
        prompt: template.prompt,
        category: id.includes('cfo') || id.includes('risk') ? 'Muhasebe' : 
                 id.includes('ihale') ? 'İhale' : 'Genel',
        icon: template.name.split(' ')[0],
        color: 'blue',
        is_active: true,
        is_default: id === 'default',
        is_system: true,
        usage_count: 0
      }));

      return res.json({
        success: true,
        templates: formattedTemplates,
        count: formattedTemplates.length,
        source: 'fallback'
      });
    } catch (fallbackError) {
      return res.status(500).json({
        success: false,
        error: 'Şablonlar yüklenemedi'
      });
    }
  }
});

/**
 * GET /api/ai/templates/:id
 * Tek bir şablon getir
 */
router.get('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // ID veya slug ile ara
    const result = await query(`
      SELECT * FROM ai_prompt_templates 
      WHERE id = $1 OR slug = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Şablon bulunamadı'
      });
    }
    
    return res.json({
      success: true,
      template: result.rows[0]
    });

  } catch (error) {
    logger.error('[AI Template Get] Hata', { error: error.message, stack: error.stack, id });
    return res.status(500).json({
      success: false,
      error: 'Şablon getirilemedi'
    });
  }
});

/**
 * POST /api/ai/templates
 * Yeni şablon oluştur (Admin only)
 */
router.post('/templates', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, description, prompt, category, icon, color, is_active, preferred_model } = req.body;
    
    if (!name || !prompt) {
      return res.status(400).json({
        success: false,
        error: 'Ad ve prompt alanları zorunludur'
      });
    }
    
    // Slug oluştur
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9ğüşıöçĞÜŞİÖÇ\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .substring(0, 100);
    
    // Slug benzersizliği kontrol
    const existing = await query('SELECT id FROM ai_prompt_templates WHERE slug = $1', [slug]);
    const finalSlug = existing.rows.length > 0 ? `${slug}-${Date.now()}` : slug;
    
    const result = await query(`
      INSERT INTO ai_prompt_templates 
        (slug, name, description, prompt, category, icon, color, is_active, is_default, is_system, preferred_model)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, FALSE, $9)
      RETURNING *
    `, [
      finalSlug,
      name,
      description || '',
      prompt,
      category || 'Genel',
      icon || '🤖',
      color || 'blue',
      is_active !== false,
      preferred_model || null  // Boş string = NULL
    ]);
    
    logger.info(`[AI Template] Yeni şablon oluşturuldu: ${name}`, { templateId: result.rows[0].id, slug: finalSlug });
    
    return res.json({
      success: true,
      message: 'Şablon oluşturuldu',
      template: result.rows[0]
    });

  } catch (error) {
    logger.error('[AI Template Create] Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Şablon oluşturulamadı: ' + error.message
    });
  }
});

/**
 * PUT /api/ai/templates/:id
 * Şablon güncelle (Admin only)
 */
router.put('/templates/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, prompt, category, icon, color, is_active, preferred_model } = req.body;
    
    // Mevcut şablonu kontrol et
    const existing = await query('SELECT * FROM ai_prompt_templates WHERE id = $1', [id]);
    
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Şablon bulunamadı'
      });
    }
    
    // preferred_model için özel işlem: boş string = NULL (varsayılan model)
    const modelValue = preferred_model === '' ? null : (preferred_model || existing.rows[0].preferred_model);
    
    const result = await query(`
      UPDATE ai_prompt_templates SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        prompt = COALESCE($3, prompt),
        category = COALESCE($4, category),
        icon = COALESCE($5, icon),
        color = COALESCE($6, color),
        is_active = COALESCE($7, is_active),
        preferred_model = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [name, description, prompt, category, icon, color, is_active, id, modelValue]);
    
    logger.info(`[AI Template] Şablon güncellendi: ${id}`, { templateId: id });
    
    return res.json({
      success: true,
      message: 'Şablon güncellendi',
      template: result.rows[0]
    });

  } catch (error) {
    logger.error('[AI Template Update] Hata', { error: error.message, stack: error.stack, id });
    return res.status(500).json({
      success: false,
      error: 'Şablon güncellenemedi'
    });
  }
});

/**
 * DELETE /api/ai/templates/:id
 * Şablon sil (sistem şablonları silinemez) (Admin only)
 */
router.delete('/templates/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Sistem şablonu kontrolü
    const existing = await query('SELECT * FROM ai_prompt_templates WHERE id = $1', [id]);
    
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Şablon bulunamadı'
      });
    }
    
    if (existing.rows[0].is_system) {
      return res.status(403).json({
        success: false,
        error: 'Sistem şablonları silinemez'
      });
    }
    
    await query('DELETE FROM ai_prompt_templates WHERE id = $1', [id]);
    
    logger.info(`[AI Template] Şablon silindi: ${id}`, { templateId: id });
    
    return res.json({
      success: true,
      message: 'Şablon silindi'
    });

  } catch (error) {
    logger.error('[AI Template Delete] Hata', { error: error.message, stack: error.stack, id });
    return res.status(500).json({
      success: false,
      error: 'Şablon silinemedi'
    });
  }
});

/**
 * POST /api/ai/templates/:id/increment-usage
 * Şablon kullanım sayacını artır
 */
router.post('/templates/:id/increment-usage', async (req, res) => {
  try {
    const { id } = req.params;
    
    await query(`
      UPDATE ai_prompt_templates 
      SET usage_count = usage_count + 1 
      WHERE id = $1 OR slug = $1
    `, [id]);
    
    return res.json({ success: true });

  } catch (error) {
    logger.error('[AI Template Usage] Hata', { error: error.message, stack: error.stack, id });
    return res.status(500).json({ success: false });
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

    logger.debug(`[Product Analysis] Analiz ediliyor: "${itemDescription}"`);

    const result = await claudeAI.analyzeProduct(itemDescription);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        rawResponse: result.rawResponse
      });
    }

    logger.info(`[Product Analysis] Kategori: ${result.data.category} | Güven: ${result.data.confidence}`, { category: result.data.category, confidence: result.data.confidence });

    return res.json({
      success: true,
      analysis: result.data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Product Analysis] Hata', { error: error.message, stack: error.stack });
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

    logger.info(`[Batch Analysis] ${items.length} ürün analiz ediliyor`, { itemCount: items.length });

    const result = await claudeAI.analyzeBatchProducts(items);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        rawResponse: result.rawResponse
      });
    }

    logger.info(`[Batch Analysis] ${result.data.length} ürün analiz edildi`, { analyzedCount: result.data.length, totalItems: items.length });

    return res.json({
      success: true,
      analyses: result.data,
      totalItems: items.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Batch Analysis] Hata', { error: error.message, stack: error.stack, itemCount: items.length });
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
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
    
    // Aktif modeli al
    const modelResult = await query(`SELECT setting_value FROM ai_settings WHERE setting_key = 'default_model'`);
    const currentModel = modelResult.rows[0]?.setting_value || 'claude-sonnet-4-20250514';
    
    return res.json({
      success: true,
      status: hasApiKey ? 'active' : 'inactive',
      hasApiKey,
      model: currentModel,
      features: [
        'chat',
        'agent',
        'product-analysis',
        'batch-analysis',
        'memory',
        'learning'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[AI Status] Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Durum kontrol edilemedi'
    });
  }
});

// ==========================================
// AI AYARLARI ENDPOINTLERİ
// ==========================================

/**
 * GET /api/ai/settings
 * Tüm AI ayarlarını getir
 */
router.get('/settings', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT setting_key, setting_value, description, category, updated_at
      FROM ai_settings
      ORDER BY category, setting_key
    `);
    
    // Ayarları kategori bazında grupla
    const settings = {};
    const grouped = {};
    
    rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
      
      if (!grouped[row.category]) {
        grouped[row.category] = [];
      }
      grouped[row.category].push({
        key: row.setting_key,
        value: row.setting_value,
        description: row.description,
        updated_at: row.updated_at
      });
    });
    
    return res.json({
      success: true,
      settings,
      grouped,
      count: rows.length
    });
    
  } catch (error) {
    logger.error('[AI Settings] GET Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Ayarlar yüklenemedi'
    });
  }
});

/**
 * PUT /api/ai/settings
 * AI ayarlarını güncelle (Admin only)
 */
router.put('/settings', authenticate, requireAdmin, async (req, res) => {
  try {
    const { settings, changeNote } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Geçersiz ayar verisi'
      });
    }
    
    const updatedKeys = [];
    const oldValues = {};
    
    // Önce eski değerleri al (versiyonlama için)
    for (const key of Object.keys(settings)) {
      const oldResult = await query(
        'SELECT setting_value FROM ai_settings WHERE setting_key = $1',
        [key]
      );
      if (oldResult.rows.length > 0) {
        oldValues[key] = oldResult.rows[0].setting_value;
      }
    }
    
    // Ayarları güncelle ve versiyon kaydet
    for (const [key, value] of Object.entries(settings)) {
      const oldValue = oldValues[key];
      const newValue = JSON.stringify(value);
      
      // Değer değişti mi kontrol et
      if (oldValue && JSON.stringify(oldValue) === newValue) {
        continue; // Değişiklik yok, versiyon kaydetme
      }
      
      const result = await query(`
        UPDATE ai_settings 
        SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
        WHERE setting_key = $2
        RETURNING setting_key
      `, [newValue, key]);
      
      if (result.rows.length > 0) {
        updatedKeys.push(key);
        
        // Versiyon geçmişine kaydet
        try {
          await SettingsVersionService.saveVersion(
            key,
            value,
            req.user.id,
            changeNote || `Ayar güncellendi`
          );
        } catch (versionError) {
          logger.warn('Version save failed', { key, error: versionError.message });
          // Versiyon kaydı başarısız olsa bile ayar güncellemesi devam eder
        }
      }
    }
    
    logger.info(`[AI Settings] ${updatedKeys.length} ayar güncellendi`, { updatedKeys, count: updatedKeys.length });
    
    return res.json({
      success: true,
      updatedKeys,
      message: `${updatedKeys.length} ayar güncellendi`
    });
    
  } catch (error) {
    logger.error('[AI Settings] PUT Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Ayarlar güncellenemedi'
    });
  }
});

/**
 * GET /api/ai/settings/export
 * AI ayarlarını JSON olarak export et (Admin only)
 */
router.get('/settings/export', authenticate, requireAdmin, async (req, res) => {
  try {
    // Tüm ayarları al
    const result = await query(`
      SELECT setting_key, setting_value, category, description, updated_at
      FROM ai_settings
      ORDER BY category, setting_key
    `);
    
    const settings = {};
    const metadata = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      exported_by: req.user?.id || null,
      count: result.rows.length
    };
    
    result.rows.forEach(row => {
      let value = row.setting_value;
      // JSON string ise parse et
      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try {
          value = JSON.parse(value);
        } catch (e) {
          // Parse edilemezse string olarak bırak
        }
      }
      
      settings[row.setting_key] = {
        value,
        category: row.category,
        description: row.description,
        updated_at: row.updated_at
      };
    });
    
    const exportData = {
      metadata,
      settings
    };
    
    // JSON dosyası olarak döndür
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ai-settings-export-${Date.now()}.json"`);
    res.json(exportData);
    
    logger.info('[AI Settings Export] Ayarlar export edildi', { 
      count: result.rows.length,
      userId: req.user?.id 
    });
    
  } catch (error) {
    logger.error('[AI Settings Export] Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Ayarlar export edilemedi'
    });
  }
});

/**
 * POST /api/ai/settings/import
 * AI ayarlarını JSON'dan import et (Admin only)
 */
router.post('/settings/import', authenticate, requireAdmin, async (req, res) => {
  try {
    const { settings, overwrite = false } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Geçersiz import verisi. settings objesi gerekli.'
      });
    }
    
    // Mevcut ayarları yedekle (rollback için)
    const currentSettingsResult = await query(`
      SELECT setting_key, setting_value FROM ai_settings
    `);
    const backup = {};
    currentSettingsResult.rows.forEach(row => {
      backup[row.setting_key] = row.setting_value;
    });
    
    const importedKeys = [];
    const skippedKeys = [];
    const errors = [];
    
    // Transaction başlat (her ayar için ayrı işlem)
    for (const [key, data] of Object.entries(settings)) {
      try {
        let value = data;
        
        // Eğer data bir obje ise ve value property'si varsa
        if (typeof data === 'object' && data !== null && 'value' in data) {
          value = data.value;
        }
        
        // Mevcut ayar var mı kontrol et
        const existingResult = await query(`
          SELECT setting_key FROM ai_settings WHERE setting_key = $1
        `, [key]);
        
        if (existingResult.rows.length > 0) {
          if (!overwrite) {
            skippedKeys.push(key);
            continue;
          }
        }
        
        // Ayarı güncelle veya ekle
        const valueJson = JSON.stringify(value);
        
        if (existingResult.rows.length > 0) {
          await query(`
            UPDATE ai_settings 
            SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
            WHERE setting_key = $2
          `, [valueJson, key]);
        } else {
          // Yeni ayar ekle (category ve description varsa kullan)
          const category = typeof data === 'object' && data.category ? data.category : 'general';
          const description = typeof data === 'object' && data.description ? data.description : null;
          
          await query(`
            INSERT INTO ai_settings (setting_key, setting_value, category, description, updated_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
          `, [key, valueJson, category, description]);
        }
        
        importedKeys.push(key);
        
      } catch (error) {
        errors.push({
          key,
          error: error.message
        });
        logger.error(`[AI Settings Import] Ayar import hatası: ${key}`, { error: error.message });
      }
    }
    
    // Hata varsa rollback yap
    if (errors.length > 0 && importedKeys.length === 0) {
      // Hiçbir ayar import edilemediyse rollback
      for (const [key, value] of Object.entries(backup)) {
        try {
          await query(`
            UPDATE ai_settings 
            SET setting_value = $1
            WHERE setting_key = $2
          `, [value, key]);
        } catch (e) {
          logger.error(`[AI Settings Import] Rollback hatası: ${key}`, { error: e.message });
        }
      }
      
      return res.status(400).json({
        success: false,
        error: 'Import başarısız, rollback yapıldı',
        errors
      });
    }
    
    logger.info('[AI Settings Import] Ayarlar import edildi', { 
      imported: importedKeys.length,
      skipped: skippedKeys.length,
      errors: errors.length,
      userId: req.user?.id 
    });
    
    return res.json({
      success: true,
      imported: importedKeys.length,
      skipped: skippedKeys.length,
      errors: errors.length,
      importedKeys,
      skippedKeys,
      errors: errors.length > 0 ? errors : undefined,
      message: `${importedKeys.length} ayar import edildi${skippedKeys.length > 0 ? `, ${skippedKeys.length} ayar atlandı` : ''}`
    });
    
  } catch (error) {
    logger.error('[AI Settings Import] Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Ayarlar import edilemedi: ' + error.message
    });
  }
});

/**
 * GET /api/ai/settings/history
 * AI ayarları versiyon geçmişini getir (Admin only)
 */
router.get('/settings/history', authenticate, requireAdmin, async (req, res) => {
  try {
    const { settingKey, limit = 50 } = req.query;
    
    let history;
    if (settingKey) {
      history = await SettingsVersionService.getHistory(settingKey, parseInt(limit));
    } else {
      history = await SettingsVersionService.getAllHistory(parseInt(limit));
    }
    
    return res.json({
      success: true,
      history,
      count: history.length
    });
    
  } catch (error) {
    logger.error('[AI Settings History] GET Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Versiyon geçmişi alınamadı'
    });
  }
});

/**
 * GET /api/ai/settings/history/:settingKey/:version
 * Belirli bir versiyonu getir (Admin only)
 */
router.get('/settings/history/:settingKey/:version', authenticate, requireAdmin, async (req, res) => {
  try {
    const { settingKey, version } = req.params;
    
    const versionData = await SettingsVersionService.getVersion(settingKey, parseInt(version));
    
    if (!versionData) {
      return res.status(404).json({
        success: false,
        error: 'Versiyon bulunamadı'
      });
    }
    
    return res.json({
      success: true,
      version: versionData
    });
    
  } catch (error) {
    logger.error('[AI Settings Version] GET Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Versiyon alınamadı'
    });
  }
});

/**
 * POST /api/ai/settings/restore/:settingKey/:version
 * Belirli bir versiyona geri dön (Admin only)
 */
router.post('/settings/restore/:settingKey/:version', authenticate, requireAdmin, async (req, res) => {
  try {
    const { settingKey, version } = req.params;
    const { changeNote } = req.body;
    
    await SettingsVersionService.restoreVersion(
      settingKey,
      parseInt(version),
      req.user.id
    );
    
    // Eğer changeNote varsa, geri yükleme kaydına ekle
    if (changeNote) {
      const versionData = await SettingsVersionService.getVersion(settingKey, parseInt(version));
      if (versionData) {
        await SettingsVersionService.saveVersion(
          settingKey,
          versionData.setting_value,
          req.user.id,
          changeNote
        );
      }
    }
    
    logger.info(`[AI Settings] Versiyon geri yüklendi`, { settingKey, version, userId: req.user.id });
    
    return res.json({
      success: true,
      message: `Versiyon ${version} geri yüklendi`
    });
    
  } catch (error) {
    logger.error('[AI Settings Restore] POST Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: error.message || 'Versiyon geri yüklenemedi'
    });
  }
});

/**
 * GET /api/ai/settings/models
 * Kullanılabilir AI modellerini getir
 */
router.get('/settings/models', async (req, res) => {
  try {
    const modelsResult = await query(`
      SELECT setting_value FROM ai_settings WHERE setting_key = 'available_models'
    `);
    const defaultResult = await query(`
      SELECT setting_value FROM ai_settings WHERE setting_key = 'default_model'
    `);
    
    const models = modelsResult.rows[0]?.setting_value || [];
    const defaultModel = defaultResult.rows[0]?.setting_value || 'claude-sonnet-4-20250514';
    
    return res.json({
      success: true,
      models,
      defaultModel,
      count: models.length
    });
    
  } catch (error) {
    logger.error('[AI Models] Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Modeller yüklenemedi'
    });
  }
});

/**
 * PUT /api/ai/settings/model
 * Aktif AI modelini değiştir (Admin only)
 */
router.put('/settings/model', authenticate, requireAdmin, async (req, res) => {
  try {
    const { model } = req.body;
    
    if (!model) {
      return res.status(400).json({
        success: false,
        error: 'Model belirtilmedi'
      });
    }
    
    // Modelin geçerli olup olmadığını kontrol et
    const modelsResult = await query(`
      SELECT setting_value FROM ai_settings WHERE setting_key = 'available_models'
    `);
    const availableModels = modelsResult.rows[0]?.setting_value || [];
    const validModel = availableModels.find(m => m.id === model);
    
    if (!validModel) {
      return res.status(400).json({
        success: false,
        error: 'Geçersiz model seçimi',
        availableModels: availableModels.map(m => m.id)
      });
    }
    
    // Modeli güncelle
    await query(`
      UPDATE ai_settings 
      SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
      WHERE setting_key = 'default_model'
    `, [JSON.stringify(model)]);
    
    logger.info(`[AI Model] Model değiştirildi: ${model}`, { model, modelInfo: validModel });
    
    return res.json({
      success: true,
      model,
      modelInfo: validModel,
      message: `AI modeli ${validModel.name} olarak değiştirildi`
    });
    
  } catch (error) {
    logger.error('[AI Model] Hata', { error: error.message, stack: error.stack, model });
    return res.status(500).json({
      success: false,
      error: 'Model değiştirilemedi'
    });
  }
});

// ==========================================
// FEEDBACK SİSTEMİ
// ==========================================

/**
 * POST /api/ai/feedback
 * AI yanıtı için geri bildirim kaydet
 */
router.post('/feedback', async (req, res) => {
  try {
    const { 
      conversationId,
      rating, // 1 (thumbs down) veya 5 (thumbs up)
      feedbackType, // 'helpful', 'not_helpful', 'wrong', 'perfect'
      comment,
      messageContent,
      aiResponse,
      modelUsed,
      templateSlug,
      toolsUsed,
      responseTimeMs
    } = req.body;
    
    if (!rating && !feedbackType) {
      return res.status(400).json({
        success: false,
        error: 'Rating veya feedbackType gerekli'
      });
    }
    
    const result = await query(`
      INSERT INTO ai_feedback (
        conversation_id, rating, feedback_type, comment,
        message_content, ai_response, model_used, template_slug,
        tools_used, response_time_ms, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'default')
      RETURNING id
    `, [
      conversationId || null,
      rating || null,
      feedbackType || null,
      comment || null,
      messageContent || null,
      aiResponse || null,
      modelUsed || null,
      templateSlug || null,
      toolsUsed || null,
      responseTimeMs || null
    ]);
    
    logger.info(`[AI Feedback] Kayıt: ${result.rows[0].id}, Rating: ${rating}, Type: ${feedbackType}`, { feedbackId: result.rows[0].id, rating, feedbackType });
    
    return res.json({
      success: true,
      feedbackId: result.rows[0].id,
      message: 'Geri bildiriminiz kaydedildi. Teşekkürler!'
    });
    
  } catch (error) {
    logger.error('[AI Feedback] Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Geri bildirim kaydedilemedi'
    });
  }
});

/**
 * GET /api/ai/feedback/stats
 * Feedback istatistiklerini getir
 */
router.get('/feedback/stats', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive,
        COUNT(CASE WHEN rating <= 2 THEN 1 END) as negative,
        AVG(rating)::numeric(3,2) as avg_rating,
        AVG(response_time_ms)::integer as avg_response_time,
        COUNT(DISTINCT model_used) as models_used
      FROM ai_feedback
      WHERE created_at > NOW() - INTERVAL '30 days'
    `);
    
    const byType = await query(`
      SELECT feedback_type, COUNT(*) as count
      FROM ai_feedback
      WHERE feedback_type IS NOT NULL
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY feedback_type
      ORDER BY count DESC
    `);
    
    return res.json({
      success: true,
      stats: stats.rows[0],
      byType: byType.rows,
      period: 'Son 30 gün'
    });
    
  } catch (error) {
    logger.error('[AI Feedback Stats] Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'İstatistikler yüklenemedi'
    });
  }
});

// ==========================================
// HAFIZA & ÖĞRENME
// ==========================================

/**
 * GET /api/ai/memory
 * AI hafızasını getir
 */
router.get('/memory', async (req, res) => {
  try {
    const { userId = 'default', type, category, limit = 50 } = req.query;
    
    let whereClause = 'WHERE user_id = $1';
    const params = [userId];
    let paramIndex = 2;
    
    if (type) {
      whereClause += ` AND memory_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    if (category) {
      whereClause += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    const { rows } = await query(`
      SELECT id, memory_type, category, key, value, importance, usage_count, 
             last_used_at, created_at, updated_at
      FROM ai_memory
      ${whereClause}
      ORDER BY importance DESC, usage_count DESC, last_used_at DESC
      LIMIT $${paramIndex}
    `, [...params, parseInt(limit)]);
    
    return res.json({
      success: true,
      memories: rows,
      count: rows.length
    });
    
  } catch (error) {
    logger.error('[AI Memory] Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Hafıza yüklenemedi'
    });
  }
});

/**
 * POST /api/ai/memory
 * Yeni hafıza ekle
 */
router.post('/memory', async (req, res) => {
  try {
    const { memoryType, category, key, value, importance = 5, userId = 'default' } = req.body;
    
    if (!memoryType || !key || !value) {
      return res.status(400).json({
        success: false,
        error: 'memoryType, key ve value zorunlu'
      });
    }
    
    const result = await query(`
      INSERT INTO ai_memory (user_id, memory_type, category, key, value, importance)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, memory_type, key) DO UPDATE SET
        value = EXCLUDED.value,
        importance = GREATEST(ai_memory.importance, EXCLUDED.importance),
        usage_count = ai_memory.usage_count + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [userId, memoryType, category, key, value, importance]);
    
    return res.json({
      success: true,
      memoryId: result.rows[0].id,
      message: 'Hafıza kaydedildi'
    });
    
  } catch (error) {
    logger.error('[AI Memory POST] Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Hafıza kaydedilemedi'
    });
  }
});

/**
 * DELETE /api/ai/memory/:id
 * Hafıza sil (Admin only)
 */
router.delete('/memory/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`DELETE FROM ai_memory WHERE id = $1 RETURNING id`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Hafıza bulunamadı'
      });
    }
    
    return res.json({
      success: true,
      message: 'Hafıza silindi'
    });
    
  } catch (error) {
    logger.error('[AI Memory DELETE] Hata', { error: error.message, stack: error.stack, id });
    return res.status(500).json({
      success: false,
      error: 'Hafıza silinemedi'
    });
  }
});

/**
 * GET /api/ai/learned-facts
 * Öğrenilen bilgileri getir
 */
router.get('/learned-facts', async (req, res) => {
  try {
    const { verified, applied, limit = 50 } = req.query;
    
    let whereClause = '1=1';
    const params = [];
    let paramIndex = 1;
    
    if (verified !== undefined) {
      whereClause += ` AND verified = $${paramIndex}`;
      params.push(verified === 'true');
      paramIndex++;
    }
    
    if (applied !== undefined) {
      whereClause += ` AND applied_to_memory = $${paramIndex}`;
      params.push(applied === 'true');
      paramIndex++;
    }
    
    const { rows } = await query(`
      SELECT id, fact_type, entity_type, entity_name, fact_key, fact_value,
             confidence, verified, applied_to_memory, created_at
      FROM ai_learned_facts
      WHERE ${whereClause}
      ORDER BY confidence DESC, created_at DESC
      LIMIT $${paramIndex}
    `, [...params, parseInt(limit)]);
    
    return res.json({
      success: true,
      facts: rows,
      count: rows.length
    });
    
  } catch (error) {
    logger.error('[AI Learned Facts] Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Öğrenilen bilgiler yüklenemedi'
    });
  }
});

/**
 * PUT /api/ai/learned-facts/:id/verify
 * Öğrenilen bilgiyi onayla
 */
router.put('/learned-facts/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { verified } = req.body;
    
    const result = await query(`
      UPDATE ai_learned_facts 
      SET verified = $1
      WHERE id = $2
      RETURNING *
    `, [verified !== false, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Bilgi bulunamadı'
      });
    }
    
    // Onaylandıysa memory'ye taşı
    if (verified !== false && result.rows[0].confidence >= 0.7) {
      await query(`SELECT apply_learned_facts_to_memory()`);
    }
    
    return res.json({
      success: true,
      fact: result.rows[0],
      message: verified !== false ? 'Bilgi onaylandı ve hafızaya eklendi' : 'Onay kaldırıldı'
    });
    
  } catch (error) {
    logger.error('[AI Verify Fact] Hata', { error: error.message, stack: error.stack, id });
    return res.status(500).json({
      success: false,
      error: 'İşlem yapılamadı'
    });
  }
});

// ==========================================
// SİSTEM ÖZETİ & SNAPSHOT
// ==========================================

/**
 * POST /api/ai/snapshot
 * Manuel günlük sistem özeti oluştur
 */
router.post('/snapshot', async (req, res) => {
  try {
    const result = await aiAgent.createDailySnapshot();
    
    if (result.success) {
      return res.json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (error) {
    logger.error('[AI Snapshot] Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Snapshot oluşturulamadı'
    });
  }
});

/**
 * GET /api/ai/snapshots
 * Sistem özetlerini getir
 */
router.get('/snapshots', async (req, res) => {
  try {
    const { limit = 7, type = 'daily' } = req.query;
    
    const { rows } = await query(`
      SELECT id, snapshot_type, summary_data, created_at
      FROM ai_system_snapshot
      WHERE snapshot_type = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [type, parseInt(limit)]);
    
    return res.json({
      success: true,
      snapshots: rows,
      count: rows.length
    });
    
  } catch (error) {
    logger.error('[AI Snapshots] Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Snapshot\'lar yüklenemedi'
    });
  }
});

// ==========================================
// SOHBET GEÇMİŞİ ENDPOINTLERİ
// ==========================================

/**
 * GET /api/ai/conversations
 * Tüm sohbet oturumlarını listele
 */
router.get('/conversations', async (req, res) => {
  try {
    const { userId = 'default', limit = 50, offset = 0 } = req.query;
    
    // Benzersiz session'ları ve son mesajları getir
    const { rows } = await query(`
      WITH session_summary AS (
        SELECT 
          session_id,
          user_id,
          MIN(created_at) as started_at,
          MAX(created_at) as last_message_at,
          COUNT(*) as message_count,
          COUNT(CASE WHEN role = 'user' THEN 1 END) as user_messages,
          COUNT(CASE WHEN role = 'assistant' THEN 1 END) as ai_messages
        FROM ai_conversations
        WHERE user_id = $1
        GROUP BY session_id, user_id
      ),
      first_message AS (
        SELECT DISTINCT ON (session_id) 
          session_id,
          content as first_user_message
        FROM ai_conversations
        WHERE role = 'user' AND user_id = $1
        ORDER BY session_id, created_at ASC
      )
      SELECT 
        s.*,
        f.first_user_message,
        SUBSTRING(f.first_user_message, 1, 100) as preview
      FROM session_summary s
      LEFT JOIN first_message f ON s.session_id = f.session_id
      ORDER BY s.last_message_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, parseInt(limit), parseInt(offset)]);
    
    // Toplam sayı
    const countResult = await query(`
      SELECT COUNT(DISTINCT session_id) as total
      FROM ai_conversations
      WHERE user_id = $1
    `, [userId]);
    
    return res.json({
      success: true,
      conversations: rows,
      count: rows.length,
      total: parseInt(countResult.rows[0]?.total || 0),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
    
  } catch (error) {
    logger.error('[AI Conversations] Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Sohbet geçmişi yüklenemedi'
    });
  }
});

/**
 * GET /api/ai/conversations/list
 * Prefix ile filtrelenmiş konuşma listesi (dilekçe türüne göre)
 */
router.get('/conversations/list', async (req, res) => {
  try {
    const { prefix, userId = 'default', limit = 50 } = req.query;
    
    if (!prefix) {
      return res.status(400).json({
        success: false,
        error: 'Prefix parametresi gerekli'
      });
    }
    
    // Prefix ile başlayan session'ları getir
    const { rows } = await query(`
      WITH session_summary AS (
        SELECT 
          session_id,
          user_id,
          MIN(created_at) as started_at,
          MAX(created_at) as last_message_at,
          COUNT(*) as message_count,
          COUNT(CASE WHEN role = 'user' THEN 1 END) as user_messages,
          COUNT(CASE WHEN role = 'assistant' THEN 1 END) as ai_messages
        FROM ai_conversations
        WHERE session_id LIKE $1 || '%'
        GROUP BY session_id, user_id
      ),
      first_message AS (
        SELECT DISTINCT ON (session_id) 
          session_id,
          content as first_user_message
        FROM ai_conversations
        WHERE role = 'user' AND session_id LIKE $1 || '%'
        ORDER BY session_id, created_at ASC
      ),
      last_assistant AS (
        SELECT DISTINCT ON (session_id) 
          session_id,
          SUBSTRING(content, 1, 200) as last_response_preview
        FROM ai_conversations
        WHERE role = 'assistant' AND session_id LIKE $1 || '%'
        ORDER BY session_id, created_at DESC
      )
      SELECT 
        s.*,
        f.first_user_message,
        SUBSTRING(f.first_user_message, 1, 150) as preview,
        la.last_response_preview
      FROM session_summary s
      LEFT JOIN first_message f ON s.session_id = f.session_id
      LEFT JOIN last_assistant la ON s.session_id = la.session_id
      ORDER BY s.last_message_at DESC
      LIMIT $2
    `, [prefix, parseInt(limit)]);
    
    return res.json({
      success: true,
      conversations: rows,
      count: rows.length
    });
    
  } catch (error) {
    logger.error('[AI Conversations List] Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Konuşma listesi yüklenemedi'
    });
  }
});

/**
 * GET /api/ai/conversations/search
 * Sohbet geçmişinde ara
 */
router.get('/conversations/search', async (req, res) => {
  try {
    const { q, userId = 'default', limit = 20 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Arama terimi en az 2 karakter olmalı'
      });
    }
    
    const searchTerm = `%${q.trim().toLowerCase()}%`;
    
    const { rows } = await query(`
      SELECT 
        id,
        session_id,
        role,
        content,
        created_at,
        tools_used
      FROM ai_conversations
      WHERE user_id = $1 
        AND LOWER(content) LIKE $2
      ORDER BY created_at DESC
      LIMIT $3
    `, [userId, searchTerm, parseInt(limit)]);
    
    return res.json({
      success: true,
      results: rows,
      count: rows.length,
      query: q
    });
    
  } catch (error) {
    logger.error('[AI Conversations Search] Hata', { error: error.message, stack: error.stack, query: q });
    return res.status(500).json({
      success: false,
      error: 'Arama yapılamadı'
    });
  }
});

/**
 * GET /api/ai/conversations/:sessionId
 * Belirli bir oturumun tüm mesajlarını getir
 */
router.get('/conversations/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId = 'default' } = req.query;
    
    const { rows } = await query(`
      SELECT 
        id,
        session_id,
        user_id,
        role,
        content,
        tools_used,
        metadata,
        created_at
      FROM ai_conversations
      WHERE session_id = $1 AND user_id = $2
      ORDER BY created_at ASC
    `, [sessionId, userId]);
    
    // Konuşma yoksa boş döndür (404 yerine)
    if (rows.length === 0) {
      return res.json({
        success: true,
        session: null,
        messages: []
      });
    }
    
    // Oturum özeti
    const summary = {
      session_id: sessionId,
      started_at: rows[0].created_at,
      last_message_at: rows[rows.length - 1].created_at,
      message_count: rows.length,
      user_messages: rows.filter(r => r.role === 'user').length,
      ai_messages: rows.filter(r => r.role === 'assistant').length
    };
    
    return res.json({
      success: true,
      session: summary,
      messages: rows
    });
    
  } catch (error) {
    logger.error('[AI Conversation Detail] Hata', { error: error.message, stack: error.stack, sessionId });
    return res.status(500).json({
      success: false,
      error: 'Sohbet detayı yüklenemedi'
    });
  }
});

/**
 * DELETE /api/ai/conversations/:sessionId
 * Belirli bir oturumu sil
 */
router.delete('/conversations/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId = 'default' } = req.query;
    
    const result = await query(`
      DELETE FROM ai_conversations
      WHERE session_id = $1 AND user_id = $2
      RETURNING id
    `, [sessionId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sohbet oturumu bulunamadı'
      });
    }
    
    logger.info(`[AI Conversation] Silindi: ${sessionId} (${result.rows.length} mesaj)`, { sessionId, deletedCount: result.rows.length });
    
    return res.json({
      success: true,
      message: 'Sohbet oturumu silindi',
      deletedCount: result.rows.length
    });
    
  } catch (error) {
    logger.error('[AI Conversation Delete] Hata', { error: error.message, stack: error.stack, sessionId });
    return res.status(500).json({
      success: false,
      error: 'Sohbet silinemedi'
    });
  }
});

/**
 * GET /api/ai/dashboard
 * AI Dashboard - tüm önemli metrikleri getir
 */
router.get('/dashboard', async (req, res) => {
  try {
    // Son 7 gün istatistikleri
    const conversationStats = await query(`
      SELECT 
        DATE(created_at) as tarih,
        COUNT(*) as mesaj_sayisi,
        COUNT(DISTINCT session_id) as oturum_sayisi
      FROM ai_conversations
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY tarih DESC
    `);

    // Toplam hafıza
    const memoryCount = await query(`
      SELECT COUNT(*) as count FROM ai_memory
    `);

    // Öğrenilen fact sayısı
    const factCount = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN verified THEN 1 END) as verified,
        COUNT(CASE WHEN applied_to_memory THEN 1 END) as applied
      FROM ai_learned_facts
    `);

    // Template kullanımı
    const templateUsage = await query(`
      SELECT slug, name, usage_count
      FROM ai_prompt_templates
      ORDER BY usage_count DESC
      LIMIT 5
    `);

    // Aktif model
    const modelResult = await query(`
      SELECT setting_value FROM ai_settings WHERE setting_key = 'default_model'
    `);

    return res.json({
      success: true,
      dashboard: {
        conversations: conversationStats.rows,
        memoryCount: parseInt(memoryCount.rows[0]?.count || 0),
        facts: factCount.rows[0],
        topTemplates: templateUsage.rows,
        activeModel: modelResult.rows[0]?.setting_value || 'claude-sonnet-4-20250514'
      }
    });

  } catch (error) {
    logger.error('[AI Dashboard] Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Dashboard yüklenemedi'
    });
  }
});

// ============================================
// GOD MODE ENDPOINTS (Super Admin Only)
// ============================================
// NOT: Daha spesifik route'lar önce tanımlanmalı (Express route matching için)

/**
 * POST /api/ai/god-mode/execute
 * God Mode ile AI Agent çalıştır
 * Super Admin yetkisi gerekli
 */
router.post('/god-mode/execute', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { message, sessionId, history = [] } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Mesaj boş olamaz'
      });
    }
    
    logger.warn('[God Mode Execute] Super Admin komutu', {
      userId: req.user?.id,
      email: req.user?.email,
      messagePreview: message.substring(0, 100),
      sessionId,
      historyLength: history.length
    });
    
    // God Mode ile AI Agent çalıştır
    const result = await aiAgent.processQuery(message, history, {
      sessionId: sessionId || `god-mode-${Date.now()}`,
      userId: req.user?.id || 'super_admin',
      department: 'GOD_MODE',
      isGodMode: true,
      pageContext: {
        isGodMode: true,
        page: 'admin/god-mode',
        user: {
          id: req.user?.id,
          email: req.user?.email,
          role: 'super_admin'
        }
      }
    });
    
    return res.json({
      success: result.success,
      response: result.response,
      toolsUsed: result.toolsUsed || [],
      iterations: result.iterations || 0,
      executionTime: result.executionTime || 0,
      godMode: true, // God Mode flag'i
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('[God Mode Execute] Hata', { 
      error: error.message, 
      stack: error.stack,
      userId: req.user?.id 
    });
    return res.status(500).json({
      success: false,
      error: 'God Mode komutu çalıştırılamadı: ' + error.message
    });
  }
});

/**
 * GET /api/ai/god-mode/tools
 * God Mode için mevcut tool listesini döndür
 * Super Admin yetkisi gerekli
 */
router.get('/god-mode/tools', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    // AI Tools'dan tüm tool'ları al
    const allTools = aiTools.getToolDefinitions();
    
    // God mode tool'ları filtrele
    const godModeTools = allTools.filter(tool => 
      tool.name.startsWith('god_') || tool.isGodMode === true
    );
    
    // Normal tool'lar
    const normalTools = allTools.filter(tool => 
      !tool.name.startsWith('god_') && tool.isGodMode !== true
    );
    
    logger.info('[God Mode] Tool listesi istendi', { 
      userId: req.user?.id,
      godModeCount: godModeTools.length,
      normalCount: normalTools.length
    });
    
    return res.json({
      success: true,
      allTools: allTools.map(t => ({
        name: t.name,
        description: t.description,
        isGodMode: t.name.startsWith('god_') || t.isGodMode === true
      })),
      godModeTools: godModeTools.map(t => ({
        name: t.name,
        description: t.description
      })),
      normalTools: normalTools.map(t => ({
        name: t.name,
        description: t.description
      })),
      counts: {
        total: allTools.length,
        godMode: godModeTools.length,
        normal: normalTools.length
      }
    });
    
  } catch (error) {
    logger.error('[God Mode Tools] Hata', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Tool listesi alınamadı'
    });
  }
});

/**
 * GET /api/ai/god-mode/logs
 * God Mode işlem loglarını getir
 * Super Admin yetkisi gerekli
 */
router.get('/god-mode/logs', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    // God mode loglarını getir (ai_conversations tablosundan)
    const result = await query(`
      SELECT 
        id,
        session_id,
        user_id,
        message,
        response,
        tools_used,
        created_at
      FROM ai_conversations
      WHERE session_id LIKE 'god-mode-%'
         OR (metadata->>'isGodMode')::boolean = true
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), parseInt(offset)]);
    
    return res.json({
      success: true,
      logs: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: result.rows.length
      }
    });
    
  } catch (error) {
    logger.error('[God Mode Logs] Hata', { error: error.message });
    return res.status(500).json({
      success: false,
      error: 'Loglar alınamadı'
    });
  }
});

export default router;
