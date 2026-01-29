/**
 * Prompt Builder API Routes
 * AI Prompt Builder modülü için API endpoint'leri
 *
 * Güvenlik Güncellemeleri:
 * - Rate limiting eklendi
 * - Seed endpoint auth koruması eklendi
 * - Input validation eklendi
 */

import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { authenticate, optionalAuth, requireSuperAdmin } from '../middleware/auth.js';
import * as pbService from '../services/prompt-builder-service.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ============================================
// RATE LIMITING CONFIGURATION
// ============================================

/**
 * AI endpoint'leri için rate limiter
 * Claude API çağrıları masraflı - abuse önleme
 */
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 15, // dakikada max 15 istek
  message: {
    success: false,
    error: 'Çok fazla istek gönderdiniz. Lütfen 1 dakika bekleyin.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  keyGenerator: (req) => {
    if (req.user?.id) return `user_${req.user.id}`;
    const ip = req.ip || req.socket?.remoteAddress;
    return ip ? ipKeyGenerator(ip) : 'unknown';
  }
});

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Input sanitization - XSS ve injection önleme
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
}

/**
 * Allowed fields only - field injection önleme
 */
function pickAllowedFields(obj, allowedFields) {
  const result = {};
  for (const field of allowedFields) {
    if (obj[field] !== undefined) {
      result[field] = obj[field];
    }
  }
  return result;
}

/**
 * JSON parse helper - robust parsing
 */
function extractJSON(text) {
  if (!text) return null;

  // İlk { ile son } arasını al
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || start >= end) {
    return null;
  }

  try {
    const jsonStr = text.substring(start, end + 1);
    return JSON.parse(jsonStr);
  } catch {
    // Markdown code block içinde olabilir
    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const cleanStart = cleaned.indexOf('{');
    const cleanEnd = cleaned.lastIndexOf('}');

    if (cleanStart !== -1 && cleanEnd !== -1 && cleanStart < cleanEnd) {
      try {
        return JSON.parse(cleaned.substring(cleanStart, cleanEnd + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * GET /api/prompt-builder/categories
 * Tüm aktif kategorileri listele
 */
router.get('/categories', async (_req, res) => {
  try {
    const categories = await pbService.getCategories();

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    logger.error('[Prompt Builder] Kategoriler getirilemedi', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Kategoriler yüklenemedi'
    });
  }
});

/**
 * GET /api/prompt-builder/categories/:slug
 * Kategori detayı + sorular + şablonlar
 */
router.get('/categories/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    const category = await pbService.getCategoryBySlug(slug);
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Kategori bulunamadı'
      });
    }
    
    const [questions, templates] = await Promise.all([
      pbService.getQuestionsByCategorySlug(slug),
      pbService.getTemplatesByCategorySlug(slug)
    ]);
    
    res.json({
      success: true,
      data: {
        category,
        questions,
        templates
      }
    });
  } catch (error) {
    logger.error('[Prompt Builder] Kategori detayı getirilemedi', { error: error.message, stack: error.stack, slug });
    res.status(500).json({
      success: false,
      error: 'Kategori detayı yüklenemedi'
    });
  }
});

/**
 * GET /api/prompt-builder/questions/:categorySlug
 * Kategorinin sorularını getir
 */
router.get('/questions/:categorySlug', async (req, res) => {
  try {
    const { categorySlug } = req.params;
    const questions = await pbService.getQuestionsByCategorySlug(categorySlug);
    
    res.json({
      success: true,
      data: questions
    });
  } catch (error) {
    logger.error('[Prompt Builder] Sorular getirilemedi', { error: error.message, stack: error.stack, categorySlug });
    res.status(500).json({
      success: false,
      error: 'Sorular yüklenemedi'
    });
  }
});

/**
 * GET /api/prompt-builder/templates/:categorySlug
 * Kategorinin şablonlarını getir
 */
router.get('/templates/:categorySlug', async (req, res) => {
  try {
    const { categorySlug } = req.params;
    const templates = await pbService.getTemplatesByCategorySlug(categorySlug);
    
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    logger.error('[Prompt Builder] Şablonlar getirilemedi', { error: error.message, stack: error.stack, categorySlug });
    res.status(500).json({
      success: false,
      error: 'Şablonlar yüklenemedi'
    });
  }
});

/**
 * GET /api/prompt-builder/template/:id
 * Tek şablon detayı
 */
router.get('/template/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await pbService.getTemplateById(id);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Şablon bulunamadı'
      });
    }
    
    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error('[Prompt Builder] Şablon getirilemedi', { error: error.message, stack: error.stack, id });
    res.status(500).json({
      success: false,
      error: 'Şablon yüklenemedi'
    });
  }
});

/**
 * POST /api/prompt-builder/generate
 * Prompt oluştur
 */
router.post('/generate', optionalAuth, async (req, res) => {
  try {
    const { templateId, answers } = req.body;
    
    if (!templateId || !answers) {
      return res.status(400).json({
        success: false,
        error: 'Template ID ve cevaplar gerekli'
      });
    }
    
    const template = await pbService.getTemplateById(templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Şablon bulunamadı'
      });
    }
    
    const generatedPrompt = pbService.generatePrompt(template.template_text, answers);
    
    // Kullanım sayacını artır
    await pbService.incrementTemplateUsage(templateId);
    
    // Kullanım istatistiği kaydet
    if (req.user) {
      await pbService.logUsage(req.user.id, {
        templateId,
        categoryId: template.category_id,
        action: 'generate',
        metadata: { answersCount: Object.keys(answers).length }
      });
    }
    
    res.json({
      success: true,
      data: {
        prompt: generatedPrompt,
        template: {
          id: template.id,
          name: template.name,
          style: template.style,
          categorySlug: template.category_slug,
          categoryName: template.category_name
        }
      }
    });
  } catch (error) {
    logger.error('[Prompt Builder] Prompt oluşturulamadı', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Prompt oluşturulamadı'
    });
  }
});

/**
 * POST /api/prompt-builder/save
 * Oluşturulan prompt'u kaydet
 * Auth: Required
 */
router.post('/save', authenticate, async (req, res) => {
  try {
    // Sadece izin verilen alanları al (field injection önleme)
    const allowedFields = ['name', 'generatedPrompt', 'originalInput', 'style', 'categoryId', 'templateId', 'description', 'answers'];
    const safeBody = pickAllowedFields(req.body, allowedFields);

    const { name, generatedPrompt, originalInput, style, categoryId, templateId, description, answers } = safeBody;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'İsim en az 3 karakter olmalı'
      });
    }

    if (!generatedPrompt || typeof generatedPrompt !== 'string' || generatedPrompt.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Prompt en az 10 karakter olmalı'
      });
    }

    // Max length kontrolü
    if (name.length > 255) {
      return res.status(400).json({
        success: false,
        error: 'İsim en fazla 255 karakter olabilir'
      });
    }

    if (generatedPrompt.length > 50000) {
      return res.status(400).json({
        success: false,
        error: 'Prompt en fazla 50000 karakter olabilir'
      });
    }

    const saved = await pbService.savePrompt(req.user.id, {
      categoryId: categoryId ? parseInt(categoryId, 10) : null,
      templateId: templateId ? parseInt(templateId, 10) : null,
      name: sanitizeInput(name.trim()),
      description: description ? sanitizeInput(description.trim()) : null,
      generatedPrompt: generatedPrompt.trim(),
      answers: answers || { originalInput: originalInput || '' },
      style: style || 'professional'
    });
    
    // Kullanım istatistiği kaydet
    await pbService.logUsage(req.user.id, {
      savedPromptId: saved.id,
      action: 'save'
    });
    
    res.json({
      success: true,
      data: saved,
      message: 'Prompt başarıyla kaydedildi'
    });
  } catch (error) {
    logger.error('[Prompt Builder] Prompt kaydedilemedi', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: `Prompt kaydedilemedi: ${error.message}`
    });
  }
});

/**
 * GET /api/prompt-builder/saved
 * Kullanıcının kayıtlı prompt'larını getir
 * Auth: Required
 */
router.get('/saved', authenticate, async (req, res) => {
  try {
    const { limit = 50, offset = 0, categoryId, favoriteOnly } = req.query;
    
    const prompts = await pbService.getSavedPrompts(req.user.id, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      categoryId: categoryId ? parseInt(categoryId, 10) : null,
      favoriteOnly: favoriteOnly === 'true'
    });
    
    res.json({
      success: true,
      data: prompts
    });
  } catch (error) {
    console.error('❌ [Prompt Builder] Kayıtlı promptlar getirilemedi:', error);
    res.status(500).json({
      success: false,
      error: 'Kayıtlı promptlar yüklenemedi'
    });
  }
});

/**
 * GET /api/prompt-builder/saved/:id
 * Tek kayıtlı prompt detayı
 * Auth: Required (veya public prompt)
 */
router.get('/saved/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 0;
    
    const prompt = await pbService.getSavedPromptById(id, userId);
    
    if (!prompt) {
      return res.status(404).json({
        success: false,
        error: 'Prompt bulunamadı'
      });
    }
    
    res.json({
      success: true,
      data: prompt
    });
  } catch (error) {
    logger.error('[Prompt Builder] Kayıtlı prompt getirilemedi', { error: error.message, stack: error.stack, id });
    res.status(500).json({
      success: false,
      error: 'Kayıtlı prompt yüklenemedi'
    });
  }
});

/**
 * PATCH /api/prompt-builder/saved/:id
 * Kayıtlı prompt güncelle
 * Auth: Required
 */
router.patch('/saved/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Sadece izin verilen alanları al (field injection önleme)
    const allowedFields = ['name', 'description', 'isFavorite', 'isPublic'];
    const safeBody = pickAllowedFields(req.body, allowedFields);

    const { name, description, isFavorite, isPublic } = safeBody;

    // Validation
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 3) {
        return res.status(400).json({
          success: false,
          error: 'İsim en az 3 karakter olmalı'
        });
      }
      if (name.length > 255) {
        return res.status(400).json({
          success: false,
          error: 'İsim en fazla 255 karakter olabilir'
        });
      }
    }

    if (description !== undefined && description !== null) {
      if (typeof description !== 'string' || description.length > 1000) {
        return res.status(400).json({
          success: false,
          error: 'Açıklama en fazla 1000 karakter olabilir'
        });
      }
    }

    // Boolean validation
    if (isFavorite !== undefined && typeof isFavorite !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isFavorite boolean olmalı'
      });
    }

    if (isPublic !== undefined && typeof isPublic !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isPublic boolean olmalı'
      });
    }

    const updated = await pbService.updateSavedPrompt(id, req.user.id, {
      name: name ? sanitizeInput(name.trim()) : undefined,
      description: description ? sanitizeInput(description.trim()) : description,
      isFavorite,
      isPublic
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Prompt bulunamadı veya yetkiniz yok'
      });
    }
    
    res.json({
      success: true,
      data: updated,
      message: 'Prompt güncellendi'
    });
  } catch (error) {
    logger.error('[Prompt Builder] Prompt güncellenemedi', { error: error.message, stack: error.stack, id });
    res.status(500).json({
      success: false,
      error: 'Prompt güncellenemedi'
    });
  }
});

/**
 * DELETE /api/prompt-builder/saved/:id
 * Kayıtlı prompt sil
 * Auth: Required
 */
router.delete('/saved/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = await pbService.deleteSavedPrompt(id, req.user.id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Prompt bulunamadı veya yetkiniz yok'
      });
    }
    
    res.json({
      success: true,
      message: 'Prompt silindi'
    });
  } catch (error) {
    logger.error('[Prompt Builder] Prompt silinemedi', { error: error.message, stack: error.stack, id });
    res.status(500).json({
      success: false,
      error: 'Prompt silinemedi'
    });
  }
});

/**
 * POST /api/prompt-builder/stats
 * Kullanım istatistiği kaydet
 * Auth: Optional
 */
router.post('/stats', optionalAuth, async (req, res) => {
  try {
    const { savedPromptId, categoryId, templateId, action, metadata } = req.body;
    
    if (!action) {
      return res.status(400).json({
        success: false,
        error: 'Action gerekli'
      });
    }
    
    await pbService.logUsage(req.user?.id, {
      savedPromptId,
      categoryId,
      templateId,
      action,
      metadata
    });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('[Prompt Builder] İstatistik kaydedilemedi', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'İstatistik kaydedilemedi'
    });
  }
});

/**
 * GET /api/prompt-builder/gallery
 * Public prompt galerisi
 */
router.get('/gallery', async (req, res) => {
  try {
    const { limit = 50, offset = 0, categoryId, sortBy = 'usage_count' } = req.query;
    
    const prompts = await pbService.getPublicPrompts({
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      categoryId: categoryId ? parseInt(categoryId, 10) : null,
      sortBy
    });
    
    res.json({
      success: true,
      data: prompts
    });
  } catch (error) {
    logger.error('[Prompt Builder] Galeri getirilemedi', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Galeri yüklenemedi'
    });
  }
});

/**
 * GET /api/prompt-builder/my-stats
 * Kullanıcının istatistikleri
 * Auth: Required
 */
router.get('/my-stats', authenticate, async (req, res) => {
  try {
    const stats = await pbService.getUserStats(req.user.id);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('[Prompt Builder] İstatistikler getirilemedi', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'İstatistikler yüklenemedi'
    });
  }
});

/**
 * POST /api/prompt-builder/ask
 * AI'dan dinamik soru iste - Chat tarzı interaktif akış
 * Rate Limited: 15 req/min
 */
router.post('/ask', aiRateLimiter, optionalAuth, async (req, res) => {
  try {
    const { userInput, conversationHistory = [] } = req.body;
    
    if (!userInput || userInput.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Lütfen en az 3 karakter girin'
      });
    }

    // Konuşma geçmişini formatla
    const historyText = conversationHistory.map(h => 
      `Soru: ${h.question}\nCevap: ${h.answer}`
    ).join('\n\n');

    // AI'a gönderilecek prompt
    const systemPrompt = `Sen Catering Pro sisteminde bir asistansın. Kullanıcının isteğini anlamak için netleştirici sorular soruyorsun.

GÖREV: Kullanıcının isteğini tam anlamak için TEK bir soru sor ve cevap seçenekleri sun.

⚠️ SORU SIRASI ZORUNLU - Bu sırayı MUTLAKA takip et:

SORU 1 (ZORUNLU): "Bu işlem hangi proje/şirket için?"
Seçenekler: ["Mevcut proje", "Yeni proje", "Tüm projeler", "Belirtmek istiyorum"]

SORU 2: Kullanıcının isteğini netleştir (ne yapmak istiyor?)
SORU 3: Detay sorusu (dönem, tür, kapsam vs.)
SORU 4: Ek detay gerekiyorsa

Kurallar:
1. Her seferinde SADECE 1 soru sor
2. Sorulara 2-5 arası tıklanabilir seçenek ver
3. İLK SORU HER ZAMAN proje/şirket sorusu olmalı!
4. Seçenekler kısa ve net olsun (max 4-5 kelime)
5. 3-4 soru sonra yeterli bilgiyi toplamış ol
6. Sistem modülleri: Fatura/Muhasebe, İhale, Personel/İK, Stok/Depo, Müşteri/Cari, Menü/Üretim, Raporlar

YANIT FORMATI (JSON):
{
  "question": "Sorunun metni",
  "options": ["Seçenek 1", "Seçenek 2", "Seçenek 3"],
  "isComplete": false
}

Eğer yeterli bilgi toplandıysa:
{
  "question": null,
  "options": [],
  "isComplete": true,
  "summary": "Toplanan bilgilerin özeti",
  "suggestedPrompt": "Oluşturulan detaylı prompt"
}

${historyText ? `DAHA ÖNCE SORULAN SORULAR VE CEVAPLAR:\n${historyText}\n\n` : ''}
KULLANICININ İLK İSTEĞİ: "${userInput}"

Şimdi bir sonraki soruyu sor veya yeterli bilgi toplandıysa sonucu döndür:`;

    // Claude API
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        { role: 'user', content: systemPrompt }
      ]
    });

    const responseText = response.content[0]?.text?.trim() || '';

    // JSON parse et - Robust parsing kullan
    let result = extractJSON(responseText);

    // Eğer parse edilemezse fallback
    if (!result) {
      logger.warn('[Prompt Builder] JSON parse başarısız, fallback kullanılıyor', {
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 200)
      });
      result = {
        question: 'Bu konuda hangi işlemi yapmak istiyorsunuz?',
        options: ['Bilgi sorgulama', 'Analiz yapma', 'Rapor oluşturma', 'Öneri alma'],
        isComplete: false,
        _fallback: true
      };
    }

    // Result validation
    if (!result.isComplete && (!result.question || !Array.isArray(result.options))) {
      result = {
        question: result.question || 'Nasıl yardımcı olabilirim?',
        options: Array.isArray(result.options) ? result.options : ['Devam et', 'Yeniden başla'],
        isComplete: false,
        _validated: true
      };
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('[Prompt Builder] Ask hatası', { error: error.message, stack: error.stack });
    
    // Fallback
    res.json({
      success: true,
      data: {
        question: 'Ne tür bir yardım istiyorsunuz?',
        options: ['Bilgi sorgulama', 'Analiz', 'Rapor', 'Öneri'],
        isComplete: false,
        fallback: true
      }
    });
  }
});

/**
 * POST /api/prompt-builder/transform
 * Prompt dönüştürme işlemleri
 * Rate Limited: 15 req/min
 */
router.post('/transform', aiRateLimiter, optionalAuth, async (req, res) => {
  try {
    const { prompt, action } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt gerekli' });
    }

    // Claude API
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        { 
          role: 'user', 
          content: `${prompt}\n\nÖNEMLİ: Sadece dönüştürülmüş metni döndür, açıklama yapma.`
        }
      ]
    });

    const result = response.content[0]?.text?.trim() || prompt;

    // Log usage
    if (req.user) {
      await pbService.logUsage(req.user.id, {
        action: `transform_${action}`,
        metadata: { inputLength: prompt.length, outputLength: result.length }
      });
    }

    res.json({ success: true, data: { result, action } });
  } catch (error) {
    logger.error('[Prompt Builder] Transform hatası', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: 'Dönüştürme başarısız' });
  }
});

/**
 * POST /api/prompt-builder/optimize
 * AI ile prompt optimize et - BASIT VE ETKİLİ
 * Rate Limited: 15 req/min
 */
router.post('/optimize', aiRateLimiter, optionalAuth, async (req, res) => {
  try {
    const { userInput, style = 'professional' } = req.body;
    
    if (!userInput || userInput.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Lütfen en az 5 karakter girin'
      });
    }

    // Stil bazlı talimatlar
    const styleInstructions = {
      professional: 'Profesyonel ve resmi bir dil kullan. Açık, net ve iş odaklı ol.',
      detailed: 'Çok detaylı ve kapsamlı ol. Tüm alt başlıkları ve adımları belirt.',
      creative: 'Yaratıcı ve ilgi çekici bir yaklaşım kullan. Özgün fikirler ve perspektifler sun.',
      simple: 'Kısa ve öz ol. Gereksiz detaylardan kaçın, ana noktaya odaklan.'
    };

    // AI'a gönderilecek prompt
    const systemPrompt = `Sen bir AI prompt mühendisisin. Kullanıcının yazdığı metni, AI asistanlarına (ChatGPT, Claude vb.) verilecek etkili bir prompt'a dönüştür.

Kurallar:
1. ${styleInstructions[style] || styleInstructions.professional}
2. Prompt'u Türkçe yaz
3. Bağlam ve amaç netleştir
4. Beklenen çıktı formatını belirt (liste, rapor, analiz vb.)
5. Gerekirse örnek veya kısıtlamalar ekle
6. Sadece optimize edilmiş prompt'u döndür, başka açıklama yapma

Kullanıcının girdisi: "${userInput}"

Optimize edilmiş prompt:`;

    // Claude API ile optimize et
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        { role: 'user', content: systemPrompt }
      ]
    });

    const optimizedPrompt = response.content[0]?.text?.trim() || userInput;

    // Kullanım istatistiği
    if (req.user) {
      await pbService.logUsage(req.user.id, {
        action: 'optimize',
        metadata: { 
          style, 
          inputLength: userInput.length, 
          outputLength: optimizedPrompt.length 
        }
      });
    }

    res.json({
      success: true,
      data: {
        optimizedPrompt,
        originalInput: userInput,
        style
      }
    });
  } catch (error) {
    logger.error('[Prompt Builder] Optimize hatası', { error: error.message, stack: error.stack });
    
    // Fallback: Basit şablon ile optimize et
    const { userInput, style = 'professional' } = req.body;
    const fallbackPrompt = generateFallbackPrompt(userInput, style);
    
    res.json({
      success: true,
      data: {
        optimizedPrompt: fallbackPrompt,
        originalInput: userInput,
        style,
        fallback: true
      }
    });
  }
});

// Fallback prompt generator
function generateFallbackPrompt(input, style) {
  const stylePrefix = {
    professional: 'Profesyonel ve detaylı bir şekilde',
    detailed: 'Kapsamlı ve tüm yönleriyle',
    creative: 'Yaratıcı ve özgün bir bakış açısıyla',
    simple: 'Kısa ve öz olarak'
  };
  
  return `${stylePrefix[style] || stylePrefix.professional} aşağıdaki konuyu ele al:

${input}

Lütfen:
1. Konuyu net bir şekilde analiz et
2. Önemli noktaları vurgula
3. Uygulanabilir öneriler sun
4. Sonuç ve değerlendirme yap`;
}

/**
 * GET /api/prompt-builder/popular-categories
 * En popüler kategoriler
 */
router.get('/popular-categories', async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const categories = await pbService.getPopularCategories(parseInt(limit, 10));
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    logger.error('[Prompt Builder] Popüler kategoriler getirilemedi', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Popüler kategoriler yüklenemedi'
    });
  }
});

/**
 * POST /api/prompt-builder/seed
 * Başlangıç verilerini oluştur
 * AUTH: Super Admin Only - Güvenlik kritik!
 */
router.post('/seed', authenticate, requireSuperAdmin, async (_req, res) => {
  try {
    const { query } = await import('../database.js');
    
    // 1. Tabloları oluştur
    await query(`
      CREATE TABLE IF NOT EXISTS pb_categories (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        icon VARCHAR(50),
        color VARCHAR(50) DEFAULT 'blue',
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pb_questions (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES pb_categories(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        question_type VARCHAR(50) DEFAULT 'text',
        options JSONB,
        placeholder VARCHAR(255),
        is_required BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0,
        variable_name VARCHAR(100) NOT NULL,
        help_text TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pb_templates (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES pb_categories(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        template_text TEXT NOT NULL,
        style VARCHAR(50) DEFAULT 'professional',
        style_options JSONB,
        model_hint VARCHAR(100),
        example_output TEXT,
        is_default BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pb_saved_prompts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES pb_categories(id) ON DELETE SET NULL,
        template_id INTEGER REFERENCES pb_templates(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        generated_prompt TEXT NOT NULL,
        answers JSONB,
        style VARCHAR(50),
        is_favorite BOOLEAN DEFAULT FALSE,
        is_public BOOLEAN DEFAULT FALSE,
        usage_count INTEGER DEFAULT 0,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pb_usage_stats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        saved_prompt_id INTEGER,
        category_id INTEGER,
        template_id INTEGER,
        action VARCHAR(50),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Kategorileri ekle
    const categories = [
      { slug: 'serbest', name: '✨ Serbest Prompt', description: 'Kategorisiz, tamamen özelleştirilebilir prompt', icon: '✨', color: 'grape', sort_order: 0 },
      { slug: 'ihale', name: '📋 İhale Analizi', description: 'İhale değerlendirme, risk analizi ve strateji', icon: '📋', color: 'violet', sort_order: 1 },
      { slug: 'muhasebe', name: '💰 Muhasebe & Finans', description: 'Mali analiz, raporlama ve planlama', icon: '💰', color: 'green', sort_order: 2 },
      { slug: 'personel', name: '👥 İK & Personel', description: 'Çalışan yönetimi ve bordro', icon: '👥', color: 'blue', sort_order: 3 },
      { slug: 'operasyon', name: '📦 Operasyon & Stok', description: 'Depo ve üretim yönetimi', icon: '📦', color: 'orange', sort_order: 4 },
      { slug: 'yazisma', name: '📝 Resmi Yazışma', description: 'Dilekçe ve resmi belgeler', icon: '📝', color: 'gray', sort_order: 5 },
    ];

    for (const cat of categories) {
      await query(`
        INSERT INTO pb_categories (slug, name, description, icon, color, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name, description = EXCLUDED.description,
          icon = EXCLUDED.icon, color = EXCLUDED.color, sort_order = EXCLUDED.sort_order
      `, [cat.slug, cat.name, cat.description, cat.icon, cat.color, cat.sort_order]);
    }

    // 3. Serbest kategori için soru ve şablon
    const serbestRes = await query(`SELECT id FROM pb_categories WHERE slug = 'serbest'`);
    const serbestId = serbestRes.rows[0]?.id;
    
    if (serbestId) {
      await query(`
        INSERT INTO pb_questions (category_id, question_text, question_type, variable_name, sort_order, help_text, placeholder)
        VALUES ($1, 'Prompt''unuzu yazın', 'textarea', 'serbest_prompt', 1, 'AI''a vermek istediğiniz komutu veya soruyu yazın', 'Örn: Bir catering firması için müşteri memnuniyetini artıracak stratejiler öner...')
        ON CONFLICT DO NOTHING
      `, [serbestId]);

      await query(`
        INSERT INTO pb_templates (category_id, name, template_text, style, is_default)
        VALUES ($1, 'Serbest Prompt', '{{serbest_prompt}}', 'professional', TRUE)
        ON CONFLICT DO NOTHING
      `, [serbestId]);
    }

    // 4. İhale kategorisi
    const ihaleRes = await query(`SELECT id FROM pb_categories WHERE slug = 'ihale'`);
    const ihaleId = ihaleRes.rows[0]?.id;
    
    if (ihaleId) {
      const ihaleQuestions = [
        { text: 'Hangi sektördeki ihaleyi analiz ediyorsunuz?', type: 'select', var: 'sektor', order: 1, 
          options: JSON.stringify([
            { label: 'Catering / Yemek', value: 'catering' },
            { label: 'İnşaat', value: 'insaat' },
            { label: 'Teknoloji', value: 'teknoloji' },
            { label: 'Sağlık', value: 'saglik' },
            { label: 'Diğer', value: 'diger' }
          ]) },
        { text: 'İhale konusunu kısaca açıklayın', type: 'textarea', var: 'konu', order: 2, options: null },
        { text: 'Tahmini bütçe (TL)', type: 'text', var: 'butce', order: 3, options: null },
        { text: 'Dikkat edilmesi gereken konular', type: 'textarea', var: 'dikkat', order: 4, options: null },
      ];

      for (const q of ihaleQuestions) {
        await query(`
          INSERT INTO pb_questions (category_id, question_text, question_type, variable_name, sort_order, options)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT DO NOTHING
        `, [ihaleId, q.text, q.type, q.var, q.order, q.options]);
      }

      await query(`
        INSERT INTO pb_templates (category_id, name, template_text, style, is_default)
        VALUES ($1, 'İhale Analiz Raporu', $2, 'professional', TRUE)
        ON CONFLICT DO NOTHING
      `, [ihaleId, `Sen deneyimli bir ihale uzmanısın. {{sektor}} sektöründe bir ihale analiz edeceksin.

İhale Konusu: {{konu}}
Tahmini Bütçe: {{butce}}
Dikkat Edilecekler: {{dikkat}}

Lütfen şu başlıklar altında analiz yap:
1. 🎯 Risk Değerlendirmesi
2. 📊 Rekabet Analizi  
3. 💰 Fiyatlandırma Stratejisi
4. ✅ Önerilen Aksiyon Planı`]);
    }

    res.json({
      success: true,
      message: 'Seed işlemi tamamlandı!',
      data: { categories: categories.length }
    });
  } catch (error) {
    logger.error('[Prompt Builder] Seed hatası', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
