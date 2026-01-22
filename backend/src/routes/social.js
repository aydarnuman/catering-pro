import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { Blob } from 'buffer';
import {
  generateInstagramCaption,
  generateHashtags,
  analyzeDMAndSuggestReply,
  generateMenuPost,
  generateImagePrompt,
  generateImageWithStability,
  generateMenuCardTemplate,
} from '../services/instagram-ai.js';

const router = express.Router();

// Multer config for file uploads
const upload = multer({ 
  dest: 'temp/uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Service URLs - Docker'da servis isimleri, local'de localhost
const WHATSAPP_SERVICE = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3002';
const INSTAGRAM_SERVICE = process.env.INSTAGRAM_SERVICE_URL || 'http://localhost:3003';

// Helper function for proxy requests
async function proxyRequest(serviceUrl, path, options = {}) {
  try {
    const url = `${serviceUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    return await response.json();
  } catch (error) {
    console.error(`Proxy request failed: ${serviceUrl}${path}`, error.message);
    throw error;
  }
}

// ==================== WHATSAPP ROUTES ====================

// WhatsApp health check
router.get('/whatsapp/health', async (req, res) => {
  try {
    const result = await proxyRequest(WHATSAPP_SERVICE, '/health');
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'WhatsApp service unavailable',
      details: error.message,
    });
  }
});

// WhatsApp status
router.get('/whatsapp/status', async (req, res) => {
  try {
    const result = await proxyRequest(WHATSAPP_SERVICE, '/status');
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'WhatsApp service unavailable',
    });
  }
});

// Get QR code
router.get('/whatsapp/qr', async (req, res) => {
  try {
    const result = await proxyRequest(WHATSAPP_SERVICE, '/qr');
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'WhatsApp service unavailable',
    });
  }
});

// Connect WhatsApp
router.post('/whatsapp/connect', async (req, res) => {
  try {
    const result = await proxyRequest(WHATSAPP_SERVICE, '/connect', {
      method: 'POST',
    });
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'WhatsApp service unavailable',
    });
  }
});

// Disconnect WhatsApp
router.post('/whatsapp/disconnect', async (req, res) => {
  try {
    const result = await proxyRequest(WHATSAPP_SERVICE, '/disconnect', {
      method: 'POST',
    });
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'WhatsApp service unavailable',
    });
  }
});

// Force reconnect WhatsApp
router.post('/whatsapp/reconnect', async (req, res) => {
  try {
    const result = await proxyRequest(WHATSAPP_SERVICE, '/reconnect', {
      method: 'POST',
    });
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'WhatsApp service unavailable',
    });
  }
});

// Clean session and start fresh
router.post('/whatsapp/clean-session', async (req, res) => {
  try {
    const result = await proxyRequest(WHATSAPP_SERVICE, '/clean-session', {
      method: 'POST',
    });
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'WhatsApp service unavailable',
    });
  }
});

// Get chats
router.get('/whatsapp/chats', async (req, res) => {
  try {
    const result = await proxyRequest(WHATSAPP_SERVICE, '/chats');
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'WhatsApp service unavailable',
    });
  }
});

// Get messages from a chat
router.get('/whatsapp/chats/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit } = req.query;
    const queryStr = limit ? `?limit=${limit}` : '';
    const result = await proxyRequest(WHATSAPP_SERVICE, `/chats/${encodeURIComponent(chatId)}/messages${queryStr}`);
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'WhatsApp service unavailable',
    });
  }
});

// Mark messages as read (send seen)
router.post('/whatsapp/chats/:chatId/seen', async (req, res) => {
  try {
    const { chatId } = req.params;
    const result = await proxyRequest(WHATSAPP_SERVICE, `/chats/${encodeURIComponent(chatId)}/seen`, {
      method: 'POST',
    });
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'WhatsApp service unavailable',
    });
  }
});

// Send message
router.post('/whatsapp/send', async (req, res) => {
  try {
    const result = await proxyRequest(WHATSAPP_SERVICE, '/send', {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'WhatsApp service unavailable',
    });
  }
});

// Get contacts
router.get('/whatsapp/contacts', async (req, res) => {
  try {
    const result = await proxyRequest(WHATSAPP_SERVICE, '/contacts');
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'WhatsApp service unavailable',
    });
  }
});

// Archive chat
router.post('/whatsapp/chats/:chatId/archive', async (req, res) => {
  try {
    const { chatId } = req.params;
    const result = await proxyRequest(WHATSAPP_SERVICE, `/chats/${encodeURIComponent(chatId)}/archive`, {
      method: 'POST',
    });
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'WhatsApp service unavailable',
    });
  }
});

// Unarchive chat
router.post('/whatsapp/chats/:chatId/unarchive', async (req, res) => {
  try {
    const { chatId } = req.params;
    const result = await proxyRequest(WHATSAPP_SERVICE, `/chats/${encodeURIComponent(chatId)}/unarchive`, {
      method: 'POST',
    });
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'WhatsApp service unavailable',
    });
  }
});

// Download media from a message
router.get('/whatsapp/media/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const result = await proxyRequest(WHATSAPP_SERVICE, `/media/${encodeURIComponent(messageId)}`);
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'WhatsApp service unavailable',
    });
  }
});

// Save media to server permanently
router.post('/whatsapp/media/:messageId/save', async (req, res) => {
  try {
    const { messageId } = req.params;
    const result = await proxyRequest(WHATSAPP_SERVICE, `/media/${encodeURIComponent(messageId)}/save`, {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'WhatsApp service unavailable',
    });
  }
});

// Send media message (image, document, video)
router.post('/whatsapp/send-media', async (req, res) => {
  try {
    const result = await proxyRequest(WHATSAPP_SERVICE, '/send-media', {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'WhatsApp service unavailable',
    });
  }
});

// ==================== INSTAGRAM ROUTES ====================

// Instagram health check
router.get('/instagram/health', async (req, res) => {
  try {
    const result = await proxyRequest(INSTAGRAM_SERVICE, '/health');
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Instagram service unavailable',
      details: error.message,
    });
  }
});

// Instagram status
router.get('/instagram/status', async (req, res) => {
  try {
    const result = await proxyRequest(INSTAGRAM_SERVICE, '/status');
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Instagram service unavailable',
    });
  }
});

// Instagram login
router.post('/instagram/login', async (req, res) => {
  try {
    const result = await proxyRequest(INSTAGRAM_SERVICE, '/login', {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Instagram service unavailable',
    });
  }
});

// Instagram logout
router.post('/instagram/logout', async (req, res) => {
  try {
    const result = await proxyRequest(INSTAGRAM_SERVICE, '/logout', {
      method: 'POST',
    });
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Instagram service unavailable',
    });
  }
});

// Get profile
router.get('/instagram/profile', async (req, res) => {
  try {
    const result = await proxyRequest(INSTAGRAM_SERVICE, '/profile');
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Instagram service unavailable',
    });
  }
});

// Get posts
router.get('/instagram/posts', async (req, res) => {
  try {
    const { limit } = req.query;
    const queryStr = limit ? `?limit=${limit}` : '';
    const result = await proxyRequest(INSTAGRAM_SERVICE, `/posts${queryStr}`);
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Instagram service unavailable',
    });
  }
});

// Get DMs
router.get('/instagram/dms', async (req, res) => {
  try {
    const result = await proxyRequest(INSTAGRAM_SERVICE, '/dms');
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Instagram service unavailable',
    });
  }
});

// Get DM messages
router.get('/instagram/dms/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { limit } = req.query;
    const queryStr = limit ? `?limit=${limit}` : '';
    const result = await proxyRequest(INSTAGRAM_SERVICE, `/dms/${threadId}${queryStr}`);
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Instagram service unavailable',
    });
  }
});

// Send DM
router.post('/instagram/dms/send', async (req, res) => {
  try {
    const result = await proxyRequest(INSTAGRAM_SERVICE, '/dms/send', {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Instagram service unavailable',
    });
  }
});

// Get followers
router.get('/instagram/followers', async (req, res) => {
  try {
    const { limit } = req.query;
    const queryStr = limit ? `?limit=${limit}` : '';
    const result = await proxyRequest(INSTAGRAM_SERVICE, `/followers${queryStr}`);
    res.json(result);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Instagram service unavailable',
    });
  }
});

// Upload post (with file)
router.post('/instagram/posts/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Dosya gerekli',
      });
    }

    const { caption = '' } = req.body;
    
    // Read file and create FormData
    const fileBuffer = fs.readFileSync(req.file.path);
    const blob = new Blob([fileBuffer], { type: req.file.mimetype });
    
    const formData = new FormData();
    formData.append('file', blob, req.file.originalname);
    formData.append('caption', caption);

    // Forward to Instagram service
    const response = await fetch(`${INSTAGRAM_SERVICE}/posts/upload`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    // Cleanup temp file
    fs.unlink(req.file.path, () => {});

    res.json(result);
  } catch (error) {
    // Cleanup temp file on error
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(503).json({
      success: false,
      error: 'Instagram service unavailable',
      details: error.message,
    });
  }
});

// ==================== INSTAGRAM AI ROUTES ====================

/**
 * Görselden AI Caption üret (Gemini Vision)
 * POST /api/social/instagram/ai/caption
 * Body: multipart/form-data with 'file' and optional 'style', 'includeEmoji', etc.
 */
router.post('/instagram/ai/caption', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Görsel dosyası gerekli',
      });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const mimeType = req.file.mimetype;

    const options = {
      style: req.body.style || 'professional',
      includeEmoji: req.body.includeEmoji !== 'false',
      includeHashtags: req.body.includeHashtags !== 'false',
      businessName: req.body.businessName || 'Degsan Yemek',
      businessType: req.body.businessType || 'catering',
    };

    const result = await generateInstagramCaption(fileBuffer, mimeType, options);

    // Cleanup temp file
    fs.unlink(req.file.path, () => {});

    res.json(result);
  } catch (error) {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    console.error('AI Caption error:', error);
    res.status(500).json({
      success: false,
      error: 'AI caption üretilemedi',
      details: error.message,
    });
  }
});

/**
 * Hashtag önerileri üret
 * POST /api/social/instagram/ai/hashtags
 * Body: { caption: string, count?: number, city?: string }
 */
router.post('/instagram/ai/hashtags', async (req, res) => {
  try {
    const { caption, count, city, businessType } = req.body;

    if (!caption) {
      return res.status(400).json({
        success: false,
        error: 'Caption gerekli',
      });
    }

    const result = await generateHashtags(caption, { count, city, businessType });
    res.json(result);
  } catch (error) {
    console.error('AI Hashtag error:', error);
    res.status(500).json({
      success: false,
      error: 'Hashtag üretilemedi',
      details: error.message,
    });
  }
});

/**
 * DM analizi ve otomatik yanıt önerisi
 * POST /api/social/instagram/ai/dm-reply
 * Body: { message: string, context?: object }
 */
router.post('/instagram/ai/dm-reply', async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Mesaj gerekli',
      });
    }

    const result = await analyzeDMAndSuggestReply(message, context);
    res.json(result);
  } catch (error) {
    console.error('AI DM Reply error:', error);
    res.status(500).json({
      success: false,
      error: 'DM analizi yapılamadı',
      details: error.message,
    });
  }
});

/**
 * Menüden Instagram içeriği oluştur
 * POST /api/social/instagram/ai/menu-post
 * Body: { menu: array|object, businessName?: string, date?: string, includePrice?: boolean }
 */
router.post('/instagram/ai/menu-post', async (req, res) => {
  try {
    const { menu, businessName, date, includePrice } = req.body;

    if (!menu) {
      return res.status(400).json({
        success: false,
        error: 'Menü verisi gerekli',
      });
    }

    const result = await generateMenuPost(menu, { businessName, date, includePrice });
    res.json(result);
  } catch (error) {
    console.error('AI Menu Post error:', error);
    res.status(500).json({
      success: false,
      error: 'Menü içeriği oluşturulamadı',
      details: error.message,
    });
  }
});

/**
 * AI Image Prompt üret (DALL-E/Stability için)
 * POST /api/social/instagram/ai/image-prompt
 * Body: { description: string, style?: string, type?: string }
 */
router.post('/instagram/ai/image-prompt', async (req, res) => {
  try {
    const { description, style, type } = req.body;

    if (!description) {
      return res.status(400).json({
        success: false,
        error: 'Açıklama gerekli',
      });
    }

    const result = await generateImagePrompt(description, { style, type });
    res.json(result);
  } catch (error) {
    console.error('AI Image Prompt error:', error);
    res.status(500).json({
      success: false,
      error: 'Prompt oluşturulamadı',
      details: error.message,
    });
  }
});

/**
 * Stability AI ile görsel üret
 * POST /api/social/instagram/ai/generate-image
 * Body: { prompt: string, negativePrompt?: string, aspectRatio?: string }
 */
router.post('/instagram/ai/generate-image', async (req, res) => {
  try {
    const { prompt, negativePrompt, aspectRatio } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt gerekli',
      });
    }

    const result = await generateImageWithStability(prompt, { negativePrompt, aspectRatio });
    res.json(result);
  } catch (error) {
    console.error('AI Image Generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Görsel oluşturulamadı',
      details: error.message,
    });
  }
});

/**
 * Menü kartı HTML şablonu üret
 * POST /api/social/instagram/ai/menu-card
 * Body: { menu: array, template?: string, businessName?: string, date?: string, primaryColor?: string }
 */
router.post('/instagram/ai/menu-card', async (req, res) => {
  try {
    const { menu, template, businessName, date, primaryColor, secondaryColor } = req.body;

    if (!menu || !Array.isArray(menu) || menu.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Menü listesi gerekli (array formatında)',
      });
    }

    const result = await generateMenuCardTemplate(menu, { 
      template, 
      businessName, 
      date, 
      primaryColor, 
      secondaryColor 
    });
    res.json(result);
  } catch (error) {
    console.error('Menu Card Template error:', error);
    res.status(500).json({
      success: false,
      error: 'Menü kartı oluşturulamadı',
      details: error.message,
    });
  }
});

/**
 * Instagram DM gönder
 * POST /api/social/instagram/dms/send
 * Body: { threadId: string, message: string }
 */
router.post('/instagram/dms/send', async (req, res) => {
  try {
    const { threadId, message } = req.body;

    if (!threadId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Thread ID ve mesaj gerekli',
      });
    }

    const result = await proxyRequest(INSTAGRAM_SERVICE, '/dms/send', {
      method: 'POST',
      body: JSON.stringify({ thread_id: threadId, message }),
    });
    res.json(result);
  } catch (error) {
    console.error('Instagram DM Send error:', error);
    res.status(503).json({
      success: false,
      error: 'Mesaj gönderilemedi',
      details: error.message,
    });
  }
});

export default router;
